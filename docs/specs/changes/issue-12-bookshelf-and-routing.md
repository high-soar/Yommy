---
type: spec-delta
title: 画面ルーティング導入と本棚画面（SCR-01）・URL作品登録の実装
description: Issue #12 に対する差分仕様、画面ルーティング基盤（src/app/router.tsx）、本棚画面（SCR-01）、リーダー・作品詳細ルート連携、テスト計画、およびSub-issue分割計画。
issue: "#12"
status: "Review (#12)"
updated: "2026-10-26"
tags: [delta, routing, bookshelf, scr-01, kakuyomu]
related_specs:
  - docs/specs/features/bookshelf.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/reader-view.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/db-schema.md
related_tests:
  - src/App.test.tsx
  - src/app/ServiceProvider.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：画面ルーティング導入と本棚画面（SCR-01）・URL作品登録（Issue #12）

## 1. 変更の背景・目的（Why）

- Phase 3（PoC）では、単一画面（`PocReaderContainer`）のみで固定 URL のカクヨム小説を取得・縦書き表示する最小縦貫通（Walking Skeleton）を実証した。
- Phase 4（Milestone `v0.1` MVP）の第一歩として、複数画面間のルーティング基盤（`src/app/router.tsx`）を導入し、ユーザーが任意のカクヨム作品 URL を登録して一覧管理・読書再開できる **本棚画面（`SCR-01`）** を実装する（申し送り事項 `HO-04` 前半の解決）。
- また、後続の Issue #13（`SCR-02` 作品詳細・目次画面の本格実装）および Issue #14（`SCR-03` リーダー画面の組版・しおり・前後話ナビゲーション拡張）へシームレスに引き継げるよう、各画面ルート（`/`, `/novels/:novelId`, `/novels/:novelId/chapters/:chapterIndex`）と画面遷移（`TR-02`, `TR-03`）を結合する。

---

## 2. 仕様・設計の差分（What Changes）

### 2.1 画面ルーティング基盤（`src/app/router.tsx`）の導入

- **外部依存を増やさない軽量ルーター実装（YAGNI）**:
  - `react-router` 等の外部パッケージは追加せず、ブラウザ標準の History API（`window.history.pushState` / `popstate` イベント）と React Context を用いた軽量ルーターを `src/app/router.tsx` に実装する。
  - 単体テスト（Vitest）や Storybook で任意の初期ルートを再現できるよう、`RouterProvider` に `initialPath?: string` プロパティを提供する（指定時は初期パスとして優先使用し、遷移時はステートと `window.history.pushState` を同期する）。
- **サポートするルート定義とパターンマッチング**:
  - `/` → `SCR-01`: 本棚画面（`BookshelfContainer`）
  - `/novels/:novelId` → `SCR-02`: 作品詳細・目次画面（Issue #13 本格実装までの間は最小プレースホルダ `NovelDetailPlaceholder` を表示）
  - `/novels/:novelId/chapters/:chapterIndex` → `SCR-03`: 小説リーダー画面（`PocReaderContainer` をルートパラメータ・オンデマンド取得対応へ拡張）
  - 上記いずれにも合致しない未知のパスの場合は `/`（`SCR-01` 本棚画面）へフォールバック表示する。
- **URL パラメータのエンコード・デコード規約**:
  - `novelId` は `"kakuyomu:16817330658027210412"` のようにコロン `:` を含むため、遷移ヘルパー（`navigateToNovelDetail(novelId)` / `navigateToReader(novelId, chapterIndex)`）では `encodeURIComponent(novelId)` を用いてパスを生成し、ルート解析時に `decodeURIComponent` で復元する（生文字列のパスが直接指定された場合も正常にデコードされる）。

### 2.2 本棚画面（`SCR-01`）の新規策定・実装

- App 全体正本として [docs/specs/features/bookshelf.md](../features/bookshelf.md) を新規策定し、以下の機能と受入条件（`AC-BS-01`〜`AC-BS-06`）を定義する：
  1. **登録済み作品カード一覧（`NovelCard`）**:
     - 既存の `NovelSummary` スキーマを変更せず、タイトル（`title`）、著者名（`author`）、全話数と取得済み話数（`全 N 話（取得済み M 話）`）、およびしおり位置バッジ（`しおり: 第K話` または `未読`）を表示する。
     - カード本体タップ（`novel-card-select`）で `/novels/:novelId` へ遷移する（`TR-02`）。
     - 「続きから読む」ボタンタップ（`novel-card-resume`）で `bookmarkChapterIndex ?? 1` のリーダー画面 `/novels/:novelId/chapters/:chapterIndex` へ直接遷移する（`TR-03`）。
  2. **空状態 UI（`BookshelfEmptyState`）**:
     - 登録作品が 0 件のときに `data-testid="bookshelf-empty"` を表示し、「URLから作品を追加」ボタンから登録ダイアログを起動できる。
  3. **URLから作品を追加ダイアログ（`AddNovelDialog`）と登録フック（`useBookshelf`）**:
     - カクヨム作品トップ URL またはエピソード URL を入力し、通信前に `parserRegistry.requireParser` ＆ `parser.normalizeWorkUrl` で検証・正規化する。
     - 登録時は作品メタデータと全エピソード目次（`upsertNovelWithToc`）のみを取得・保存して高速に完了させ、ダイアログを閉じて本棚（`SCR-01`）の一覧へ即時反映する。
     - 未対応 URL や通信エラー時はダイアログを閉じずに `data-testid="add-novel-error"` に日本語エラーメッセージを表示し、入力値を保持して再試行可能とする。
     - 手動検証・Web開発時の入力補助として、サンプル URL 自動入力ボタン（`data-testid="fill-sample-url-button"`）を提供する。

### 2.3 `SCR-02`（`/novels/:novelId`）最小プレースホルダ画面と `TR-02` の整理

- [docs/specs/screen-transitions.md](../screen-transitions.md) の `TR-02` 定義を更新し、「URLから作品を追加」完了時は本棚画面（`SCR-01`）の一覧に即時反映して留まり、本棚の作品カード本体をタップしたときに `SCR-02`（`/novels/:novelId`）へ遷移する仕様に統一する。
- Issue #13 で `SCR-02` を本格実装するまでの受け皿として、`src/features/novel-detail/components/NovelDetailPlaceholder.tsx`（および 1対1 の `NovelDetailPlaceholder.stories.tsx`, `NovelDetailPlaceholder.test.tsx`）を作成し、`/novels/:novelId` ルートに以下の要素を持つ最小プレースホルダ画面（`data-testid="novel-detail-placeholder"`）を配置する：
  - `novelRepository.getNovelById(novelId)` から取得した作品タイトル・著者・あらすじの表示
  - 「第1話 / 続きから読む」ボタン（`data-testid="detail-read-button"` → `/novels/:novelId/chapters/:chapterIndex` へ遷移）
  - 「本棚へ戻る」ボタン（`data-testid="back-to-bookshelf-button"` → `/` へ遷移）

### 2.4 `SCR-03`（`/novels/:novelId/chapters/:chapterIndex`）リーダー画面のルート連携とオンデマンド本文取得

- [docs/specs/features/reader-view.md](../features/reader-view.md) を更新し、`PocReaderContainer` がルートパラメータ `novelId` および `chapterIndex`（省略時は既存の初期表示動作を維持）を受け取って動作するよう拡張する。
- **未キャッシュ話のオンデマンド取得（`TR-03` 対応）**:
  - URL 作品登録時点では目次のみが DB 保存され各話の `bodyHtml` は `null` であるため、リーダー画面マウント時に指定された `(novelId, chapterIndex)` の `ChapterRecord.bodyHtml` が `null` の場合は、自動的に `httpClient.getHtml({ url: chapter.url })` → `parser.parseChapterContent` → `chapterRepository.saveChapterBody` を実行して本文を表示する。
- **ナビゲーション導線**:
  - リーダー画面上部に「本棚へ戻る」ボタン（`data-testid="reader-back-to-bookshelf"` → `/`）および「作品詳細へ」ボタン（`data-testid="reader-back-to-detail"` → `/novels/:novelId`）を配置し、画面間の往復を可能にする。

### 2.5 Web/Dev 環境向け `createDefaultMockHttpClient` の正規表現拡張

- `src/app/ServiceProvider.tsx` の `createDefaultMockHttpClient()` において、作品トップ URL のモックルートを固定 2 件から正規表現 `/^https:\/\/kakuyomu\.jp\/works\/\d+$/`（およびエピソード URL `/^https:\/\/kakuyomu\.jp\/works\/\d+\/episodes\/\d+$/`）へ拡張する。
- これにより、Web ブラウザ開発環境（`npm run dev`）や Playwright IT において、任意のカクヨム作品 URL（またはエピソード URL）を入力しても CORS エラーでブロックされることなく決定論的にローカルフィクスチャで作品登録〜本文閲覧まで一気通貫で動作確認できる（なお `KakuyomuParser.parseNovelIndex` はリクエスト URL から `remoteWorkId` を抽出するため、異なる作品 ID の URL を入力すれば別作品として本棚に複数件登録できる）。

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Vitest UT: C0/C1/Functions 100%）

- **ルーティング基盤（`src/app/router.stories.tsx`, `src/app/router.test.tsx`）**:
  - `composeStories` を用いた `/`, `/novels/:novelId`, `/novels/:novelId/chapters/:chapterIndex`, および未知パスのルート解決検証
  - コロンを含む `novelId`（`"kakuyomu:16817330658027210412"`）の URL エンコード・デコード
  - `navigate` 呼び出し時の画面遷移とブラウザ `popstate`（戻る/進む）イベントの同期
- **本棚ロジックフック（`src/features/bookshelf/hooks/useBookshelf.test.ts`）**:
  - 初期ロード時の `listNovels()` 取得、空状態・複数件状態
  - カクヨム作品トップ URL / エピソード URL からの正規化・目次取得・`upsertNovelWithToc` 保存・一覧再取得・ダイアログ自動クローズ
  - 未対応 URL 入力時の通信前エラー拒絶、および HTTP 通信失敗時のエラー状態保持と再試行
- **UI コンポーネント単体テスト（Portable Stories `composeStories`）**:
  - `BookshelfEmptyState.test.tsx`: 空状態表示と追加ダイアログ起動コールバック発火
  - `NovelCard.test.tsx`: タイトル・著者・全話数/取得済み話数・しおり位置（設定あり/未読）の表示、カード選択（`onSelect`）と「続きから読む」（`onResume`）の独立発火（イベント伝播分離）
  - `AddNovelDialog.test.tsx`: 開閉状態、URL入力、サンプルURL自動入力、送信・キャンセル、ローディング中 disabled、エラー表示
  - `BookshelfPage.test.tsx` / `BookshelfContainer.test.tsx` / `NovelDetailPlaceholder.test.tsx`: 親子分離原則に基づく本棚画面およびプレースホルダ画面の統合動作

### 3.2 視覚的回帰テスト（Storybook VRT: 1280px / 375px）

- `router.stories.tsx`, `BookshelfEmptyState`, `NovelCard`（未読 / しおりあり）, `AddNovelDialog`（通常 / エラー表示 / 送信中）, `BookshelfPage`（ローディング / 空状態 / 作品一覧表示）, `BookshelfContainer`, `NovelDetailPlaceholder` の各 Story について、Desktop（1280×800）および Mobile（375×667）の VRT スナップショットを追加・検証する。

### 3.3 実ブラウザ結合テスト（Playwright IT: `SCN-01` 進化）

- `test/it/smoke.spec.ts` および `test/it/scenarios/scn01-poc-vertical-reader.spec.ts` を更新し、以下の E2E シナリオを 100% PASS させる：
  1. 初回起動時に `/`（`SCR-01` 本棚画面）の空状態（`bookshelf-empty`）が表示されること。
  2. 「URLから作品を追加」ダイアログを開き、カクヨム作品 URL を入力して登録すると、本棚一覧に作品カード（タイトル・著者・全2話/取得済み0話・未読）が追加されること。
  3. 作品カードの「続きから読む」ボタンをタップすると、`/novels/:novelId/chapters/1`（`SCR-03` リーダー画面）へ遷移し、第1話本文がオンデマンド取得されて縦書き（`vertical-rl`）・`<ruby>`・傍点付きで表示されること。
  4. テーマ（セピア）および組み方向（横書き）を変更し、ブラウザリロード（F5）後も設定と本文が保持されていること、および「本棚へ戻る」で本棚画面に戻ると取得済み話数が `1` に更新されていること。

---

## 4. 実装 Sub-issue 分割計画

1 PR あたり 200〜400 行目安の規律に従い、以下の 3 つの Sub-issue に分割して直列（逐次）実装する。

| Sub-issue                        | タイトル                                                                                      | 主な作業範囲・成果物                                                                                                                                                                                                                                                                                                                                                                                                                |
| :------------------------------- | :-------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sub-issue ① (#21: MK-1)**      | `[v0.1] 画面ルーティング基盤（router.tsx）と本棚状態管理フック（useBookshelf）の実装 (#12-1)` | ・`src/app/router.tsx` ＆ `router.stories.tsx` ＆ `router.test.tsx`（＋VRT更新）<br>・`src/app/ServiceProvider.tsx`（`createDefaultMockHttpClient` 正規表現拡張）＆ UT更新<br>・`src/features/bookshelf/hooks/useBookshelf.ts` ＆ `useBookshelf.test.ts`                                                                                                                                                                            |
| **Sub-issue ② (#22: MK-2)**      | `[v0.1] 本棚画面（SCR-01）UIコンポーネント群とStorybook・VRTの実装 (#12-2)`                   | ・`BookshelfEmptyState` / `NovelCard` / `AddNovelDialog` / `BookshelfPage` の実装<br>・1対1 の `*.stories.tsx` および Portable Stories `*.test.tsx`<br>・VRT スナップショット（1280px / 375px）更新・検証                                                                                                                                                                                                                           |
| **Sub-issue ③ (#23: MK-3 & IT)** | `[v0.1] Appルーター統合・リーダーオンデマンド取得連携・Playwright IT更新 (#12-3)`             | ・`BookshelfContainer`（`*.tsx`, `*.stories.tsx`, `*.test.tsx`）および `NovelDetailPlaceholder`（`*.tsx`, `*.stories.tsx`, `*.test.tsx`）実装<br>・`PocReaderContainer` のルートパラメータ＆未キャッシュ話オンデマンド取得対応<br>・`src/App.tsx` のルーター統合（＋VRT更新）<br>・Playwright IT（`smoke.spec.ts`, `scn01-poc-vertical-reader.spec.ts`）更新<br>・差分仕様の `docs/specs/changes/archive/` への移動（`Closes #12`） |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）

|   ID    | 申し送り事項の内容                                                                                                                                                                                                          | 解決先（対象 Issue / 成果物）     | 完了ゲート          |  状態  |
| :-----: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- | :------------------ | :----: |
| `HO-04` | `src/app/router.tsx` による画面ルーティング導入、および `SCR-01` 本棚画面（#12）・`SCR-02` 作品詳細/目次画面（#13）の実装（※本 Issue #12 で前半のルーティング＋`SCR-01` を解決し、後半 `SCR-02` 本格実装を #13 へ引き継ぐ） | Issue #12 / Issue #13             | Milestone `v0.1`    | `Open` |
| `HO-07` | 本棚画面（`SCR-01`）での URL 作品登録 → 「続きから読む」（`TR-03`）によるリーダー画面（`SCR-03`）での未キャッシュ第1話オンデマンド取得 → 縦書き・ルビ表示・リロード復元の実ブラウザ結合テスト（`SCN-01`）検証               | Issue #12 Sub-issue ③ (#23 IT PR) | Issue #12 PR マージ | `Open` |
