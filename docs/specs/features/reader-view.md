---
type: spec-feature
title: 小説リーダー機能仕様書（ReaderView / ReaderToolbar / PocReaderContainer）
description: 小説本文の縦書き・横書き組版表示、ルビ・傍点描画、4カラーテーマ切り替え、読書設定永続化、およびSCN-01統合シナリオの正本仕様。
status: Approved (Phase 3)
updated: "2026-10-25"
tags: [reader, vertical-writing, ruby, bouten, theme, localstorage, scn01]
related_specs:
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/specs/db-schema.md
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
- **対応要件**: `SYS-REQ-07`（縦書き・横書き切替）、`SYS-REQ-08`（ルビ・傍点・組版表示）、`SYS-REQ-11`（表示設定変更）
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

### 4.1 状態管理とパイプライン

1. **初期状態（空状態）**:
   - 作品未取得時は `data-testid="reader-empty"` を表示し、未登録メッセージを表示する。
2. **パーサー解決と URL 正規化**:
   - 作品取得ボタン押下時、**HTTP 通信前に** `parserRegistry.requireParser(initialWorkUrl)` を呼び出し、未対応サイトの場合は通信を行わずに即座に `data-testid="reader-error"` を表示する。
   - 対応サイトの場合は `parser.normalizeWorkUrl(initialWorkUrl)` により作品トップ URL へ正規化する。
3. **データ取得・保存パイプライン**:
   - `httpClient.getHtml({ url: normalizedWorkUrl })` で目次 HTML を取得。
   - `parser.parseNovelIndex(...)` で目次情報を解析。
   - `novelRepository.upsertNovelWithToc(...)` で作品および目次（`chapters`）を DB 保存。
   - 第1話が存在する場合、第1話エピソード本文を取得・サニタイズ解析し、`chapterRepository.saveChapterBody(...)` で保存。
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
- **目的**: 作品取得から縦書き・ルビ・傍点描画、設定変更、リロード復元までの一連のユーザー体験を一気通貫で検証する。
- **検証ステップ**:
  1. 初期表示で `reader-empty` が表示されることを確認。
  2. `fetch-novel-button` をクリック。
  3. `reader-title`（作品名）、`reader-chapter-title`（サブタイトル）、および `reader-view` が表示されることを確認。
  4. 初期表示が `writing-vertical-rl`（縦書き）であることを確認。
  5. 本文内の `<ruby>`（ルビ）および `<em class="bouten">`（傍点）が可視状態で正しくレンダリングされていることを確認。
  6. テーマを「セピア」に変更し、背景スタイルが反映されることを確認。
  7. 組み方向を「横書き」に変更し、`writing-horizontal-tb` が反映されることを確認。
  8. ブラウザをリロード（F5）し、再取得ボタンを押すことなく、即座に作品と本文が復元表示されることを確認。
