---
type: spec-feature
title: "本棚画面仕様書（SCR-01: Bookshelf）"
description: "登録済み小説カード一覧の表示、お気に入り（★）登録・絞り込みフィルタ、しおり位置からのワンタップ読書再開、および検索・ランキング画面への誘導を提供する本棚画面（SCR-01）の正本仕様。"
status: "Review (#266)"
updated: "2026-11-07"
tags:
  - bookshelf
  - scr-01
  - routing
  - ui
  - shell
  - bottom-nav
  - update-check
  - sort
  - favorite
  - filter
  - cloud-sync
  - google-drive
  - narou
  - multi-page-toc
  - ho-32
related_specs:
  - docs/specs/changes/issue-266-bookshelf-favorite-and-sync.md
  - docs/specs/changes/archive/issue-239-narou-parser-and-multi-page-toc.md
  - docs/specs/parsers/narou.md
  - docs/specs/changes/archive/issue-120-cloud-sync-google-drive.md
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/archive/issue-78-apk-signing-and-back-button.md
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
  - docs/specs/changes/archive/issue-80-bookshelf-update-check-and-sort.md
  - docs/specs/changes/archive/issue-50-fullscreen-shell-and-settings.md
  - docs/specs/changes/archive/issue-12-bookshelf-and-routing.md
related_tests:
  - src/App.test.tsx
  - src/features/bookshelf/hooks/useBookshelf.test.ts
  - src/features/bookshelf/components/BookshelfEmptyState.test.tsx
  - src/features/bookshelf/components/NovelCard.test.tsx
  - src/features/bookshelf/components/BookshelfPage.test.tsx
  - src/features/bookshelf/components/BookshelfContainer.test.tsx
  - test/it/smoke.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
  - test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts
  - test/it/scenarios/scn05-cloud-sync.spec.ts
---

# 本棚画面仕様書（SCR-01）

本ドキュメントは、Yommy のホーム画面である **本棚画面（`SCR-01`: ルート `/`）** の画面構成、Presentational / Container コンポーネント契約、作品の自動更新チェック・NEW表示解除、本棚5種ソート機能、お気に入り（★）登録・お気に入り絞り込みフィルタ、および受入条件（`AC-BS-xx`）を定める正本（Single Source of Truth）です。

> [!NOTE]
> **v0.3（Issue #79, #80）および v0.8（Issue #266）における本棚機能の拡充**:
>
> - **登録導線の一本化（#79）**: 直接 URL 入力機能を廃止し、検索画面（`SCR-06: /search`）およびランキング画面（`SCR-07: /ranking`）からのワンタップ登録へ一本化。
> - **自動更新チェックと NEW バッジ表示・解除（#80）**: 本棚表示時に1時間経過作品をバックグラウンド順次チェックし、新着話検知で「NEW」バッジを表示。作品閲覧（SCR-02/SCR-03）時に自動解除。
> - **本棚 5 種ソート切替と永続化（#80）**: ヘッダーで「更新あり優先（デフォルト）」「最近読んだ順」「作品更新日順」「登録日順」「タイトル順」を切り替え・DB永続化。
> - **作品のお気に入り（★）登録・本棚お気に入りフィルタ・クラウド同期連携（#266）**: 作品カードおよび作品詳細ヘッダーでのワンタップお気に入り登録/解除（`updated_at` 同時更新・自動 Push / Pull LWW マージ）、本棚ヘッダーのお気に入り絞り込みトグル（`bookshelf_favorite_only` DB 永続化・お気に入り 0 件時の専用空状態・フィルタ連動の手動更新チェック）に対応。

---

## 1. 概要・スコープ

- **対象画面**: 本棚画面（`SCR-01`、ルートパス `/`）
- **対応要件**:
  - `SYS-REQ-01`（作品登録・目次取得：検索・ランキングからの登録への一本化に伴い、本棚画面は登録済み作品の閲覧・管理に専念）
  - `SYS-REQ-02`（本文取得・オフライン閲覧：未キャッシュ話に対する「続きから読む」遷移時のオンデマンド本文取得導線）
  - `SYS-REQ-04`（作品の自動更新チェック・「NEW」バッジ表示/解除・手動一括更新・本棚5種ソート切り替えと永続化・作品のお気に入り登録/解除と本棚お気に入り絞り込みフィルタ）
  - `SYS-REQ-06`（クラウド同期連携：アプリ起動時・バックグラウンド復帰時の自動 Pull による新規作品・しおり・既読・お気に入り状態の LWW 反映、作品追加・削除・お気に入り変更時の自動 Push、削除時の Tombstone 記録）
  - `SYS-REQ-12`（しおり・スクロール位置自動保存に基づく読書再開導線）
  - `SYS-REQ-16`（100dvh 全画面シェル・下部 4 タブバー固定・作品一覧内部縦スクロール）
  - `SYS-REQ-20`（下部 4 タブナビゲーション）
- **関連画面遷移**:
  - `TR-01`（下部タブ「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」タップによる各画面への遷移）
  - `TR-01b`（下部タブ「本棚」タップによる本棚トップ `/` への直接復帰遷移）
  - `TR-02`（作品カード本体タップによる作品詳細・目次画面 `SCR-02` `/novels/:novelId` への遷移、および NEW 解除）
  - `TR-03`（「続きから読む」ボタンタップによる小説リーダー画面 `SCR-03` `/novels/:novelId/chapters/:chapterIndex` への直接遷移、および NEW 解除）
  - `TR-13`（OSバックキーによる2秒以内連続2回押下でのアプリ終了UX・1回目トースト表示）
  - `TR-15`（空状態からの検索画面 `SCR-06` またはランキング画面 `SCR-07` への遷移）
  - `TR-16`（本棚ソート順・お気に入りフィルタ切り替え：ヘッダーのセレクターおよびお気に入りトグル操作による一覧の即時並び替え・絞り込みと永続化）
  - `TR-17`（手動一括更新チェック：ヘッダーの更新ボタン押下による非同期バックグラウンド目次再取得とNEW表示反映。お気に入りフィルタ ON 時は表示中のお気に入り作品のみ対象）
- **対象外スコープ（後続 Milestone）**:
  - アプリ非起動時（OS ネイティブ WorkManager 等）のバックグラウンドプッシュ通知

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/bookshelf/` 配下を以下のモジュール構成とします（`AddNovelDialog` は廃止）。

```text
src/features/bookshelf/
├── hooks/
│   ├── useBookshelf.ts                    # 本棚一覧取得・状態管理フック
│   └── useBookshelf.test.ts               # フック単体テスト（Vitest）
└── components/
    ├── BookshelfEmptyState.tsx            # 未登録時またはお気に入り0件時の空状態案内 UI（Presentational）
    ├── BookshelfEmptyState.stories.tsx
    ├── BookshelfEmptyState.test.tsx
    ├── NovelCard.tsx                      # 登録済み1作品のカード表示・お気に入りトグル UI（Presentational）
    ├── NovelCard.stories.tsx
    ├── NovelCard.test.tsx
    ├── BookshelfPage.tsx                  # 本棚画面全体のレイアウト統合コンポーネント（Presentational）
    ├── BookshelfPage.stories.tsx
    ├── BookshelfPage.test.tsx
    ├── BookshelfContainer.tsx             # ServiceProvider / Router / useBookshelf を接続する Container
    ├── BookshelfContainer.stories.tsx
    └── BookshelfContainer.test.tsx
```

---

## 3. 各コンポーネント・フックの詳細契約

### 3.1 `NovelCard`（登録済み作品カード）

登録済みの 1 作品（`NovelSummary`）を表示し、お気に入り（★）の登録・解除、作品詳細画面への遷移（`TR-02`）、およびリーダー画面での読書再開（`TR-03`）をトリガーする Presentational コンポーネントです。

#### プロパティ契約（`NovelCardProps`）

| プロパティ名       | 型                                                   | 必須 | 説明                                                                 |
| :----------------- | :--------------------------------------------------- | :--- | :------------------------------------------------------------------- |
| `novel`            | `NovelSummary`                                       | 必須 | 表示対象の作品サマリーレコード                                       |
| `onSelect`         | `(novelId: string) => void`                          | 必須 | カード本体（タイトル・情報領域）タップ時のコールバック（`TR-02` 用） |
| `onResume`         | `(novelId: string, chapterIndex: number) => void`    | 必須 | 「続きから読む」ボタンタップ時のコールバック（`TR-03` 用）           |
| `onToggleFavorite` | `(novelId: string, nextIsFavorite: boolean) => void` | 任意 | お気に入り（★）トグルボタンタップ時のコールバック（Issue #266）      |

#### 表示項目とセマンティック属性

- **ルート要素**: `data-testid="novel-card"`、`data-novel-id={novel.id}`
- **表示情報**:
  - **作品タイトル**: `data-testid="novel-card-title"`（`novel.title`）
  - **著者名**: `data-testid="novel-card-author"`（`novel.author`、空文字の場合は「著者不明」等を表示）
  - **NEW（更新あり）バッジ**: `data-testid="novel-card-new-badge"`
    - `novel.hasNewUpdate === true` の場合に目立つバッジ（テキスト: `NEW`）を表示する。`novel.hasNewUpdate === false` の場合は描画しない。
  - **話数・キャッシュ進捗**: `data-testid="novel-card-chapters"`
    - `全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話）` の形式で表示する。
  - **しおり位置バッジ**: `data-testid="novel-card-bookmark"`
    - `novel.bookmarkChapterIndex !== null` の場合: `しおり: 第{novel.bookmarkChapterIndex}話`
    - `novel.bookmarkChapterIndex === null` の場合: `未読`
- **操作アクション**:
  - **お気に入り（★）トグルボタン（`v0.8` Issue #266）**: `data-testid="novel-card-favorite-button"`
    - `<button>` の入れ子を避けるため、`novel-card-select` ボタンとは独立した兄弟要素としてカード右上（しおり位置バッジの横）に配置する。
    - セマンティック属性: `aria-pressed={novel.isFavorite}`、`aria-label={novel.isFavorite ? `${novel.title}のお気に入りを解除`:`${novel.title}をお気に入りに登録`}`。
    - 表示: `novel.isFavorite === true` のときは `★`（アンバー色強調）、`false` のときは `☆`（スレート色）。
    - クリック時に `e.stopPropagation()` を行い、`onToggleFavorite?.(novel.id, !novel.isFavorite)` を呼び出す（`onSelect` と二重発火しないこと）。
  - **カード詳細遷移ボタン/領域**: `data-testid="novel-card-select"`
    - クリック時に `onSelect(novel.id)` を呼び出す。
  - **「続きから読む」ボタン**: `data-testid="novel-card-resume"`
    - ラベル: `novel.bookmarkChapterIndex !== null` の場合は `第{novel.bookmarkChapterIndex}話から読む`（または `続きから読む`）、`null` の場合は `第1話から読む`（または `続きから読む`）。
    - クリック時にターゲット話数 `targetChapter = novel.bookmarkChapterIndex ?? 1` を引数として `onResume(novel.id, targetChapter)` を呼び出す（親カードへのクリックイベント伝播 `stopPropagation` を制御し、`onSelect` と二重発火しないこと）。

---

### 3.2 `BookshelfEmptyState`（未登録時・お気に入り 0 件時の空状態 UI）

本棚に登録作品が 0 件のとき（検索・ランキングへの誘導）、またはお気に入りフィルタ ON 時にお気に入り作品が 0 件のとき（フィルタ解除導線）に表示される Presentational コンポーネントです。

#### プロパティ契約（`BookshelfEmptyStateProps`）

| プロパティ名             | 型           | 必須 | 説明                                                                        |
| :----------------------- | :----------- | :--- | :-------------------------------------------------------------------------- |
| `onNavigateSearch`       | `() => void` | 任意 | 「小説を検索する」ボタン押下時のコールバック（`TR-15` 用）                  |
| `onNavigateRanking`      | `() => void` | 任意 | 「ランキングを見る」ボタン押下時のコールバック（`TR-15` 用）                |
| `isFavoriteFilterActive` | `boolean`    | 任意 | お気に入りフィルタ ON による 0 件状態かどうか（既定値 `false`, Issue #266） |
| `onClearFavoriteFilter`  | `() => void` | 任意 | 「すべての作品を表示」フィルタ解除ボタン押下時のコールバック（Issue #266）  |

#### セマンティック属性と状態別描画

1. **通常空状態（`isFavoriteFilterActive !== true`：本棚登録作品が 0 件のとき）**:
   - **ルート要素**: `data-testid="bookshelf-empty"`
   - **案内テキスト**: 「本棚に作品が登録されていません」「作品を検索したりランキングから探して、本棚に追加しましょう」等の案内文
   - **誘導ボタン**:
     - **検索誘導ボタン**: `data-testid="empty-search-button"`（クリックで `onNavigateSearch?.()` を呼び出す）
     - **ランキング誘導ボタン**: `data-testid="empty-ranking-button"`（クリックで `onNavigateRanking?.()` を呼び出す）
2. **お気に入り 0 件空状態（`isFavoriteFilterActive === true`：登録作品は存在するがお気に入り該当が 0 件のとき）**:
   - **ルート要素**: `data-testid="bookshelf-favorite-empty"`
   - **案内テキスト**: 「お気に入り登録された作品がありません」「作品カードの ☆ ボタンや作品詳細画面から、お気に入り（★）に登録できます」等の案内文
   - **フィルタ解除ボタン**: `data-testid="empty-clear-favorite-filter-button"`（ラベル: `すべての作品を表示`、クリックで `onClearFavoriteFilter?.()` を呼び出す）

---

### 3.3 `BookshelfPage`（本棚画面 Presentational コンポーネント）

ヘッダータイトル、お気に入りフィルタ切替ボタン、ソート切り替えセレクター、手動更新チェックボタン、作品カード一覧（または空状態 UI）を統合配置する画面コンポーネントです。

#### プロパティ契約（`BookshelfPageProps`）

| プロパティ名             | 型                                                   | 必須 | 説明                                                            |
| :----------------------- | :--------------------------------------------------- | :--- | :-------------------------------------------------------------- |
| `novels`                 | `NovelSummary[]`                                     | 必須 | 表示対象の作品一覧（お気に入りフィルタ適用後）                  |
| `totalNovelsCount`       | `number`                                             | 任意 | フィルタ前の本棚登録作品総数（省略時は `novels.length`）        |
| `isLoading`              | `boolean`                                            | 必須 | 初回一覧読み込み中フラグ                                        |
| `isCheckingUpdates`      | `boolean`                                            | 任意 | 更新チェック実行中フラグ                                        |
| `updateCheckProgress`    | `{ current: number; total: number } \| null`         | 任意 | 更新チェック進捗状況（進行中のみオブジェクト）                  |
| `sortOrder`              | `BookshelfSortOrder`                                 | 任意 | 現在選択されているソート順                                      |
| `favoriteOnly`           | `boolean`                                            | 任意 | お気に入りフィルタ ON/OFF 状態（既定値 `false`, Issue #266）    |
| `onSortChange`           | `(order: BookshelfSortOrder) => void`                | 任意 | ソート順選択変更時のコールバック（`TR-16` 用）                  |
| `onToggleFavoriteFilter` | `() => void`                                         | 任意 | ヘッダーのお気に入りフィルタトグル押下時コールバック（`TR-16`） |
| `onToggleFavoriteNovel`  | `(novelId: string, nextIsFavorite: boolean) => void` | 任意 | 各作品カードの ★ トグル押下時コールバック（Issue #266）         |
| `onCheckUpdates`         | `() => void`                                         | 任意 | 手動更新チェックボタン押下時のコールバック（`TR-17` 用）        |
| `onNavigateSearch`       | `() => void`                                         | 任意 | 空状態時の検索画面遷移コールバック                              |
| `onNavigateRanking`      | `() => void`                                         | 任意 | 空状態時のランキング画面遷移コールバック                        |
| `onSelectNovel`          | `(novelId: string) => void`                          | 必須 | 作品カード本体タップ時（`TR-02`）                               |
| `onResumeNovel`          | `(novelId: string, chapterIndex: number) => void`    | 必須 | 「続きから読む」ボタンタップ時（`TR-03`）                       |

#### セマンティック属性と状態別描画ルール

- **画面ルート**: `data-testid="bookshelf-page"`
- **ヘッダー**:
  - タイトル: 「📚 本棚」を固定表示。
  - **お気に入りフィルタトグルボタン（`v0.8` Issue #266）**: `data-testid="bookshelf-favorite-filter-button"`
    - `aria-pressed={favoriteOnly}`、`aria-label="お気に入りのみ表示"`
    - 表示ラベル: `favoriteOnly === true` のときは `★`＋`お気に入り`（アンバー色背景・枠線の強調スタイル）、`false` のときは `☆`＋`お気に入り`（通常枠線スタイル）。
    - クリック時に `onToggleFavoriteFilter?.()` を呼び出す。
  - **ソート選択セレクター**: `data-testid="bookshelf-sort-select"`
    - 5 つの `<option>` を提供：
      1. `value="unread_first"`: `更新あり優先`（既定値）
      2. `value="last_read"`: `最近読んだ順`
      3. `value="latest_published"`: `作品更新日順`
      4. `value="created_at"`: `登録日順`
      5. `value="title"`: `タイトル順`
  - **手動更新チェックボタン**: `data-testid="bookshelf-refresh-button"`
    - `aria-label="一括更新チェック"`
    - `isCheckingUpdates === true` または表示中の対象作品が 0 件（`novels.length === 0`）のときは `disabled` 状態となり、実行中は回転スピナーまたは処理中表示となる。
  - **更新進行状況表示**: `data-testid="bookshelf-refresh-progress"`
    - `updateCheckProgress` が存在するとき、`更新中 ({current}/{total})...` の形式で進行状況を表示する。
- **メイン領域の排他描画ルール**:
  1. `isLoading === true` の場合: ローディング表示要素 `data-testid="bookshelf-loading"` を描画し、`bookshelf-empty` / `bookshelf-favorite-empty` および `novel-list` は描画しない。
  2. `isLoading === false` かつ `novels.length === 0` の場合:
     - `favoriteOnly === true` かつ `(totalNovelsCount ?? 0) > 0` の場合: `BookshelfEmptyState` を `isFavoriteFilterActive={true}`（`data-testid="bookshelf-favorite-empty"`）で描画し、`onClearFavoriteFilter={onToggleFavoriteFilter}` を渡す。
     - それ以外（本棚全体の登録作品が 0 件）の場合: `BookshelfEmptyState`（`data-testid="bookshelf-empty"`）を描画する。
  3. `isLoading === false` かつ `novels.length > 0` の場合: 作品一覧コンテナ `data-testid="novel-list"` を描画し、その配下に各作品の `NovelCard`（`onToggleFavorite={onToggleFavoriteNovel}` 付き）を描画する。

---

### 3.4 `BookshelfContainer`（本棚画面 Container コンポーネント）

`useBookshelf` フックおよびルーター遷移コールバックを接続し、`BookshelfPage` を描画する Container コンポーネントです。

#### プロパティ契約（`BookshelfContainerProps`）

| プロパティ名    | 型                                                | 必須 | 説明                                                                                                                        |
| :-------------- | :------------------------------------------------ | :--- | :-------------------------------------------------------------------------------------------------------------------------- |
| `onSelectNovel` | `(novelId: string) => void`                       | 任意 | 作品カード本体タップ時の遷移コールバック（省略時は `clearNovelUpdate` 実行後に `useRouter().navigateToNovelDetail` を使用） |
| `onResumeNovel` | `(novelId: string, chapterIndex: number) => void` | 任意 | 「続きから読む」タップ時の遷移コールバック（省略時は `clearNovelUpdate` 実行後に `useRouter().navigateToReader` を使用）    |

---

## 4. `useBookshelf` フック契約

```typescript
export type BookshelfSortOrder =
  "unread_first" | "last_read" | "latest_published" | "created_at" | "title";

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
  toggleFavorite: (novelId: string, nextIsFavorite?: boolean) => Promise<void>;
  checkUpdates: (forceAll?: boolean) => Promise<void>;
  reloadNovels: () => Promise<void>;
  clearNovelUpdate: (novelId: string) => Promise<void>;
  deleteNovel?: (novelId: string) => Promise<void>;
  addNovel?: (url: string) => Promise<void>;
}
```

1. **初回ロード・ソート順およびお気に入りフィルタ復元**:
   - `ServiceProvider` の `isReady === true` 後、`appSettingsRepository.getSetting("bookshelf_sort_order")` から前回保存されたソート順を取得（未設定時は `"unread_first"`）し、`appSettingsRepository.getSetting("bookshelf_favorite_only")` からお気に入りフィルタ状態を取得（`"true"` のとき `true`、未設定または `"false"` のとき `false`）する。
   - `novelRepository.listNovels(sortOrder)` を呼び出して全登録作品を取得し、`totalNovelsCount` に全件数を、`favoriteOnly === true` の場合は `isFavorite === true` の作品のみに絞り込んだ配列を `novels` として返却・描画する。
2. **自動更新チェック（1時間経過判定・レートリミット順次実行）**:
   - 初回ロード完了後、お気に入りフィルタの ON/OFF に関わらず、全登録作品のうち `lastCheckedAt === null` または `lastCheckedAt` が現在時刻から1時間（3,600,000ms）以上経過している作品を抽出する。
   - 対象作品が1件以上ある場合、`isCheckingUpdates = true` とし、対象サーバー負荷軽減のため 1.0秒（1000ms）のウェイト間隔を挟みながら順次 `fetchFullNovelIndex`（`nextTocPageUrl` による複数ページ目次連続取得・結合対応、Issue #239）および `novelRepository.upsertNovelWithToc` 経由で目次を再取得する。
   - 既存の `totalChapters` より増加したエピソード、または新規エピソードが検知された作品には `has_new_update = 1` を記録し、`last_checked_at` を現在時刻に更新する。
   - チェック完了後、一覧をリフレッシュして `isCheckingUpdates = false` に戻す（ソート順が `unread_first` の場合は新着作品が最上部へ自動浮上する）。
3. **手動一括更新チェック（`checkUpdates(true)`）**:
   - ヘッダーの更新ボタン押下時、1時間経過条件にかかわらず、お気に入りフィルタが ON（`favoriteOnly === true`）のときは **お気に入り登録作品のみ** を対象とし、OFF のときは **全登録作品** を対象にバックグラウンド順次更新チェックを開始する。
4. **ソート順およびお気に入りフィルタ変更と永続化（`setSortOrder` / `setFavoriteOnly` / `toggleFavoriteFilter`）**:
   - ソート順変更時、即時に `appSettingsRepository.setSetting("bookshelf_sort_order", order)` で DB に永続化し、指定順序で `novelRepository.listNovels(order)` を再取得して画面を更新する。
   - お気に入りフィルタ変更時、即時に `favoriteOnly` State を更新して表示一覧を切り替え、`appSettingsRepository.setSetting("bookshelf_favorite_only", String(favoriteOnly))` で DB に永続化する。
5. **作品のお気に入り登録・解除（`toggleFavorite`、`v0.8` Issue #266）**:
   - `novelRepository.setFavorite(novelId, nextIsFavorite)` を呼び出し、SQLite の `novels.is_favorite` と `novels.updated_at`（現在時刻 ISO 8601）を同時更新する。
   - ローカル State の該当作品の `isFavorite` および `updatedAt` を即時更新する（`favoriteOnly === true` のときにお気に入り解除すると即座に表示一覧から除外される）。
   - `syncEngine` が存在する場合は `syncEngine.notifyChanged()` を呼び出し、デバウンス自動 Push をスケジュールする。
6. **「NEW（更新あり）」解除（`clearNovelUpdate`）**:
   - 作品カードタップ（`TR-02`）または「続きから読む」タップ（`TR-03`）時に、`novelRepository.clearNewUpdate(novelId)` を呼び出し、対象作品の `has_new_update = 0` に更新してバッジを消去する。
7. **クラウド同期連携（自動 Pull / 自動 Push / Tombstone 記録: v0.4 Issue #120 / v0.7 Issue #239 / v0.8 Issue #266 拡張）**:
   - アプリ起動時およびバックグラウンド復帰時（休止から5分以上経過時）に、`SyncEngine.pullAndMerge()` がバックグラウンド実行され、リモートの新規作品・更新されたしおり話数・お気に入り状態（`updatedAt` LWW 比較）が本棚一覧へ自動反映される。未登録作品は `fetchFullNovelIndex`（複数ページ目次連続取得・結合対応）および `upsertNovelWithToc` により目次が自動取得される。
   - 作品の追加（検索/ランキングからの登録、または `addNovel` 実行時［`fetchFullNovelIndex` 経由で全ページ目次を取得・保存］）、作品の削除（`deleteNovel`）、およびお気に入り状態の変更（`toggleFavorite`）時に、`SyncEngine.notifyChanged()` が呼び出され、2〜3秒デバウンス付きで自動 Push される。
   - 作品削除時（`novelRepository.deleteNovel`）は、カスケード削除と同時に `deleted_novels` テーブルへ該当 ID と削除日時（ミリ秒タイムスタンプ `Date.now()`）を記録し、次回 Push 時にリモート Tombstone へ結合する。

---

## 5. 受入条件一覧（Acceptance Criteria: `AC-BS-xx`）

| AC ID          | 対象機能                                                       | 検証条件                                                                                                                                                                                                                                                                                                                                                                                                                 | 関連要件 / 遷移                                |
| :------------- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------- |
| **`AC-BS-01`** | 空状態表示と検索・ランキング誘導                               | 登録作品が 0 件のとき、`bookshelf-empty` が表示され、「小説を検索する」ボタン（`empty-search-button`）および「ランキングを見る」ボタン（`empty-ranking-button`）からそれぞれ `/search` および `/ranking` へ遷移できること。                                                                                                                                                                                              | `SYS-REQ-01` / `TR-15`                         |
| **`AC-BS-02`** | （廃止）                                                       | v0.3 にて直接 URL 入力機能は廃止され、検索・ランキングからの登録へ一本化。                                                                                                                                                                                                                                                                                                                                               | -                                              |
| **`AC-BS-03`** | （廃止）                                                       | v0.3 にて URL 入力ダイアログは廃止。                                                                                                                                                                                                                                                                                                                                                                                     | -                                              |
| **`AC-BS-04`** | 作品カード情報表示                                             | 登録済み作品カードにタイトル、著者名、全話数・取得済み話数（`totalChapters` / `cachedChapters`）、およびしおり位置（`bookmarkChapterIndex` または `未読`）が正確に表示されること。                                                                                                                                                                                                                                       | `SYS-REQ-01`, `SYS-REQ-12`                     |
| **`AC-BS-05`** | 作品詳細画面への遷移                                           | 作品カード本体（`novel-card-select`）をタップすると、対象作品の詳細・目次画面（`/novels/:novelId`）へ遷移（`TR-02`）すること。                                                                                                                                                                                                                                                                                           | `SYS-REQ-01` / `TR-02`                         |
| **`AC-BS-06`** | 続きから読むワンタップ起動                                     | 作品カードの「続きから読む」ボタン（`novel-card-resume`）をタップすると、`bookmarkChapterIndex`（未設定時は第1話）のリーダー画面（`/novels/:novelId/chapters/:chapterIndex`）へ直接遷移（`TR-03`）し、未キャッシュ時は本文をオンデマンド取得して表示すること。                                                                                                                                                           | `SYS-REQ-02`, `SYS-REQ-12` / `TR-03`           |
| **`AC-BS-07`** | 全画面シェルと下部4タブ固定                                    | 画面全体が 100dvh 固定シェルに収まりウィンドウスクロールが発生せず、画面上部ヘッダー固定、作品カード一覧が枠内縦スクロール（`overflow-y-auto`）可能で、画面最下部に下部タブバー（`BottomTabBar`）が 4 タブ構成で「本棚」アクティブ状態で固定表示されること。                                                                                                                                                             | `SYS-REQ-16`, `SYS-REQ-20` / `TR-01`, `TR-01b` |
| **`AC-BS-08`** | 新着検知と「NEW」バッジ表示                                    | 目次再取得により新規エピソード（話数増加）が検知された作品に `has_new_update = 1` が記録され、本棚の作品カード（`NovelCard`）上に「NEW」バッジ（`novel-card-new-badge`）が表示されること。更新がない作品には表示されないこと。                                                                                                                                                                                           | `SYS-REQ-04`                                   |
| **`AC-BS-09`** | 作品閲覧による「NEW」バッジ解除                                | 「NEW」バッジが表示された作品カード本体タップ（`novel-card-select`、`TR-02`）または「続きから読む」ボタン押下（`novel-card-resume`、`TR-03`）により作品詳細またはリーダーを開いた時点で、対象作品の `has_new_update` が解除（0）され、バッジが消去されること。                                                                                                                                                           | `SYS-REQ-04` / `TR-02`, `TR-03`                |
| **`AC-BS-10`** | 自動更新チェックと手動一括更新                                 | 本棚表示時に前回更新確認から1時間以上経過した全登録作品を対象に、ウェイト間隔（1秒）付きでバックグラウンド順次更新チェックが実行されること。またヘッダーの更新ボタン（`bookshelf-refresh-button`）から更新チェックを手動で即時トリガーでき（お気に入りフィルタ ON 時は表示中のお気に入り作品のみ対象、OFF 時は全作品対象）、進行中は進捗が表示されること。                                                               | `SYS-REQ-04` / `TR-17`                         |
| **`AC-BS-11`** | 本棚5種ソート切り替えと永続化                                  | 本棚ヘッダーのソートセレクター（`bookshelf-sort-select`）から5種類のソート順を切り替えることができ、一覧が即時正しく並び替わり、選択結果が DB に永続化され、アプリ再起動後も同一の並び順が維持されること。                                                                                                                                                                                                               | `SYS-REQ-04` / `TR-16`                         |
| **`AC-BS-12`** | OS バックキー2回押下でのアプリ終了                             | 本棚画面での OS バックキー2秒以内2回押下によるアプリ終了および1回目押下時のトースト表示 (TR-13)。                                                                                                                                                                                                                                                                                                                        | `SYS-REQ-16` / `TR-13`                         |
| **`AC-BS-13`** | クラウド同期連携（自動Pull・作品追加/削除/お気に入り変更Push） | アプリ起動時または5分以上バックグラウンド休止後の復帰時に自動Pullが実行され、リモートの新規作品・しおり・既読・お気に入り状態（`updatedAt` LWW）が本棚へ反映されること。また作品追加・削除・お気に入り変更時に自動Pushがデバウンス実行され、作品削除時は `deleted_novels` へTombstoneが記録されること。未連携（unlinked）時は Pull/Push をスキップすること（R1-14）。                                                    | `SYS-REQ-06`                                   |
| **`AC-BS-14`** | 作品カードでのお気に入り登録・解除                             | 本棚の各作品カード（`NovelCard`）上のお気に入りトグルボタン（`novel-card-favorite-button`）をタップすると、作品詳細画面へ遷移することなくその場でお気に入り状態（`★` / `☆`、`aria-pressed`）が切り替わり、SQLite の `novels.is_favorite` と `novels.updated_at` が同時更新されること。                                                                                                                                   | `SYS-REQ-04`, `SYS-REQ-06`                     |
| **`AC-BS-15`** | 本棚お気に入りフィルタ切替・永続化・0件空状態                  | 本棚ヘッダーのお気に入りフィルタボタン（`bookshelf-favorite-filter-button`）をタップするとお気に入り登録作品のみの表示と全件表示を即時切り替えられ、5種ソート順と組み合わせて機能し、選択状態が `app_settings`（`bookshelf_favorite_only`）に永続化されること。またフィルタ ON 時に該当作品が 0 件の場合は専用空状態（`bookshelf-favorite-empty`）と解除ボタン（`empty-clear-favorite-filter-button`）が表示されること。 | `SYS-REQ-04` / `TR-16`                         |

---

## 6. Playwright システム結合テスト（E2E シナリオ連携）

本棚画面（`SCR-01`）に関連する E2E 動作は、`test/it/scenarios/` 配下の以下のシナリオで継続回帰検証されます（詳細は [docs/specs/screen-transitions.md §4](../screen-transitions.md#4-playwright-システム結合テストe2e-シナリオ-scn-01--scn-06マッピング) を参照）：

- **`SCN-01`（`test/it/scenarios/scn01-poc-vertical-reader.spec.ts`）**: 空状態表示、作品カード表示、作品詳細遷移、「続きから読む」によるリーダー直行としおり復元（`TR-02`, `TR-03`, `AC-BS-01`〜`07`）。
- **`SCN-02`（`test/it/scenarios/scn02-search-ranking-discovery.spec.ts`）**: 空状態からの検索・ランキング画面への誘導導線および探索画面からの作品追加反映（`TR-15`, `AC-BS-01`）。
- **`SCN-03`（`test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts`）**: 本棚表示時の自動/手動一括更新チェック、「NEW」バッジ表示と作品詳細/リーダー閲覧による解除、5種ソート切替と永続化、お気に入り登録・解除、本棚お気に入りフィルタ切替・永続化・0件空状態・フィルタ連動手動更新、OS バックキー2回押下終了トースト（`TR-02`, `TR-03`, `TR-13`, `TR-16`, `TR-17`, `AC-BS-08`〜`12`, `14`, `15`）。
- **`SCN-05`（`test/it/scenarios/scn05-cloud-sync.spec.ts`）**: Google Drive クラウド同期によるリモート作品・しおり・既読・お気に入り状態（LWW）の本棚自動反映およびお気に入り変更・作品削除時の自動 Push / Tombstone 伝播（`AC-BS-13`, `14`）。
