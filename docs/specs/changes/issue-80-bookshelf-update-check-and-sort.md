---
type: spec-delta
title: "作品の自動更新チェック（NEWバッジ表示・解除）と本棚ソート機能（5種切替）の設計"
description: "Issue #80 に対する差分仕様、影響する全体正本、テスト計画、および実装Sub-issue分割計画。"
issue: "#80"
status: "Review (#80)"
updated: "2026-10-29"
tags:
  - delta
  - bookshelf
  - update-check
  - new-badge
  - sort
  - sqlite
  - app-settings
  - scr-01
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/settings.md
related_tests:
  - src/storage/schema.test.ts
  - src/storage/repositories/novelRepository.test.ts
  - src/features/bookshelf/hooks/useBookshelf.test.ts
  - src/features/bookshelf/components/NovelCard.test.tsx
  - src/features/bookshelf/components/BookshelfPage.test.tsx
  - src/features/bookshelf/components/BookshelfContainer.test.tsx
  - src/App.test.tsx
  - test/it/smoke.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：作品の自動更新チェック（NEWバッジ表示・解除）と本棚ソート機能（5種切替）（Issue #80）

本ドキュメントは、Issue #80「`[v0.3] 作品の自動更新チェック（NEWバッジ表示・解除）と本棚ソート機能（5種切替）の実装`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **現状の課題（v0.2 まので運用課題）**:
  - 連載中の Web 小説を追いかける際、ユーザーは各作品の詳細画面（`SCR-02`）を1つずつ開いて「目次を更新」ボタンを押さなければ新着エピソードの有無が分からず、作品数が増えるほど更新確認が著しく煩雑であった。
  - 本棚の表示順序が「最近読んだ順（`last_read_at DESC, created_at DESC`）」に固定されており、登録作品数が増加した際に「新着話が届いた作品」や「最近追加した作品」、「タイトル順」で探すことができなかった。
- **改善目的**:
  - **自動更新チェックと「NEW（更新あり）」表示・解除**:
    - 本棚画面（`SCR-01`）表示時に、前回更新チェックから一定時間（1時間）以上経過している登録作品を対象に、バックグラウンド順次処理（1秒ウェイト）で目次を再取得して更新をチェックする。
    - 新着エピソードが検知された作品には `has_new_update = 1` を記録し、作品カード上に「NEW」バッジを明示する。
    - ユーザーがその作品を開いた時点（作品詳細 `SCR-02` またはリーダー `SCR-03`）で「NEW」表示を自動解除する。
    - ヘッダーの手動更新ボタンから即時一括更新チェックも可能とする。
  - **本棚の 5 種類ソート機能と永続化**:
    - デフォルトを「更新あり優先＋最近読んだ順」とし、更新があった作品が本棚の最上部へ自動浮上するようにする。
    - 本棚ヘッダーにソートセレクターを設置し、以下の 5 種類を切り替え可能とし、選択結果を端末内 SQLite（`app_settings`）に永続化する：
      1. 更新あり優先＋最近読んだ順（既定値）
      2. 最近読んだ順
      3. 作品更新日順
      4. 登録日順
      5. タイトル順

---

## 2. 要求仕様と設計合意事項（What）

### 2.1 作品の自動更新チェックと「NEW」バッジ表示・解除

1. **更新チェック対象判定**:
   - 本棚画面表示時（`useBookshelf` 初期化時）、登録作品のうち `lastCheckedAt === null` または `lastCheckedAt` が現在時刻から1時間（`3,600,000ms`）以上経過している作品を抽出する。
   - 対象作品が存在する場合、画面描画をブロックせず非同期バックグラウンドで順次目次再取得を実行する。
2. **レートリミット制御**:
   - 対象小説サーバー（カクヨム等）への過剰アクセス・503 BAN を防止するため、1作品の目次取得ごとに 1.0秒（`1000ms`）のウェイト間隔を挟んで順次実行する。
3. **新着話検知および最新話公開日時導出ロジック**:
   - 目次再取得結果の `index.chapters.length > existing.totalChapters`（または既存にない新規チャプター）を検知した場合に新着と判定する。
   - 新着検知時は `has_new_update = 1` を記録し、`last_checked_at` を更新する。
   - 新着なしの場合は既存の `has_new_update` 値を維持（未読 NEW が残っている場合は維持）し、`last_checked_at` のみ現在時刻に更新する。
   - `upsertNovelWithToc` 実行時、`index.chapters` 内のエピソード（`ParsedTocItem[]`）のうち有効な `publishedAt` の最大値（最新公開/更新日時）を算出し、`novels.latest_episode_published_at` に保存する（全エピソード未設定時は `NULL`）。
   - 各作品の更新完了時、本棚一覧の `novels` ステートへ反映する。
4. **「NEW」バッジ描画仕様**:
   - `NovelCard` において `novel.hasNewUpdate === true` のとき、目立つタグ調バッジ `data-testid="novel-card-new-badge"`（表示文字列: `NEW`）を描画する。
5. **「NEW」バッジ自動解除仕様**:
   - 以下のいずれかのアクションを行った時点で、`novelRepository.clearNewUpdate(novelId)` を呼び出し、DB の `has_new_update = 0` に更新し、画面のバッジを消去する：
     - 本棚画面で作品カード本体をタップして作品詳細（`SCR-02`）へ遷移した時（`TR-02`）
     - 本棚画面で「続きから読む」ボタンをタップしてリーダー（`SCR-03`）へ遷移した時（`TR-03`）
     - 作品詳細画面（`SCR-02`）を表示した時
6. **手動一括更新チェック**:
   - 本棚ヘッダーに手動更新ボタン `data-testid="bookshelf-refresh-button"` を配置する。
   - 押下時は1時間経過条件にかかわらず全登録作品を対象に順次更新チェックを開始する。
   - 実行中はボタンが `disabled` 化し、進捗状況表示 `data-testid="bookshelf-refresh-progress"`（例: `更新中 (1/3)...`）を表示する。

### 2.2 本棚の 5 種類ソート機能と永続化

1. **ソート順一覧と SQL ORDER BY 契約**:
   - `unread_first` (更新あり優先＋最近読んだ順、既定値):
     ```sql
     ORDER BY
       novels.has_new_update DESC,
       CASE WHEN novels.last_read_at IS NOT NULL THEN 0 ELSE 1 END,
       novels.last_read_at DESC,
       novels.created_at DESC;
     ```
   - `last_read` (最近読んだ順):
     ```sql
     ORDER BY
       CASE WHEN novels.last_read_at IS NOT NULL THEN 0 ELSE 1 END,
       novels.last_read_at DESC,
       novels.created_at DESC;
     ```
   - `latest_published` (作品更新日順):
     ```sql
     ORDER BY
       CASE WHEN novels.latest_episode_published_at IS NOT NULL THEN 0 ELSE 1 END,
       novels.latest_episode_published_at DESC,
       novels.updated_at DESC;
     ```
   - `created_at` (登録日順):
     ```sql
     ORDER BY novels.created_at DESC;
     ```
   - `title` (タイトル順):
     ```sql
     ORDER BY novels.title COLLATE NOCASE ASC;
     ```
2. **ソート順の永続化**:
   - 汎用アプリケーション設定テーブル `app_settings` に `key = 'bookshelf_sort_order'` として保存する。
   - ユーザーが本棚ヘッダーのセレクターでソート順を変更した際、即時に `appSettingsRepository.setSetting('bookshelf_sort_order', order)` で DB に保存する。
   - 次回起動時および画面復帰時、DB から前回の選択状態を復元して初期描画する。

---

## 3. 影響する App 全体正本と差分仕様詳細

### 3.1 全体要件定義書（`docs/specs/requirements.md`）

- `SYS-REQ-04`（更新チェック・ソート）の受入条件 ID 欄に `AC-BS-08`〜`11` を追記。
- 関連画面/遷移に `SCR-01, SCR-02, SCR-03 / TR-02, TR-03, TR-16, TR-17` を反映。
- フロントマター `status: "Review (#80)"` および `related_specs` に本差分仕様を追加。

### 3.2 ローカル DB スキーマ定義書（`docs/specs/db-schema.md`）

- **`novels` テーブル拡張**:
  - `has_new_update INTEGER NOT NULL DEFAULT 0` （新着エピソード検知フラグ）
  - `latest_episode_published_at TEXT` （最新エピソード公開/更新日時）
  - インデックス追加: `idx_novels_has_new_update`, `idx_novels_latest_published`, `idx_novels_created_at`, `idx_novels_title`
- **`app_settings` テーブル新設**:
  - `key TEXT PRIMARY KEY`, `value TEXT NOT NULL`, `updated_at TEXT NOT NULL`
  - 初期レコード: `key: 'bookshelf_sort_order'`, `value: 'unread_first'`
- フロントマター `status: "Review (#80)"`、ER 図、および `related_specs` / `related_tests` を更新。

### 3.3 全体画面一覧・画面遷移の骨格（`docs/specs/screen-transitions.md`）

- `SCR-01` の役割に「自動更新チェック（NEW表示・閲覧時解除）・本棚5種ソート切替/永続化（`v0.3`）」を明記。
- `TR-02`, `TR-03` に「対象作品に NEW バッジが付与されていた場合は `has_new_update` を 0 に解除する」振る舞いを追記。
- `TR-16`（本棚ソート5種切替：即時並び替え・DB永続化）を新設。
- `TR-17`（手動一括更新チェック：非同期目次再取得・NEW反映）を新設。
- 画面遷移図（Mermaid）に `TR-16`, `TR-17` を反映。
- フロントマター `status: "Review (#80)"` および `related_specs` を更新。

### 3.4 3層アーキテクチャと共通インターフェース契約（`docs/specs/architecture.md`）

- `NovelRepository` インターフェース拡張:
  - `listNovels(sortOrder?: BookshelfSortOrder): Promise<NovelSummary[]>`
  - `clearNewUpdate(novelId: string): Promise<void>`
  - `updateLastCheckedAt(novelId: string, checkedAt: string): Promise<void>`
- `AppSettingsRepository` インターフェース新設:
  - `getSetting(key: string): Promise<string | null>`
  - `setSetting(key: string, value: string): Promise<void>`
- `BookshelfSortOrder` 型定義の正本化。
- フロントマター `status: "Review (#80)"` および `related_specs` を更新。

### 3.5 本棚画面仕様書（`docs/specs/features/bookshelf.md`）

- `NovelCard`:
  - `novel` レコードの `hasNewUpdate === true` 時に `data-testid="novel-card-new-badge"` を描画。
- `BookshelfPage`:
  - ヘッダーにソートセレクター `data-testid="bookshelf-sort-select"`、手動更新ボタン `data-testid="bookshelf-refresh-button"`、更新進捗表示 `data-testid="bookshelf-refresh-progress"` を追加。
- `useBookshelf`:
  - `BookshelfSortOrder`, `isCheckingUpdates`, `updateCheckProgress`, `sortOrder`, `setSortOrder`, `checkUpdates`, `clearNovelUpdate` を契約に追加。
- 受入条件追加:
  - `AC-BS-08`: 新着検知と「NEW」バッジ表示
  - `AC-BS-09`: 作品閲覧による「NEW」バッジ解除
  - `AC-BS-10`: 自動更新チェックと手動一括更新
  - `AC-BS-11`: 本棚5種ソート切り替えと永続化
- フロントマター `status: "Review (#80)"` および `related_specs` を更新。

### 3.6 作品詳細・リーダー仕様書（`novel-detail.md`, `reader-view.md`）

- **作品詳細画面（`SCR-02`）**:
  - `useNovelDetail` の初回ロード完了時、対象作品の `novel.hasNewUpdate === true` の場合に `novelRepository.clearNewUpdate(novelId)` を自動実行して `has_new_update = 0` に解除する連携を追記（受入条件 `AC-ND-10`）。
- **小説リーダー画面（`SCR-03`）**:
  - `useReader` の初回エピソード表示開始時、対象作品の `targetNovel.hasNewUpdate === true` の場合に `novelRepository.clearNewUpdate(targetNovel.id)` を自動実行して `has_new_update = 0` に解除する連携を追記（受入条件 `AC-RD-11`）。
- 各フロントマター `status: "Review (#80)"` および `related_specs` を更新。

---

## 4. テスト計画（UT / VRT / IT）

### 4.1 Storage Layer 単体テスト（Vitest TDD）

- `src/storage/schema.test.ts`:
  - `novels` テーブルに `has_new_update`, `latest_episode_published_at` カラムが存在し、各インデックスが正常に作成されること。
  - `app_settings` テーブルが作成され、初期行 `bookshelf_sort_order = 'unread_first'` が挿入されること。
- `src/storage/repositories/novelRepository.test.ts`:
  - 5種類の各ソート順で `listNovels(order)` を呼び出した際、期待通りの並び順（更新あり優先、最近読んだ順、作品更新日順、登録日順、タイトル順）で返却されること。
  - `upsertNovelWithToc` 実行時、既存作品の話数が増加した場合は `has_new_update = 1` が記録され、話数不変時は既存値が維持されること。
  - `clearNewUpdate(novelId)` 呼び出しで `has_new_update` が `0` に更新されること。
  - `updateLastCheckedAt(novelId, checkedAt)` 呼び出しで `last_checked_at` が更新されること。
- `src/storage/repositories/appSettingsRepository.test.ts`:
  - `getSetting` で初期値が取得できること、`setSetting` で値が更新・永続化されること。

### 4.2 Hook & UI コンポーネント単体テスト / VRT

- `src/features/bookshelf/hooks/useBookshelf.test.ts`:
  - 初回ロード時に `app_settings` からソート順を取得して作品一覧を取得すること。
  - 前回チェック日時が1時間以上前の作品に対して、1秒ウェイトを挟んで自動更新チェックが実行されること。
  - 1時間以内の作品に対しては自動更新チェックがスキップされること。
  - 手動更新チェック実行時に全作品が順次チェックされ、進捗ステートが更新されること。
  - `setSortOrder` 呼び出しで `app_settings` が更新され、作品一覧が再取得されること。
  - `clearNovelUpdate` 呼び出しで対象作品の `hasNewUpdate` が `false` に更新されること。
- `src/features/bookshelf/components/NovelCard.test.tsx` & `.stories.tsx`:
  - `novel.hasNewUpdate === true` のとき `novel-card-new-badge` が描画され、`false` のとき描画されないこと。
  - 1280px / 375px での VRT スナップショット一致確認。
- `src/features/bookshelf/components/BookshelfPage.test.tsx` & `.stories.tsx`:
  - ソートセレクター（5種）の変更イベント発火確認。
  - 更新ボタンのクリックイベント発火、および `isCheckingUpdates === true` 時の `disabled` / 進捗表示確認。
  - 1280px / 375px での VRT スナップショット一致確認。
- `src/features/bookshelf/components/BookshelfContainer.test.tsx`:
  - カードクリック時の NEW 解除と作品詳細画面遷移の連携確認。
  - 「続きから読む」クリック時の NEW 解除とリーダー画面遷移の連携確認。

### 4.3 Playwright 結合テスト（IT シナリオ）

- `test/it/scenarios/scn01-poc-vertical-reader.spec.ts`（または新規シナリオ）:
  - 作品登録後、前回チェック日時を1時間前に操作して本棚を開いた際に、自動更新チェックが走り新着作品に「NEW」バッジが表示されることの検証。
  - 「NEW」バッジ付きカードをタップして作品詳細を開き、本棚へ戻った際に「NEW」バッジが消去されていることの検証。
  - 本棚ヘッダーでソート順（「作品更新日順」「タイトル順」等）を切り替え、表示順が変化すること、およびページ再読込後もソート順が維持されることの検証。

---

## 5. 実装 Sub-issue 分割計画（推奨200〜400行目安）

| No. | Sub-issue タイトル                                                                                                              | 作業スコープと担当レイヤー                                                                                                                                                                                                                                                                                                                                                                            | 完了条件                                                                                                 |  想定行数  |
| :-: | :------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :--------: |
|  ①  | `[v0.3] Storage Layer: novels スキーマ拡張・app_settings テーブル新設・5種ソートクエリ実装`                                     | `src/storage/schema.ts`<br>`src/storage/types.ts`<br>`src/storage/repositories/novelRepository.ts`<br>`src/storage/repositories/appSettingsRepository.ts`<br>`src/storage/repositories/novelRepository.test.ts`<br>`src/storage/repositories/appSettingsRepository.test.ts`<br>`src/storage/schema.test.ts`                                                                                           | TDD Red-Green-Refactor<br>5種ソート順テスト全通過<br>C0/C1 100%                                          | 250〜350行 |
|  ②  | `[v0.3] Hook & Service Layer: useBookshelf 自動更新チェック（1時間判定・レートリミット順次実行）・手動一括更新・ソート順永続化` | `src/features/bookshelf/hooks/useBookshelf.ts`<br>`src/features/bookshelf/hooks/useBookshelf.test.ts`<br>`src/app/ServiceProvider.tsx`<br>`src/app/ServiceProvider.test.tsx`                                                                                                                                                                                                                          | TDD Red-Green-Refactor<br>1時間経過判定・1秒ウェイトテスト<br>ソート永続化テスト<br>C0/C1 100%           | 200〜300行 |
|  ③  | `[v0.3] UI Components & VRT: NovelCard「NEW」バッジ・BookshelfPage 5種ソートセレクター・一括更新ボタンと進行状況表示`           | `src/features/bookshelf/components/NovelCard.tsx`<br>`src/features/bookshelf/components/NovelCard.stories.tsx`<br>`src/features/bookshelf/components/NovelCard.test.tsx`<br>`src/features/bookshelf/components/BookshelfPage.tsx`<br>`src/features/bookshelf/components/BookshelfPage.stories.tsx`<br>`src/features/bookshelf/components/BookshelfPage.test.tsx`<br>`test/vrt/snapshots/`             | 1対1 Story/UT<br>親子分離原則<br>VRT 1280px / 375px PASS<br>C0/C1 100%                                   | 250〜350行 |
|  ④  | `[v0.3] Page Integration & IT: BookshelfContainer 統合・作品閲覧時 NEW 解除・Playwright 回帰シナリオ検証・差分仕様アーカイブ`   | `src/features/bookshelf/components/BookshelfContainer.tsx`<br>`src/features/bookshelf/components/BookshelfContainer.test.tsx`<br>`src/features/novel-detail/components/NovelDetailContainer.tsx`<br>`src/App.test.tsx`<br>`test/it/scenarios/scn01-poc-vertical-reader.spec.ts`<br>`docs/quality/bug-and-handover-log.md`<br>`docs/specs/changes/archive/issue-80-bookshelf-update-check-and-sort.md` | BookshelfContainer 接続 UT<br>Playwright IT 回帰 PASS<br>`HO-18`, `HO-19` 精算<br>差分仕様アーカイブ移動 | 250〜350行 |

---

## 6. 申し送り事項（Handover Items: `HO-xx`）

本設計 PR において以下の申し送り事項を起票し、[docs/quality/bug-and-handover-log.md](../../quality/bug-and-handover-log.md) に登録しました。

|   ID    | 起票元 | 内容                                                                                                                                                                                                | 解決先（担当 Sub-issue）      | 完了ゲート          |  状態  |
| :-----: | :----: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- | :------------------ | :----: |
| `HO-18` |  #80   | 本棚表示時の自動更新チェック（1時間経過判定・ウェイト間隔順次実行）および「NEW（更新あり）」バッジ表示・作品閲覧（SCR-02/SCR-03）による解除の一連導線に関する Playwright 実ブラウザ IT シナリオ検証 | Issue #80 Sub-issue ④ (IT PR) | Issue #80 PR マージ | `Open` |
| `HO-19` |  #80   | 本棚ヘッダーでの 5 種類ソート順切り替え（更新あり優先・最近読んだ順・作品更新日順・登録日順・タイトル順）およびアプリ再表示時のソート順永続化・復元に関する Playwright 実ブラウザ IT シナリオ検証   | Issue #80 Sub-issue ④ (IT PR) | Issue #80 PR マージ | `Open` |
