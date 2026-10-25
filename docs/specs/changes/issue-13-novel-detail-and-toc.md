---
type: spec-delta
title: 作品詳細・目次画面（SCR-02）とエピソード選択・オンデマンド本文取得の実装
description: Issue #13 に対する差分仕様、作品詳細・目次画面（SCR-02: /novels/:novelId）のコンポーネント設計、目次更新・作品削除・オンデマンド本文取得連携、テスト計画、およびSub-issue分割計画。
issue: "#13"
status: "Review (#13)"
updated: "2026-10-26"
tags: [delta, novel-detail, scr-02, toc, routing, kakuyomu]
related_specs:
  - docs/specs/features/novel-detail.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/reader-view.md
  - docs/specs/screen-transitions.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/db-schema.md
related_tests:
  - src/App.test.tsx
  - src/app/ServiceProvider.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：作品詳細・目次画面（SCR-02）とエピソード選択・オンデマンド本文取得（Issue #13）

## 1. 変更の背景・目的（Why）

- 先行する Issue #12 では、画面ルーティング基盤（`src/app/router.tsx`）と本棚画面（`SCR-01`）を導入し、作品詳細ルート（`/novels/:novelId`）には暫定的な最小プレースホルダ（`NovelDetailPlaceholder`）を配置した。
- 本 Issue #13 では、申し送り事項 `HO-04` の後半として **作品詳細・目次画面（`SCR-02`: `/novels/:novelId`）** を本格実装し、登録済み作品のあらすじ確認、章見出し（`partTitle`）付きエピソード一覧と各話状態（キャッシュ済み・既読・しおり）の確認、任意のエピソード選択によるリーダー閲覧（未キャッシュ時のオンデマンド本文取得連携 `TR-04`）、目次の手動再取得（差分更新）、および確認ダイアログ付き作品削除（`TR-07`）を完成させる。

---

## 2. 仕様・設計の差分（What Changes）

### 2.1 作品詳細・目次画面（`SCR-02`）正本仕様書の新規策定

- App 全体正本として [docs/specs/features/novel-detail.md](../features/novel-detail.md) を新規策定し、以下の機能と受入条件（`AC-ND-01`〜`AC-ND-07`）を定義する：
  1. **作品詳細ヘッダー（`NovelDetailHeader`）**:
     - 作品タイトル（`novel-detail-title`）、著者名（`novel-detail-author`）、あらすじ（`novel-detail-synopsis`）、話数・キャッシュ統計（`全 N 話（取得済み M 話）`：`novel-detail-stats`）を表示する。
     - **読書開始ボタン（`TR-04`）**:
       - しおり未設定時（`bookmarkChapterIndex === null`）: プライマリ「最初から読む（第1話）」（`detail-read-first-button`）の 1 ボタンのみ表示。
       - しおり設定時（`bookmarkChapterIndex !== null`）: プライマリ「続きから読む（第N話）」（`detail-resume-button`）＋セカンダリ「最初から読む（第1話）」（`detail-read-first-button`）の 2 ボタンを並べて表示。
     - **管理・ナビゲーション操作**:
       - 「目次を更新」ボタン（`refresh-toc-button`、通信中は `更新中...` で非活性、完了時は `novel-detail-notice` に `目次を更新しました（+N話）` または `最新の状態です` を表示、失敗時は `novel-detail-error` にエラー表示）。
       - 「作品を削除」ボタン（`open-delete-dialog-button`、押下で確認モーダルを開く）。
       - 「本棚へ戻る」ボタン（`back-to-bookshelf-button`、`/` へ遷移 `TR-07`）。
  2. **章見出し付きエピソード一覧（`EpisodeList` / `EpisodeListItem`）**:
     - アコーディオン開閉は設けず、直前のエピソードと `partTitle` が変化した境界に章見出し（`data-testid="chapter-section-header"`、`partTitle === null` の場合は見出しなし）を挿入するフラットリスト形式で表示する。
     - 各エピソード行（`data-testid="episode-item"`）に話数・タイトル（`episode-item-title`）、公開日時（`episode-item-date`）、キャッシュ状態バッジ（`episode-cached-badge`: `取得済み` / `episode-uncached-badge`: `未取得`）、既読バッジ（`episode-read-badge`: `既読`）、しおりマーク（`episode-bookmark-badge`: `しおり`）を表示する。
     - エピソード行に個別の単話DLボタンは設けず、行タップで即座にリーダー画面（`/novels/:novelId/chapters/:chapterIndex`）へ遷移（`TR-04`）し、未キャッシュ時はリーダー画面側でオンデマンド本文取得・DB保存する UX に統一する。
  3. **作品削除確認ダイアログ（`DeleteConfirmDialog`）**:
     - 作品削除時にモーダル（`data-testid="delete-confirm-dialog"`）を表示し、「削除する」（`confirm-delete-button`）確定時に `novelRepository.deleteNovel(novelId)` を実行（SQLite `ON DELETE CASCADE` により `chapters` も一括削除）して本棚画面（`/`）へ遷移（`TR-07`）する。
     - ※「本文キャッシュのみ削除（目次は残す）」は Milestone `v0.3`（`SYS-REQ-05` キャッシュ管理）のスコープとし、本 Issue では「作品削除」のみを対象とする。
  4. **画面統合・Container（`NovelDetailPage` / `NovelDetailContainer`）と `useNovelDetail` フック**:
     - `NovelDetailPage` でローディング中（`novel-detail-loading`）、未存在作品（`novel-detail-not-found`）、通常表示（`novel-detail-page`）の排他描画を制御する。
     - `NovelDetailContainer` で `useNovelDetail(novelId)` とルーター遷移（`navigateToBookshelf`, `navigateToReader`）を接続し、Issue #12 で暫定配置した `NovelDetailPlaceholder` を置き換える。

### 2.2 関連する App 全体正本の同期更新

- [docs/index.md](../../index.md): ディレクトリ構成ツリーの `docs/specs/features/` 配下に `novel-detail.md` を追加。
- [docs/specs/requirements.md](../requirements.md): `SYS-REQ-01`, `SYS-REQ-02`, `SYS-REQ-04`, `SYS-REQ-05`, `SYS-REQ-12` の受入条件 ID 列に `AC-ND-01`〜`AC-ND-07` を追記し、フロントマター `related_specs` に `docs/specs/features/novel-detail.md` を追加。
- [docs/specs/screen-transitions.md](../screen-transitions.md): `SCR-02` の説明および `TR-04` の遷移時振る舞いを「エピソードタップまたは『最初から読む／続きから読む』ボタンタップ時にリーダー画面へ即時遷移し、未キャッシュ時はリーダー側で本文をオンデマンド取得して表示する」に統一。フロントマター `related_specs` に `docs/specs/features/novel-detail.md` を追加。
- [docs/specs/architecture.md](../architecture.md), [docs/specs/features/bookshelf.md](../features/bookshelf.md), [docs/specs/features/reader-view.md](../features/reader-view.md): フロントマター `related_specs` に `docs/specs/features/novel-detail.md` を追加し、`reader-view.md` の `SCN-01` シナリオに作品詳細・目次画面（`SCR-02`）経由の検証フローを同期。

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Vitest UT: C0/C1/Functions 100%）

- **作品詳細状態管理フック（`src/features/novel-detail/hooks/useNovelDetail.test.ts`）**:
  - 初期ロード時の `getNovelById`・`listChaptersByNovelId` 取得、未存在 `novelId` 時の `novel: null` ハンドリング、取得例外時のエラー保持
  - `refreshToc()` による作品トップ HTML 再取得・`upsertNovelWithToc` 保存・新着話数あり（`目次を更新しました（+N話）`）および差分なし（`最新の状態です`）の通知メッセージ設定、通信・パース失敗時のエラー設定と既存一覧維持
  - 削除確認ダイアログの開閉、および `confirmDeleteNovel()` による `deleteNovel` 実行（`chapters` カスケード削除確認）と失敗時エラー処理
- **UI コンポーネント単体テスト（Portable Stories `composeStories`、1対1 `*.stories.tsx` / `*.test.tsx`）**:
  - `NovelDetailHeader.test.tsx`: タイトル・著者・あらすじ・話数統計の表示、しおり有無による読書開始ボタン（1ボタン vs 2ボタン）の出し分けと発火、目次更新中 disabled とインライン通知/エラー表示、削除ボタン・本棚へ戻るボタン発火
  - `EpisodeListItem.test.tsx`: 話数・タイトル・公開日時の表示、`取得済み` / `未取得` バッジ、`既読` バッジ、`しおり` マークの表示切り替え、行タップによる `onSelectEpisode(chapterIndex)` 発火
  - `EpisodeList.test.tsx`: 空状態（`episode-list-empty`）、`partTitle` 変化境界での章見出し（`chapter-section-header`）挿入と `partTitle === null` 時の見出し非表示、しおり話数の子アイテム伝達
  - `DeleteConfirmDialog.test.tsx`: 開閉状態、作品名を含む確認メッセージ表示、削除確定・キャンセル発火、削除処理中（`isDeleting = true`）のボタン disabled 制御
  - `NovelDetailPage.test.tsx` / `NovelDetailContainer.test.tsx`: 親子分離原則に基づくローディング・未存在（Not Found）・通常表示の排他描画と、ルーター遷移（`TR-04`, `TR-07`）の統合動作

### 3.2 視覚的回帰テスト（Storybook VRT: 1280px / 375px）

- `NovelDetailHeader`（未読 / しおりあり / 更新通知・エラー表示）, `EpisodeListItem`（未取得・未読 / 取得済み・既読・しおりあり）, `EpisodeList`（章見出しあり / 空状態）, `DeleteConfirmDialog`（通常 / 削除中）, `NovelDetailPage`（ローディング / 未存在 / 通常表示）, `NovelDetailContainer` の各 Story について、Desktop（1280×800）および Mobile（375×667）の VRT スナップショットを追加・検証する。

### 3.3 実ブラウザ結合テスト（Playwright IT: `SCN-01` 拡張）

- `test/it/scenarios/scn01-poc-vertical-reader.spec.ts` を拡張し、本棚（`SCR-01`）→ 作品詳細・目次（`SCR-02`）→ リーダー（`SCR-03`）の 3 画面連携を E2E で検証する：
  1. 本棚画面（`SCR-01`）で URL から作品を登録後、作品カード本体（`novel-card-select`）をタップして `/novels/:novelId`（`SCR-02` 作品詳細・目次画面）へ遷移（`TR-02`）できること。
  2. 作品詳細画面にタイトル・著者・あらすじ・全2話（取得済み0話）および章見出し付きエピソード一覧（第1話・第2話とも `未取得`）が表示され、「目次を更新」ボタンで `最新の状態です` が表示されること。
  3. 目次一覧から未キャッシュのエピソードをタップすると `/novels/:novelId/chapters/:chapterIndex`（`SCR-03`）へ遷移（`TR-04`）し、本文がオンデマンド取得されて縦書き・`<ruby>`・傍点付きで表示されること。
  4. リーダー画面の「作品詳細へ」（`reader-back-to-detail`）で `SCR-02` へ戻る（`TR-06`）と、閲覧した話のバッジが `取得済み`（`episode-cached-badge`）に、ヘッダー統計が `取得済み 1 話` に更新されていること。
  5. 作品詳細画面で「作品を削除」→ 確認ダイアログの「削除する」を実行すると、本棚画面（`/`）へ遷移（`TR-07`）し、作品が削除されて空状態（`bookshelf-empty`）に戻ること。

---

## 4. 実装 Sub-issue 分割計画

1 PR あたり 200〜400 行目安の規律に従い、以下の 3 つの Sub-issue に分割して直列（逐次）実装する（なお Sub-issue ③ は先行 Issue #12 のルーター統合完了後に結合する）。

| Sub-issue                        | タイトル                                                                              | 主な作業範囲・成果物                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :------------------------------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sub-issue ① (#25: MK-1)**      | `[v0.1] 作品詳細・目次状態管理フック（useNovelDetail）の実装 (#13-1)`                 | ・`src/features/novel-detail/hooks/useNovelDetail.ts` の実装（作品・目次取得、目次再取得・差分話数通知、削除ダイアログ制御、`deleteNovel` 実行）<br>・`src/features/novel-detail/hooks/useNovelDetail.test.ts` の単体テスト実装（C0/C1/Functions 100%）                                                                                                                                                                                |
| **Sub-issue ② (#26: MK-2)**      | `[v0.1] 作品詳細・目次画面（SCR-02）UIコンポーネント群とStorybook・VRTの実装 (#13-2)` | ・`NovelDetailHeader` / `EpisodeListItem` / `EpisodeList` / `DeleteConfirmDialog` / `NovelDetailPage` の実装<br>・全5コンポーネントの 1対1 `*.stories.tsx` および Portable Stories `*.test.tsx`<br>・VRT スナップショット（1280px / 375px）更新・検証                                                                                                                                                                                  |
| **Sub-issue ③ (#27: MK-3 & IT)** | `[v0.1] NovelDetailContainer・ルーター統合・Playwright IT更新 (#13-3)`                | ・`NovelDetailContainer`（`*.tsx`, `*.stories.tsx`, `*.test.tsx`）実装<br>・`src/app/router.tsx`（または `src/App.tsx`）の `/novels/:novelId` ルートを `NovelDetailPlaceholder` から `NovelDetailContainer` へ置換し `NovelDetailPlaceholder.*` を廃止（＋VRT更新）<br>・Playwright IT（`scn01-poc-vertical-reader.spec.ts`）の `SCR-02` 往復・削除シナリオ更新<br>・差分仕様の `docs/specs/changes/archive/` への移動（`Closes #13`） |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）

|   ID    | 申し送り事項の内容                                                                                                                                                                                                                                                                         | 解決先（対象 Issue / 成果物）     | 完了ゲート          |  状態  |
| :-----: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- | :------------------ | :----: |
| `HO-04` | `src/app/router.tsx` による画面ルーティング導入、および `SCR-01` 本棚画面（#12）・`SCR-02` 作品詳細/目次画面（#13）の実装（※Issue #12 で前半のルーティング＋`SCR-01` を実装し、本 Issue #13 Sub-issue ③ #27 で後半の `SCR-02` 本格実装を統合して完全解決する）                             | Issue #12 / Issue #13 (#27 IT PR) | Issue #13 PR マージ | `Open` |
| `HO-08` | 本棚画面（`SCR-01`）からの作品カード選択（`TR-02`）→ 作品詳細・目次画面（`SCR-02`）での目次更新・未キャッシュ話選択（`TR-04`）→ リーダー（`SCR-03`）オンデマンド取得 → 作品詳細復帰（`TR-06`）での `取得済み` バッジ反映 → 確認ダイアログ付き作品削除（`TR-07`）の実ブラウザ結合テスト検証 | Issue #13 Sub-issue ③ (#27 IT PR) | Issue #13 PR マージ | `Open` |
