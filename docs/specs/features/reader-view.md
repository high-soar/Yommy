---
type: spec-feature
title: 小説リーダー機能仕様書（ReaderView / ReaderToolbar / PocReaderContainer）
description: 小説本文の縦書き・横書き組版表示、ルビ・傍点描画、4カラーテーマ切り替え、読書設定永続化、未キャッシュ話のオンデマンド取得、およびSCN-01統合シナリオの正本仕様。
status: "Review (#12)"
updated: "2026-10-26"
tags: [reader, vertical-writing, ruby, bouten, theme, localstorage, scn01]
related_specs:
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/specs/db-schema.md
  - docs/specs/features/bookshelf.md
related_tests:
  - src/features/reader/components/ReaderView.test.tsx
  - src/features/reader/components/ReaderToolbar.test.tsx
  - src/features/reader/components/PocReaderContainer.test.tsx
  - test/vrt/vrt.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 小説リーダー機能仕様書（SCR-03）

本ドキュメントは、Yommy における小説本文閲覧（`SCR-03` 小説リーダー画面）の組版描画、操作ツールバー、状態管理コンテナ、およびブラウザ環境におけるローカル永続化の仕様を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 小説リーダー画面（`SCR-03`）
- **対応要件**: `SYS-REQ-02`（本文取得・オフライン閲覧・未キャッシュ話オンデマンド取得）、`SYS-REQ-07`（ルビ・傍点の正確な描画）、`SYS-REQ-08`（縦書き / 横書き切り替え）、`SYS-REQ-09`（フォント・サイズ・余白設定）、`SYS-REQ-10`（カラーテーマ切り替え）、`SYS-REQ-11`（スクロール＆1画面送り操作）、`SYS-REQ-12`（しおり・スクロール位置自動保存）
- **対象コンポーネント**:
  - `ReaderView`: 本文の組版、ルビ・傍点、カラーテーマを担う Presentational コンポーネント
  - `ReaderToolbar`: 縦横切替、カラーテーマ選択、作品更新トリガーを提供する操作ツールバー
  - `PocReaderContainer`: 通信、パーサー、ストレージリポジトリを統合する Container コンポーネント

---

## 2. ReaderView 仕様（本文組版レンダリング）

### 2.1 プロパティ契約 (`ReaderViewProps`)

| プロパティ名   | 型            | 必須 | 既定値          | 説明                                                                      |
| :------------- | :------------ | :--- | :-------------- | :------------------------------------------------------------------------ |
| `title`        | `string`      | 任意 | -               | 作品タイトル                                                              |
| `chapterTitle` | `string`      | 任意 | -               | 各話サブタイトル                                                          |
| `bodyHtml`     | `string`      | 必須 | -               | サニタイズ済み本文 HTML（ルビ `<ruby>`, 傍点 `<em class="bouten">` 含む） |
| `writingMode`  | `WritingMode` | 任意 | `'vertical-rl'` | 組み方向（`'vertical-rl'` または `'horizontal-tb'`）                      |
| `theme`        | `ReaderTheme` | 任意 | `'light'`       | 背景・文字色テーマ（`'light'`, `'sepia'`, `'dark'`, `'black'`）           |
| `fontSizePx`   | `number`      | 任意 | `18`            | 文字サイズ (px)                                                           |
| `lineHeight`   | `number`      | 任意 | `1.8`           | 行間倍率                                                                  |

### 2.2 セマンティック属性とスタイル仕様

- **テスト用・検証用属性**:
  - `data-testid="reader-view"`
  - `data-writing-mode`: 現在の組み方向（`"vertical-rl"` または `"horizontal-tb"`）
  - `data-theme`: 現在のカラーテーマ（`"light"`, `"sepia"`, `"dark"`, `"black"`）
- **日本語組版スタイル**:
  - 縦書き時: CSS `writing-mode: vertical-rl`、`text-orientation: mixed`、水平スクロール
  - 横書き時: CSS `writing-mode: horizontal-tb`、垂直スクロール
  - フォント: 日本語明朝体（`font-serif`）をベースとし、禁則処理（`line-break: strict; word-break: break-word`）を適用
  - ルビ・傍点: `<ruby>` はブラウザ標準のルビ表示、`<em class="bouten">` は CSS `text-emphasis: filled sesame`（セサミ傍点）で描画

---

## 3. ReaderToolbar 仕様（操作バー）

### 3.1 ツールバー項目と操作要素

- **組み方向切替**: `data-testid="toggle-orientation"` ボタン
  - 現在が縦書きの場合は「横書き表示に切替」、横書きの場合は「縦書き表示に切替」のラベルを表示。
- **カラーテーマ切替**: `data-testid="theme-{light|sepia|dark|black}"` ボタングループ
  - 選択中のテーマボタンには `aria-pressed="true"` を設定。
- **作品取得・更新トリガー**: `data-testid="fetch-novel-button"` ボタン
  - ローディング中（`isLoading = true`）は `disabled` となり、ボタン内テキストにスピナーまたは「取得中...」を表示。

---

## 4. PocReaderContainer 仕様（統合コンテナ）

### 4.1 プロパティとルートパラメータ連携 (`PocReaderContainerProps`)

| プロパティ名        | 型                          | 必須 | 説明                                                                                                                            |
| :------------------ | :-------------------------- | :--- | :------------------------------------------------------------------------------------------------------------------------------ |
| `initialWorkUrl`    | `string`                    | 任意 | 単体起動・更新時の対象作品 URL（既定値: 検証用カクヨム作品 URL）                                                                |
| `novelId`           | `string`                    | 任意 | ルート `/novels/:novelId/chapters/:chapterIndex` から渡される対象作品 ID                                                        |
| `chapterIndex`      | `number`                    | 任意 | ルートから渡される対象エピソード連番（1始まり、省略時は `1`）                                                                   |
| `onBackToBookshelf` | `() => void`                | 任意 | 「本棚へ戻る」（`/`）ナビゲーションコールバック（指定時のみ `data-testid="reader-back-to-bookshelf"` ボタンを表示）             |
| `onBackToDetail`    | `(novelId: string) => void` | 任意 | 「作品詳細へ」（`/novels/:novelId`）ナビゲーションコールバック（指定時のみ `data-testid="reader-back-to-detail"` ボタンを表示） |

### 4.2 状態管理とパイプライン

1. **初期状態（空状態）とルート指定ロード**:
   - `novelId` が指定されている場合は `novelRepository.getNovelById(novelId)` および `chapterRepository.getChapter(novelId, chapterIndex ?? 1)` を取得する。
   - **未キャッシュ話のオンデマンド本文取得（`TR-03` 対応）**:
     - 対象エピソード（`ChapterRecord`）が存在し、かつ `chapter.bodyHtml === null`（本棚での目次のみ登録直後など本文未キャッシュ状態）の場合、自動的に `parserRegistry.requireParser(chapter.url)` → `httpClient.getHtml({ url: chapter.url })` → `parser.parseChapterContent(...)` → `chapterRepository.saveChapterBody(...)` を実行して本文を保存・表示する。
   - `novelId` が未指定の場合は `novelRepository.listNovels()` の先頭作品（第1話）を読み込み、作品未登録時は `data-testid="reader-empty"` を表示する。
2. **パーサー解決と URL 正規化（手動取得・更新トリガー時）**:
   - 作品取得ボタン押下時、対象 URL を `const targetUrl = novel?.canonicalUrl ?? initialWorkUrl` として解決した上で、**HTTP 通信前に** `parserRegistry.requireParser(targetUrl)` を呼び出し、未対応サイトの場合は通信を行わずに即座に `data-testid="reader-error"` を表示する。
   - 対応サイトの場合は `parser.normalizeWorkUrl(targetUrl)` により作品トップ URL へ正規化する。
3. **データ取得・保存パイプライン**:
   - `httpClient.getHtml({ url: normalizedWorkUrl })` で目次 HTML を取得。
   - `parser.parseNovelIndex(...)` で目次情報を解析。
   - `novelRepository.upsertNovelWithToc(...)` で作品および目次（`chapters`）を DB 保存。
   - 対象話（`chapterIndex ?? 1`）が存在する場合、エピソード本文を取得・サニタイズ解析し、`chapterRepository.saveChapterBody(...)` で保存。
   - `ReaderView` に取得した作品・本文を表示。
4. **設定の読み出しと永続化**:
   - マウント時に `settingsRepository.getReaderSettings()` を呼び出し、保存済み設定（組み方向・テーマ等）を復元。
   - 設定変更時は即座に State を更新するとともに、`settingsRepository.updateReaderSettings(...)` で非同期保存。

---

## 5. ローカルストレージ永続化仕様（Web/Dev環境）

Web ブラウザおよび開発環境では、Capacitor ネイティブ SQLite プラグインが利用できないため、インメモリ SQLite（`sql.js`）と `localStorage` バックアップを組み合わせたハイブリッド永続化を提供します。

- **ストレージキー**: `yommy_sqlite_db_backup`
- **永続化フロー**:
  - DB 書き込み（`runTransaction` または個別 `execute`）完了時、`adapter.exportBinary()` で SQLite の全バイナリ（`Uint8Array`）をエクスポート。
  - バイナリを Base64 文字列へ変換し、`localStorage.setItem(STORAGE_KEY, base64Str)` に保存。
- **復元フロー**:
  - `ServiceProvider` 初期化時に `localStorage.getItem(STORAGE_KEY)` を取得。
  - Base64 デコードして `Uint8Array` に復元し、`createInMemoryDb(binary)` でインメモリ DB へ渡してテーブルおよび全レコードを復元。
- **例外ハンドリングと将来展望**:
  - `localStorage` 容量（約 5MB）超過（`QuotaExceededError`）時は、クラッシュせず `console.warn` で警告を記録しフォールバック。
  - Android 実機環境では `CapacitorSqliteAdapter`（ネイティブ SQLite ファイル）を使用するため、本制約は Web/Dev 環境限定となります。

---

## 6. SCN-01 結合シナリオ仕様（Playwright IT）

- **シナリオ ID**: `SCN-01`
- **目的**: 本棚画面（`SCR-01`）での URL 作品登録から、「続きから読む」（`TR-03`）によるリーダー画面（`SCR-03`）への遷移・未キャッシュ話オンデマンド取得、縦書き・ルビ・傍点描画、設定変更、リロード復元までの一連のユーザー体験を一気通貫で検証する。
- **検証ステップ**:
  1. 初期表示（`/`）で本棚の空状態（`bookshelf-empty`）が表示されることを確認。
  2. 「URLから作品を追加」ダイアログを開き、カクヨム作品 URL を入力して登録を実行し、本棚一覧に作品カード（`novel-card`）が追加されることを確認。
  3. 作品カードの「続きから読む」ボタン（`novel-card-resume`）をクリックし、`/novels/:novelId/chapters/1`（`SCR-03`）へ遷移することを確認。
  4. 第1話本文がオンデマンド取得され、`reader-title`（作品名）、`reader-chapter-title`（サブタイトル）、および `reader-view` が表示されることを確認。
  5. 初期表示が `writing-vertical-rl`（縦書き）であることを確認。
  6. 本文内の `<ruby>`（ルビ）および `<em class="bouten">`（傍点）が可視状態で正しくレンダリングされていることを確認。
  7. テーマを「セピア」に変更し、背景スタイルが反映されることを確認。
  8. 組み方向を「横書き」に変更し、`writing-horizontal-tb` が反映されることを確認。
  9. ブラウザをリロード（F5）し、再取得操作を行うことなく、即座に作品・本文および変更後の設定（横書き・セピア）が復元表示されることを確認。
  10. 「本棚へ戻る」（`reader-back-to-bookshelf`）をクリックして本棚画面（`/`）へ戻り、作品カードの取得済み話数が `1` に更新されていることを確認。
