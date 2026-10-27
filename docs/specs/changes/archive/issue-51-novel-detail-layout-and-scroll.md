---
type: spec-delta
title: 作品詳細・目次画面（SCR-02）のヘッダー固定・あらすじトグル化・各話内部スクロール＆しおり初期スクロール調整
description: Issue #51 に対する差分仕様。SCR-02 の「本棚へ戻る」ボタン廃止、作品情報ヘッダー固定・あらすじトグル化、各話リスト内部スクロール化、初回表示時のしおり話数への自動スクロール調整、テスト計画、および Sub-issue 分割計画（#56, #57）。
issue: "#51"
status: "Completed (Archived)"
updated: "2026-10-28"
tags: [delta, novel-detail, scr-02, toc, layout, scroll, bookmark]
related_specs:
  - docs/specs/features/novel-detail.md
  - docs/specs/screen-transitions.md
  - docs/specs/requirements.md
  - docs/specs/architecture.md
related_tests:
  - src/features/novel-detail/components/NovelDetailHeader.test.tsx
  - src/features/novel-detail/components/EpisodeListItem.test.tsx
  - src/features/novel-detail/components/EpisodeList.test.tsx
  - src/features/novel-detail/components/DeleteConfirmDialog.test.tsx
  - src/features/novel-detail/components/NovelDetailPage.test.tsx
  - src/features/novel-detail/components/NovelDetailContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：作品詳細・目次画面（SCR-02）のヘッダー固定・あらすじトグル化・各話内部スクロール＆しおり初期スクロール調整（Issue #51）

## 1. 変更の背景・目的（Why）

- **背景・課題**:
  - `v0.1` の作品詳細・目次画面（`SCR-02`）はページ全体が 1 つの長いスクロール領域（`min-h-screen`）として構成されていたため、あらすじが長い作品や話数が多い作品において画面全体が縦に伸び、エピソード一覧を探す際に大幅なスクロールが必要であった。
  - ヘッダー内の「← 本棚へ戻る」ボタンは、下部タブバー（「本棚」タブ）および OS バックキー（ブラウザ戻る操作）で本棚への復帰が担保されるため冗長となっていた。
  - 読書中作品の目次を開いた際、作品にしおり（`bookmarkChapterIndex`）が設定されているにもかかわらず常に第1話（先頭）が表示され、続きの話数を探す手間が発生していた。
- **目的**:
  - 画面高さ（`100dvh`）に合わせて「作品情報ヘッダー」を画面上部固定（`shrink-0`）、「下部タブバー」を下部固定とし、中央の「各話リスト」のみが内部スクロール（`flex-1 min-h-0 overflow-y-auto`）する構造に改編する。
  - ヘッダー内の「← 本棚へ戻る」ボタンを廃止（作品未検出画面の復帰ボタンのみ維持）し、あらすじをデフォルト折りたたみ（2〜3行 clamp）＋トグル展開（最大高さ制限・内部スクロール）とすることでヘッダーを省スペース化する。
  - 作品の初回ロード完了時、しおり話数（`bookmarkChapterIndex`）が設定されている場合は該当エピソードがスクロール領域の先頭（上端）に来るよう初期スクロール位置を自動調整し、「目次を更新」実行時は現在のスクロール位置を維持することで、目次画面の操作性と一覧性を大幅に向上させる。

---

## 2. 仕様・設計の差分（What Changes）

### 2.1 作品詳細・目次画面（`SCR-02`）正本仕様（`docs/specs/features/novel-detail.md`）の改定

1. **「← 本棚へ戻る」ボタンの廃止と導線整理**:
   - `NovelDetailHeader` 内の「← 本棚へ戻る」ボタン（`data-testid="back-to-bookshelf-button"`）を廃止する。
   - `NovelDetailHeaderProps` から `onBackToBookshelf` プロパティを削除する。
   - ※作品未検出時（`novel === null`）のエラーフォールバック画面（`data-testid="novel-detail-not-found"`）内の「本棚へ戻る」ボタン（`back-to-bookshelf-button`）は維持し、`NovelDetailPageProps` / `NovelDetailContainerProps` の `onBackToBookshelf` 契約は継続する。
2. **`NovelDetailHeader` の上部固定・省スペース化とあらすじトグル化**:
   - **配置と省スペース化**:
     - `NovelDetailHeader` を画面上部に固定（`shrink-0`）し、外側余白・パディング・タイトル文字サイズをコンパクトに最適化する。
     - 「目次を更新」「作品を削除」アクションボタンおよび「最初から読む／続きから読む」読書開始ボタンは維持する。
   - **あらすじ折りたたみトグル（`synopsis`）**:
     - 初期状態は折りたたまれており、2〜3行（`line-clamp-2` 等）のみ表示する。
     - トグルボタン `data-testid="synopsis-toggle-button"`（折りたたみ時ラベル: `あらすじを展開`、展開時ラベル: `あらすじを折りたたむ`、`aria-expanded={isSynopsisExpanded}`、`aria-controls="novel-detail-synopsis"`）を配置する。
     - トグル押下で全文を展開する。展開時も各話リスト領域が押し潰されないよう、展開時のあらすじ枠に最大高さ制限と内部スクロール（`max-h-40 overflow-y-auto`）を設ける。
     - あらすじが空文字または未設定の場合は「あらすじはありません。」を表示し、トグルボタンは非表示とする。
3. **各話リスト（`EpisodeList`）の内部スクロール化**:
   - `NovelDetailPage` 全体を `h-full flex flex-col overflow-hidden` とし、固定ヘッダー（`shrink-0`）と下部固定領域（App シェルまたは下部タブ）の間の領域（`<main data-testid="episode-list-container" className="flex-1 min-h-0 overflow-y-auto ...">`）で各話リストのみが独立して縦スクロールする構造とする。
4. **しおり話数（`bookmarkChapterIndex`）への初期スクロール位置自動調整**:
   - 目次画面を開いた初期表示完了時（対象作品の初回データロード完了時：`isLoading` が `false` になり `novel` と `chapters` が取得できた初回）、作品にしおり（`bookmarkChapterIndex`）が設定されている場合は、該当話（`data-chapter-index="{bookmarkChapterIndex}"`）の要素が各話リストスクロール領域の先頭（上端）に来るよう初期スクロール位置を自動調整する。
   - しおり未設定時（`bookmarkChapterIndex === null`）はスクロール位置を調整せず先頭（`scrollTop = 0`）のままとする。
   - 初回スクロール完了フラグ（`hasInitialScrolledRef` 等）を保持し、同一画面内での「目次を更新」（`refreshToc`）実行時には再スクロールを発火させず、ユーザーの現在スクロール位置を維持する。
   - 作品 ID（`novelId`）が変化した際（別作品へ遷移時）はフラグをリセットし、新作品の初回表示時に再度しおりスクロールを行う。
5. **受入条件（Acceptance Criteria）の改定・新設**:
   - **`AC-ND-01`（改定）**: 作品ヘッダーが上部固定（`shrink-0`）され、タイトル・著者・統計がコンパクトに表示されること。あらすじはデフォルトで折りたたまれ（2〜3行 clamp）、トグルボタン（`synopsis-toggle-button`）で全文展開／折りたたみが可能であり、展開時は最大高さ制限と内部スクロール（`max-h` ＋ `overflow-y-auto`）が適用されること。
   - **`AC-ND-02`（改定）**: 各話リストが固定ヘッダー下の独立スクロール領域（`flex-1 min-h-0 overflow-y-auto`）として描画され、`chapterIndex` 昇順・章見出し・本文キャッシュ状態・既読状態・しおりマークが正確に表示されること。
   - **`AC-ND-07`（改定）**: `NovelDetailHeader` 内の「← 本棚へ戻る」ボタンは廃止されること。一方、存在しない作品 ID 指定時のエラー画面（`novel-detail-not-found`）では「本棚へ戻る」ボタン（`back-to-bookshelf-button`）が維持され、押下時に本棚画面（`/`）へ戻れること。
   - **`AC-ND-08`（新設）**: 対象作品に `bookmarkChapterIndex` が設定されている場合、初回データ読み込み完了時に該当話（`data-chapter-index`）の要素が各話リストスクロール領域の先頭（上端）に来るよう自動スクロールされること。また、「目次を更新」実行時には自動スクロールが再発火せず、現在のスクロール位置が維持されること。

### 2.2 App 全体正本の同期更新

- [docs/specs/features/novel-detail.md](../../features/novel-detail.md):
  - コンポーネント構成、`NovelDetailHeaderProps`（`onBackToBookshelf` 削除）、`NovelDetailHeader` のあらすじトグル仕様、`NovelDetailPage` の内部スクロール構成、しおり初期スクロール仕様、および受入条件 `AC-ND-01`, `AC-ND-02`, `AC-ND-07`, `AC-ND-08` を更新。
  - フロントマター `status: "Review (#51)"`、`related_specs` に本差分仕様を追加。
- [docs/specs/screen-transitions.md](../../screen-transitions.md):
  - `TR-07` の説明を「作品削除確認ダイアログでの削除実行完了、下部タブバーの『本棚』タップ、OS バックキー操作、または作品未検出画面（`novel-detail-not-found`）の『本棚へ戻る』ボタン押下時に本棚画面へ戻る（ヘッダー内の『本棚へ戻る』ボタンは廃止）」に更新。
  - フロントマター `status: "Review (#51)"`、`related_specs` に本差分仕様を追加。
- [docs/specs/requirements.md](../../requirements.md):
  - `SYS-REQ-01` および `SYS-REQ-12` の受入条件 ID 列に `AC-ND-08` を追加。
  - フロントマター `status: "Review (#51)"`、`related_specs` に本差分仕様を追加。
- [docs/index.md](../../../index.md):
  - ディレクトリツリーの `docs/specs/changes/archive/` 配下に `issue-51-novel-detail-layout-and-scroll.md` を追加。
- [docs/quality/bug-and-handover-log.md](../../../quality/bug-and-handover-log.md):
  - 申し送り事項 `HO-11`（`SCR-02` ヘッダー固定・あらすじトグル・内部スクロール・しおり初期スクロールの Playwright IT シナリオ検証）を登録。

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Vitest UT: C0/C1/Functions 100%）

- **`NovelDetailHeader.test.tsx`**:
  - 「本棚へ戻る」ボタン（`back-to-bookshelf-button`）がヘッダー内に描画されないことの検証。
  - タイトル、著者、話数統計（`全 N 話（取得済み M 話）`）のコンパクト描画。
  - あらすじ折りたたみトグル動作:
    - 初期状態で `line-clamp-2`（折りたたみ）、トグルボタン `synopsis-toggle-button` のラベルが `あらすじを展開`、`aria-expanded="false"` であること。
    - トグルボタン押下で `line-clamp` が解除され `overflow-y-auto` が付与されること、ラベルが `あらすじを折りたたむ`、`aria-expanded="true"` に切り替わること。
    - 再度押下で初期の折りたたみ状態に戻ること。
    - `novel.synopsis` が空文字・未設定の場合にトグルボタンが表示されないこと。
  - 読書開始ボタン（しおり未設定時の1ボタン vs しおり設定時の2ボタン並列）の出し分けと押下コールバック呼び出し。
  - 目次更新ボタン（更新中 disabled・文言切り替え）および作品削除ダイアログ起動ボタンの動作。
- **`NovelDetailPage.test.tsx`**:
  - 排他描画の検証（ローディング中 `novel-detail-loading` / 未存在 `novel-detail-not-found` / 通常表示 `novel-detail-page`）。
  - 未存在表示時に「本棚へ戻る」ボタン（`back-to-bookshelf-button`）が存在し、押下時に `onBackToBookshelf` が発火すること。
  - しおり設定時（`bookmarkChapterIndex: 5` 等）、初回データ読み込み完了時に該当話（`data-chapter-index="5"`）の要素へ初期スクロール調整が実行されること。
  - しおり未設定時（`bookmarkChapterIndex: null`）、初期スクロール調整が実行されないこと。
  - 「目次を更新」完了時（`isRefreshing` のトグル後）に初期スクロール調整が再発火せず、スクロール位置が維持されること。
- **`NovelDetailContainer.test.tsx`**:
  - Container 経由での `useNovelDetail` との接続、しおり初期スクロール制御、目次更新時のスクロール維持の結合検証。

### 3.2 視覚的回帰テスト（Storybook VRT: 1280px / 375px）

- `NovelDetailHeader`:
  - あらすじ折りたたみ時（デフォルト）
  - あらすじ展開時（長文あらすじ・内部スクロール表示）
  - しおり設定時（2ボタン表示） / しおり未設定時（1ボタン表示）
  - 目次更新通知メッセージ / エラーメッセージ表示
- `NovelDetailPage`:
  - 通常表示（しおり位置スクロール・あらすじ折りたたみ）
  - 作品未検出エラー表示（「本棚へ戻る」ボタン表示）

### 3.3 実ブラウザ結合テスト（Playwright IT: `SCN-01` 回帰）

- `test/it/scenarios/scn01-poc-vertical-reader.spec.ts` を拡張・検証:
  1. 本棚画面（`SCR-01`）から作品詳細画面（`SCR-02`）へ遷移時、画面上部にヘッダーが固定され、各話リストが独立してスクロール可能であること。
  2. あらすじの「あらすじを展開」ボタンを押下して全文表示され、再度押下で折りたたまれること。
  3. 作品にしおりが設定された状態で `SCR-02` を開いた際、しおり位置のエピソードが各話リストの先頭（上端）に初期スクロールされること。
  4. 「目次を更新」ボタンを押下して目次が再取得された際、スクロール位置が先頭にリセットされず維持されること。
  5. 存在しない作品 ID（`/novels/non-existent-id`）を指定した際、作品未検出画面に「本棚へ戻る」ボタンが表示され、タップで本棚トップ（`/`）へ戻れること。

---

## 4. 実装 Sub-issue 分割計画

1 PR あたり 200〜400 行目安の規律に従い、以下の 2 つの Sub-issue に分割して直列（逐次）実装する。

| Sub-issue                        | タイトル                                                                                            | 主な作業範囲・成果物                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sub-issue ① (#56: MK-1)**      | `[v0.2] NovelDetailHeader の「本棚へ戻る」ボタン廃止・上部固定・あらすじ折りたたみトグル化 (#51-1)` | ・`NovelDetailHeader.tsx` の改修（「本棚へ戻る」ボタン廃止、Props から `onBackToBookshelf` 削除、上部固定 `shrink-0`、省スペース化、あらすじ折りたたみトグル `synopsis-toggle-button`、展開時の `max-h-40 overflow-y-auto` 内部スクロール）<br>・`NovelDetailHeader.stories.tsx` および `NovelDetailHeader.test.tsx` の更新（1対1 Story/UT、C0/C1/Functions 100%）<br>・VRT スナップショット（1280px / 375px）更新・検証                                                                                                                                                                                                                                                                                          |
| **Sub-issue ② (#57: MK-2 & IT)** | `[v0.2] 各話リスト内部スクロール化・しおり位置初期スクロール調整・結合＆IT回帰 (#51-2)`             | ・`NovelDetailPage.tsx` / `NovelDetailContainer.tsx` の改修（固定ヘッダー＋`flex-1 min-h-0 overflow-y-auto` 各話リスト内部スクロール化、作品未検出時の「本棚へ戻る」ボタン維持、初回ロード完了時のしおり話数への自動スクロール調整、目次更新時のスクロール維持）<br>・`NovelDetailPage.stories.tsx` / `NovelDetailPage.test.tsx` / `NovelDetailContainer.stories.tsx` / `NovelDetailContainer.test.tsx` の更新（C0/C1/Functions 100%）<br>・VRT スナップショット（1280px / 375px）更新・検証<br>・Playwright IT（`test/it/scenarios/scn01-poc-vertical-reader.spec.ts` 等）の更新・全体回帰<br>・申し送り事項（`HO-11`）の解決および本差分仕様の `docs/specs/changes/archive/` へのアーカイブ移動（`Closes #51`） |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）

|   ID    | 申し送り事項の内容                                                                                                                                                                            | 解決先（対象 Issue / 成果物）     | 完了ゲート          |  状態  |
| :-----: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- | :------------------ | :----: |
| `HO-11` | 作品詳細・目次画面（`SCR-02`）のヘッダー固定・あらすじトグル・各話内部スクロール・しおり位置初期スクロールに関する Playwright 実ブラウザ IT シナリオ（`SCN-01` 等）での回帰検証および動作確認 | Issue #51 Sub-issue ② (#57 IT PR) | Issue #51 PR マージ | `Open` |
