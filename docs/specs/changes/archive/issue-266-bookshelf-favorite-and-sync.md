---
type: spec-delta
title: "作品のお気に入り（★）登録・クラウド同期連携と本棚お気に入りフィルタ機能の設計"
description: "Issue #266 に対する差分仕様、本棚（SCR-01）および作品詳細（SCR-02）のお気に入り（★）トグルUI、本棚お気に入りフィルタとDB永続化、クラウド同期（SyncEngine）双方向LWWマージ、テスト計画、およびSub-issue分割計画。"
issue: "#266"
status: "Completed (Archived)"
updated: "2026-11-07"
tags:
  - delta
  - bookshelf
  - novel-detail
  - scr-01
  - scr-02
  - favorite
  - filter
  - cloud-sync
  - google-drive
  - storage
  - ho-32
related_specs:
  - docs/specs/features/bookshelf.md
  - docs/specs/features/novel-detail.md
  - docs/specs/db-schema.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/quality/bug-and-handover-log.md
related_tests:
  - src/storage/schema.test.ts
  - src/storage/repositories/novelRepository.test.ts
  - src/features/cloud-sync/services/syncEngine.test.ts
  - src/features/bookshelf/hooks/useBookshelf.test.ts
  - src/features/bookshelf/components/NovelCard.test.tsx
  - src/features/bookshelf/components/BookshelfEmptyState.test.tsx
  - src/features/bookshelf/components/BookshelfPage.test.tsx
  - src/features/bookshelf/components/BookshelfContainer.test.tsx
  - src/features/novel-detail/hooks/useNovelDetail.test.ts
  - src/features/novel-detail/components/NovelDetailHeader.test.tsx
  - src/features/novel-detail/components/NovelDetailPage.test.tsx
  - src/features/novel-detail/components/NovelDetailContainer.test.tsx
  - test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts
  - test/it/scenarios/scn05-cloud-sync.spec.ts
---

# 差分仕様書：作品のお気に入り（★）登録・クラウド同期連携と本棚お気に入りフィルタ機能の実装（Issue #266）

本ドキュメントは、Issue #266「`[v0.8] 作品のお気に入り（★）登録・クラウド同期連携と本棚お気に入りフィルタ機能の実装`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **愛読作品への素早いアクセスと更新チェック効率化**:
  本棚画面（`SCR-01`）に登録した作品数が増えると、特に愛読している連載作品を素早く絞り込んで閲覧・更新チェックしたいニーズが生じる。
- **`is_favorite` 基盤の UI 貫通と双方向クラウド同期の完成**:
  現在、SQLite の `novels.is_favorite` カラム（[docs/specs/db-schema.md](../../db-schema.md)）および Google Drive クラウド同期構造 `SyncNovelData.isFavorite`（[docs/specs/architecture.md](../../architecture.md)）は既に定義されているが、UI からお気に入り（★）を登録・解除する操作や本棚でのお気に入りフィルタリング機能が未実装であった（[docs/specs/features/bookshelf.md](../../features/bookshelf.md) §1 対象外スコープ）。また、`SyncEngine` の Pull 処理（`mergeExistingNovel`）において既存作品に対するリモートのお気に入り変更（`updatedAt` LWW）をローカル DB へ反映する処理が未接続であった。
- そこで `SYS-REQ-04` および `SYS-REQ-06` を拡張し、本棚カード（`NovelCard`）および作品詳細ヘッダー（`NovelDetailHeader`）の双方からお気に入り（★）をワンタップで登録・解除できるようにするとともに、本棚画面でのお気に入り絞り込みフィルタ（DB 永続化・お気に入り 0 件時の専用空状態・フィルタ連動手動更新チェック）およびクラウド同期での双方向 LWW マージを完成させる。

---

## 2. 仕様・設計の差分（What Changes）

Step 1 の `/grill-me` ヒアリングおよび既存コード調査で合意した設計差分は以下の通りです。

### 2.1 Storage Layer（`NovelRepository` / `schema.ts`）の拡張

[docs/specs/architecture.md](../../architecture.md) および [docs/specs/db-schema.md](../../db-schema.md) の契約を以下の通り拡張します。

1. **`APP_SETTING_KEYS` および `app_settings` 初期行の拡張（`src/storage/schema.ts`）**:
   - `APP_SETTING_KEYS` に `BOOKSHELF_FAVORITE_ONLY: "bookshelf_favorite_only"` を追加する。
   - `DDL_STATEMENTS` の `app_settings` 初期データとして `INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('bookshelf_favorite_only', 'false', '2026-01-01T00:00:00.000Z');` を追加する（設定値: `'true'` = お気に入りのみ表示、`'false'` = すべて表示［既定値］）。
2. **`NovelRepository` インターフェース契約と実装の拡張（`src/storage/types.ts`, `src/storage/repositories/novelRepository.ts`）**:
   ```typescript
   export interface NovelRepository {
     // ...既存メソッド...
     setFavorite(novelId: string, isFavorite: boolean): Promise<void>;
     updateSyncMetadata?(
       novelId: string,
       metadata: {
         isFavorite?: boolean;
         lastReadAt?: string | null;
         updatedAt?: string;
       },
     ): Promise<void>;
   }
   ```
   - `setFavorite(novelId: string, isFavorite: boolean): Promise<void>`:
     - 指定作品の `novels.is_favorite` を `isFavorite ? 1 : 0` に更新すると同時に、クラウド同期の Last-Write-Wins（LWW）判定を確実に機能させるため **`novels.updated_at` を現在時刻（`new Date().toISOString()`）へ同時更新** する。
   - `updateSyncMetadata(novelId, metadata)`:
     - 既存の `isFavorite` / `lastReadAt` に加え、`updatedAt?: string` の指定に対応し、クラウド同期 Pull 時にリモートの `updatedAt` タイムスタンプをそのままローカル `novels.updated_at` に同期保存できるようにする。

### 2.2 Cloud Sync Layer（`SyncEngine`）の双方向 LWW マージ完成

[docs/specs/architecture.md](../../architecture.md) §3.8.2 および `src/features/cloud-sync/services/syncEngine.ts` を以下の通り拡張します。

1. **既存作品 Pull 時の `isFavorite` / `updatedAt` LWW マージ（`SyncEngine.mergeExistingNovel`）**:
   - `pullAndMerge()` 内の `mergeExistingNovel(novelId, remoteNovel, localNovel)` において、`updateBookmark` によるローカル `updated_at` の書き換え前に `Date.parse(remoteNovel.updatedAt) > Date.parse(localNovel.updatedAt)` を判定する。
   - リモートの `updatedAt` の方が新しい場合、`novelRepository.updateSyncMetadata(novelId, { isFavorite: remoteNovel.isFavorite === 1, updatedAt: remoteNovel.updatedAt })` を呼び出し、リモートで変更されたお気に入り状態（登録 `1` または解除 `0`）と更新日時をローカル DB へ反映する。
   - なお、`remoteLastRead > localLastRead` により `updateBookmark` が実行された場合でも、リモートの `updatedAt` の方が新しい場合は最終的に `updated_at` が下がらないよう整合性を保つ。
   - ※注記（Milestone v0.8 横断レビュー `R1-01` / `R2-02` 反映）: 定常的なしおり更新（`updateBookmark`）や目次更新（`upsertNovelWithToc`）では `novels.updated_at` を更新せず既存値を保持し、また新規作品 Pull 復元時（`mergeNewNovel`）には `createdAt` と `updatedAt` の双方を復元する仕様へ正本（[docs/specs/architecture.md](../../architecture.md)、[docs/specs/db-schema.md](../../db-schema.md)）が改訂された（R2-14）。
2. **お気に入り変更時のデバウンス自動 Push トリガー**:
   - 本棚画面（`useBookshelf.toggleFavorite`）および作品詳細画面（`useNovelDetail.toggleFavorite`）において、`novelRepository.setFavorite` 完了後に `syncEngine?.notifyChanged()` を呼び出し、2.5秒デバウンス付き自動 Push をスケジュールする。

### 2.3 本棚画面（`SCR-01`）の UI・Hook 仕様拡張

[docs/specs/features/bookshelf.md](../../features/bookshelf.md) のコンポーネント契約および `useBookshelf` フック契約を以下の通り拡張します。

1. **`NovelCard`（お気に入りトグルボタン追加）**:
   - **Props 拡張（`NovelCardProps`）**:
     - `onToggleFavorite?: (novelId: string, nextIsFavorite: boolean) => void` を追加する。
   - **UI 構造とセマンティック属性**:
     - HTML 仕様上 `<button>` 要素の入れ子（`novel-card-select` 内のボタン配置）を避けるため、カード上部に独立したお気に入りトグルボタン `<button type="button" data-testid="novel-card-favorite-button" aria-pressed={novel.isFavorite} aria-label={novel.isFavorite ? `${novel.title}のお気に入りを解除`:`${novel.title}をお気に入りに登録`}>` を配置する（※Milestone v0.8 レビュー `R1-10` / `R2-01` にて、正本 [docs/specs/features/bookshelf.md](../../features/bookshelf.md) では固定ラベル `aria-label="${novel.title}のお気に入り"` ＋ `aria-pressed` へ改訂済み、R2-14）。
     - 表示ラベル/アイコン: `novel.isFavorite === true` のときは塗りつぶし星 `★`（アンバー強調スタイル）、`false` のときは白抜き星 `☆`（スレート色スタイル）を表示する。
     - クリック時に `e.stopPropagation()` を行い、`onToggleFavorite?.(novel.id, !novel.isFavorite)` を呼び出す（`onSelect` は発火させない）。
2. **`BookshelfEmptyState`（お気に入りフィルタ 0 件時の専用モード対応）**:
   - **Props 拡張（`BookshelfEmptyStateProps`）**:
     - `isFavoriteFilterActive?: boolean`（任意、既定値 `false`）
     - `onClearFavoriteFilter?: () => void`（任意、お気に入りフィルタ解除コールバック）
   - **状態別描画ルール**:
     - `isFavoriteFilterActive !== true`（本棚自体に作品が 0 件のとき）: 従来通り `data-testid="bookshelf-empty"` を描画し、「本棚に作品が登録されていません」の案内と検索（`empty-search-button`）・ランキング（`empty-ranking-button`）誘導ボタンを表示する。
     - `isFavoriteFilterActive === true`（登録作品は存在するがお気に入り該当が 0 件のとき）: ルート要素 `data-testid="bookshelf-favorite-empty"` を描画し、見出し「お気に入り登録された作品がありません」、案内文「作品カードの ☆ ボタンや作品詳細画面から、お気に入り（★）に登録できます」、およびフィルタ解除ボタン `data-testid="empty-clear-favorite-filter-button"`（ラベル: `すべての作品を表示`、クリック時に `onClearFavoriteFilter?.()` を呼び出す）を表示する。
3. **`BookshelfPage`（ヘッダーお気に入りフィルタボタン ＆ 空状態出し分け）**:
   - **Props 拡張（`BookshelfPageProps`）**:
     - `favoriteOnly?: boolean`（現在のお気に入りフィルタ ON/OFF 状態、既定値 `false`）
     - `totalNovelsCount?: number`（フィルタ前の本棚登録作品総数、省略時は `novels.length`）
     - `onToggleFavoriteFilter?: () => void`（ヘッダーのお気に入りフィルタトグル押下時コールバック）
     - `onToggleFavoriteNovel?: (novelId: string, nextIsFavorite: boolean) => void`（各作品カードの ★ トグル押下時コールバック）
   - **ヘッダー UI**:
     - ソート選択セレクター（`bookshelf-sort-select`）の左隣（または横並び）に、**お気に入りフィルタトグルボタン `<button type="button" data-testid="bookshelf-favorite-filter-button" aria-pressed={favoriteOnly} aria-label="お気に入りのみ表示">`** を配置する。
     - ラベル: `★`（モバイル幅でも圧迫しないようアイコン＋`お気に入り`、ON 時はアンバー背景・枠線の強調スタイル、OFF 時は通常枠線スタイル。※Milestone v0.8 実機検証 `R2-20` にて、正本 [docs/specs/features/bookshelf.md](../../features/bookshelf.md) ではモバイル狭幅での折り返し防止のため `★` / `☆` アイコンのみ表示へ改訂済み、R2-14）。
     - 手動更新ボタン（`bookshelf-refresh-button`）は、`isCheckingUpdates === true` のときに加え、表示対象作品が 0 件（`novels.length === 0`）のときも `disabled` とする。
   - **メイン領域の排他描画ルール**:
     1. `isLoading === true` の場合: `data-testid="bookshelf-loading"` を描画。
     2. `isLoading === false` かつ `novels.length === 0` の場合:
        - `favoriteOnly === true` かつ `(totalNovelsCount ?? 0) > 0` のときは、`BookshelfEmptyState` を `isFavoriteFilterActive={true}`（`data-testid="bookshelf-favorite-empty"`）で描画し、`onClearFavoriteFilter={onToggleFavoriteFilter}` を渡す。
        - それ以外（本棚全体の登録数が 0 件）のときは、従来の `BookshelfEmptyState`（`data-testid="bookshelf-empty"`）を描画する。
     3. `isLoading === false` かつ `novels.length > 0` の場合: `data-testid="novel-list"` 内に各 `NovelCard`（`onToggleFavorite={onToggleFavoriteNovel}` 付き）を描画する。
4. **`useBookshelf` フック契約の拡張**:
   ```typescript
   export interface UseBookshelfResult {
     novels: NovelSummary[];
     totalNovelsCount: number;
     isLoading: boolean;
     isCheckingUpdates: boolean;
     updateCheckProgress: { current: number; total: number } | null;
     sortOrder: BookshelfSortOrder;
     favoriteOnly: boolean;
     error: string | null;
     setSortOrder: (order: BookshelfSortOrder) => Promise<void>;
     setFavoriteOnly: (favoriteOnly: boolean) => Promise<void>;
     toggleFavoriteFilter: () => Promise<void>;
     toggleFavorite: (
       novelId: string,
       nextIsFavorite?: boolean,
     ) => Promise<void>;
     checkUpdates: (forceAll?: boolean) => Promise<void>;
     reloadNovels: () => Promise<void>;
     clearNovelUpdate: (novelId: string) => Promise<void>;
     deleteNovel?: (novelId: string) => Promise<void>;
     addNovel?: (url: string) => Promise<void>;
   }
   ```
   - **初回ロードとフィルタ復元**:
     - 初回ロード時に `appSettingsRepository.getSetting("bookshelf_sort_order")` と並行して `appSettingsRepository.getSetting("bookshelf_favorite_only")` を取得し、`"true"` の場合は `favoriteOnly = true`、それ以外は `false` に初期化する。
     - 内部 State では全登録作品リスト（`allNovels`）を保持し、`favoriteOnly === true` の場合は `allNovels.filter((n) => n.isFavorite)` を `novels` として返却し、`totalNovelsCount = allNovels.length` を提供する。
   - **お気に入りフィルタ切替と永続化（`setFavoriteOnly` / `toggleFavoriteFilter`）**:
     - 状態変更時に即座に `favoriteOnly` State を更新して表示一覧を切り替え、`appSettingsRepository.setSetting("bookshelf_favorite_only", String(nextValue))` で DB へ永続化する（※Milestone v0.8 レビュー `R1-12` / `R2-08` にて、正本 [docs/specs/features/bookshelf.md](../../features/bookshelf.md) では排他ガード `isTogglingFilterRef` 付きで DB 永続化成功後に State 更新する順序へ改訂済み、R2-14）。
   - **作品のお気に入りトグル（`toggleFavorite`）**:
     - 対象作品の現在値を反転（または `nextIsFavorite` を適用）し、`novelRepository.setFavorite(novelId, targetValue)` を実行する。
     - ローカル State の該当作品の `isFavorite`（および `updatedAt`）を即時更新する（お気に入りフィルタ ON 中にお気に入り解除された作品は即座にフィルタ結果から除外される）。
     - `syncEngine` が存在する場合は `syncEngine.notifyChanged().catch(() => {})` を呼び出す。
   - **更新チェックの対象範囲制御**:
     - 初回ロード時の自動更新チェック（1時間経過判定）は、フィルタ状態に関わらず `allNovels`（全登録作品）から 1時間経過作品を抽出して実行する。
     - 手動一括更新チェック（`checkUpdates(true)`）は、`favoriteOnly === true` のときは **お気に入り作品のみ（`allNovels.filter((n) => n.isFavorite)`）** を対象に実行し、`favoriteOnly === false` のときは `allNovels`（全登録作品）を対象に実行する。

### 2.4 作品詳細・目次画面（`SCR-02`）の UI・Hook 仕様拡張

[docs/specs/features/novel-detail.md](../../features/novel-detail.md) のコンポーネント契約および `useNovelDetail` フック契約を以下の通り拡張します。

1. **`NovelDetailHeader`（お気に入りトグルボタン追加）**:
   - **Props 拡張（`NovelDetailHeaderProps`）**:
     - `onToggleFavorite?: () => void | Promise<void>` を追加する。
   - **UI 構造とセマンティック属性**:
     - 管理アクションバー（右寄せボタン群の先頭）に、**お気に入りトグルボタン `<button type="button" data-testid="detail-favorite-toggle-button" aria-pressed={novel.isFavorite}>`** を配置する。
     - ラベル: `novel.isFavorite === true` のときは `★ お気に入り済み`（アンバー強調スタイル）、`false` のときは `☆ お気に入り`（通常ボタン枠スタイル）（※Milestone v0.8 レビュー `R1-10` / `R2-01` および実機検証 `R2-19` にて、正本 [docs/specs/features/novel-detail.md](../../features/novel-detail.md) では `aria-label="お気に入り"`、固定テキスト `★ お気に入り` / `☆ お気に入り`、常時 1px `border` 維持へ改訂済み、R2-14）。
     - `isRefreshing === true` または `isBatchCaching === true` の間は `disabled` とする。
     - クリック時に `onToggleFavorite?.()` を呼び出す。
2. **`NovelDetailPage` / `NovelDetailContainer` / `useNovelDetail` の拡張**:
   - `NovelDetailPageProps` に `onToggleFavorite?: () => void | Promise<void>` を追加し、`NovelDetailHeader` へ中継する。
   - `UseNovelDetailResult` に `toggleFavorite: () => Promise<boolean>` を追加する。
   - `useNovelDetail.toggleFavorite()`:
     - `novel === null` または他処理実行中（`isRefreshing` / `isBatchCaching` / `isDeleting` / `isClearingCache`）の場合は `false` を返す。
     - `nextIsFavorite = !novel.isFavorite` を算出し、`novelRepository.setFavorite(novelId, nextIsFavorite)` を実行する。
     - 成功時は `novel` State の `isFavorite: nextIsFavorite` および `updatedAt` を即時更新し、`syncEngine?.notifyChanged().catch(() => {})` をスケジュールして `true` を返す。

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 Storage / Cloud Sync 単体テスト（Vitest）

- `src/storage/schema.test.ts`:
  - `initializeDatabaseSchema` 実行時に `app_settings` テーブルへ `bookshelf_favorite_only = 'false'` が初期登録されること。
- `src/storage/repositories/novelRepository.test.ts`:
  - `setFavorite(novelId, true)` により `is_favorite = 1` となり、かつ `updated_at` が更新前より新しい ISO 8601 タイムスタンプに更新されること。
  - `setFavorite(novelId, false)` により `is_favorite = 0` となり、`updated_at` が更新されること。
  - `updateSyncMetadata(novelId, { isFavorite: true, updatedAt: "..." })` により `is_favorite` と `updated_at` が指定値へ更新されること。
- `src/features/cloud-sync/services/syncEngine.test.ts`:
  - `pullAndMerge()` において、ローカルとリモートの双方に存在する作品で `remoteNovel.updatedAt > localNovel.updatedAt` の場合、リモートの `isFavorite`（`0 → 1` および `1 → 0` の双方）と `updatedAt` がローカル DB に反映されること。
  - ローカルの `updatedAt >= remoteNovel.updatedAt` の場合、ローカルの `isFavorite` が維持されること。

### 3.2 UI コンポーネント・Hook 単体テスト ＆ VRT（Vitest / Storybook / Playwright VRT）

- `NovelCard.stories.tsx` / `NovelCard.test.tsx`:
  - `isFavorite: false` 時（`☆`、`aria-pressed="false"`）と `isFavorite: true` 時（`★`、`aria-pressed="true"`）の表示および VRT スナップショット検証。
  - `novel-card-favorite-button` クリック時に `onToggleFavorite(novel.id, !novel.isFavorite)` が呼ばれ、親の `onSelect` が発火しないこと。
- `BookshelfEmptyState.stories.tsx` / `BookshelfEmptyState.test.tsx`:
  - `isFavoriteFilterActive={true}` 時に `bookshelf-favorite-empty` と `empty-clear-favorite-filter-button` が表示され、クリック時に `onClearFavoriteFilter` が呼ばれること（VRT 含む）。
- `BookshelfPage.stories.tsx` / `BookshelfPage.test.tsx` / `BookshelfContainer.test.tsx`:
  - ヘッダーの `bookshelf-favorite-filter-button` の ON/OFF 表示・クリック時の `onToggleFavoriteFilter` 発火、お気に入り 0 件時の `bookshelf-favorite-empty` 描画（VRT 1280px/375px 含む）。
- `useBookshelf.test.ts`:
  - 初回ロード時の `bookshelf_favorite_only` 設定復元、`toggleFavoriteFilter` / `setFavoriteOnly` による絞り込みと DB 永続化。
  - `toggleFavorite` による `novelRepository.setFavorite` 呼び出し、State 即時更新、および `syncEngine.notifyChanged()` 呼び出し。
  - `favoriteOnly === true` 時の手動 `checkUpdates(true)` がお気に入り作品のみを対象に通信・更新し、初回自動更新チェックは全登録作品を対象とすること。
- `NovelDetailHeader.stories.tsx` / `NovelDetailHeader.test.tsx` / `NovelDetailPage.test.tsx` / `NovelDetailContainer.test.tsx` / `useNovelDetail.test.ts`:
  - `detail-favorite-toggle-button` の `isFavorite` 状態表示（`☆ お気に入り` / `★ お気に入り済み`）、通信中 disabled 制御、クリック時の `toggleFavorite` 実行、`novelRepository.setFavorite` および `syncEngine.notifyChanged()` 連携（VRT 含む）。

### 3.3 Playwright システム結合テスト（`SCN-03` / `SCN-05`）

- `test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts`（`SCN-03`）:
  - 本棚カード上の `novel-card-favorite-button` および作品詳細画面の `detail-favorite-toggle-button` からお気に入り登録・解除ができること。
  - 本棚ヘッダーの `bookshelf-favorite-filter-button` を ON にするとお気に入り作品のみに絞り込まれ、既存の 5 種ソートと組み合わせて並び替えできること。
  - ページリロード後も `bookshelf_favorite_only` の ON 状態が復元・維持されること。
  - お気に入りフィルタ ON 中にお気に入りを解除すると即座に一覧から消え、0 件になった際に `bookshelf-favorite-empty` が表示され、「すべての作品を表示」（`empty-clear-favorite-filter-button`）押下でフィルタが解除され全作品が再表示されること。
- `test/it/scenarios/scn05-cloud-sync.spec.ts`（`SCN-05`）:
  - お気に入りトグル操作によりデバウンス自動 Push が発火し、リモート JSON（`yommy-sync-state.json`）内の該当作品の `isFavorite: 1` および更新された `updatedAt` が保存されること。
  - 既存作品に対してリモート側で `isFavorite` および新しい `updatedAt` が更新された状態で Pull（同期）を実行すると、ローカルの本棚・作品詳細にお気に入り状態が反映されること。

---

## 4. 実装 Sub-issue 分割計画

1. **Sub-issue ①（#281: MK1）**: Storage 層（`NovelRepository.setFavorite` / `updateSyncMetadata`、`schema.ts` の `bookshelf_favorite_only`）および `SyncEngine.mergeExistingNovel` 双方向 LWW マージ実装と単体テスト（Gate 1〜6 通過後に AI 自律マージ）
2. **Sub-issue ②（#282: MK2）**: 本棚画面（`SCR-01`）・作品詳細画面（`SCR-02`）のお気に入りトグル・本棚フィルタ UI / Hook 実装、1対1 Story/UT、および VRT（1280px / 375px）更新（Gate 1〜6 通過後に AI 自律マージ）
3. **Sub-issue ③（#283: IT）**: Playwright 結合テスト（`SCN-03` / `SCN-05`）拡充および差分仕様書の `docs/specs/changes/archive/` 移動（人間マージで親 Issue #266 クローズ）

---

## 5. 申し送り事項（Handover Items: `HO-xx`）・実機検証計画

- **Android 実機検証の実施タイミング判断**:
  - **判定**: **B. Milestone 最終レビュー後に一括で実機検証を実施（完了ゲート: `Milestone v0.8 完了前` / Issue #267）**
  - **理由**: 本要望は既存の SQLite `novels.is_favorite` カラムおよび Google Drive 同期 JSON スキーマ（`SyncNovelData.isFavorite`）を活用した Storage / React UI 拡張であり、Android ネイティブ Java プラグインの変更や物理ジェスチャー制御を伴わないため、Milestone `v0.8` 完了時の実機一括検証（`HO-32`）で効率的に確認可能である。
- **登録する申し送り事項**:
  - **`HO-32`**: 本棚・作品詳細でのお気に入り（★）登録/解除、本棚お気に入りフィルタ・永続化、および Google Drive クラウド同期での双方向お気に入り反映の Android 実機確認（完了ゲート: `Milestone v0.8 完了前` / Issue #267）。
