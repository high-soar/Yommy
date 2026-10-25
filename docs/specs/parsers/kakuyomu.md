---
type: spec-parser
title: カクヨム パーサー・スクレイピング仕様書（kakuyomu.jp）
description: カクヨム小説の作品トップ・目次抽出、各話本文抽出、ルビ・傍点解析、およびURL正規化ルールの正本仕様。
status: Approved (Phase 3)
updated: "2026-10-25"
tags: [parser, kakuyomu, scraping, ruby, bouten]
related_specs:
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/features/reader-view.md
  - docs/guidelines/testing.md
related_tests:
  - src/parsers/kakuyomu/KakuyomuParser.test.ts
---

# カクヨム パーサー・スクレイピング仕様書（kakuyomu.jp）

本ドキュメントは、カクヨム（`kakuyomu.jp`）の作品メタデータ、エピソード目次、および本文 HTML の抽出・サニタイズ仕様を定める正本（Single Source of Truth）です。

---

## 1. 概要・対象ドメイン

- **対象サイト**: カクヨム（`https://kakuyomu.jp`）
- **サイト識別子 (`NovelSiteType`)**: `'kakuyomu'`
- **取得方式**:
  - Android 実機環境: `CapacitorHttp`（`HttpClientBridge` 経由）によるネイティブ CORS 回避通信
  - UT / テスト環境: ローカル HTML フィクスチャ（`src/parsers/kakuyomu/__fixtures__/*.html`）を用いた決定論的解析
- **解析基盤**: DOMParser（ブラウザ標準 / Vitest `jsdom`）を用いた純粋な DOM トラバーサル処理（外部ネットワーク通信なし）

---

## 2. URL 体系と正規化仕様

### 2.1 URL パターン

| 種類                   | URL 形式                                                  | 例                                                                           |
| :--------------------- | :-------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **作品トップ（目次）** | `https://kakuyomu.jp/works/{workId}`                      | `https://kakuyomu.jp/works/1177354054881162325`                              |
| **各話エピソード**     | `https://kakuyomu.jp/works/{workId}/episodes/{episodeId}` | `https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326` |

### 2.2 メソッド契約

- **`canParse(url: string): boolean`**:
  - ホスト名が `kakuyomu.jp` またはそのサブドメイン（`*.kakuyomu.jp`。`www.kakuyomu.jp` 含む）であり、パスが `/works/` で始まる場合に `true` を返す。
  - それ以外（他サイト URL や無効な文字列）は `false` を返す。
- **`normalizeWorkUrl(url: string): string`**:
  - 作品トップ URL、エピソード URL、およびクエリパラメータやフラグメント（`?foo=bar#p1`）が付与された URL から、作品トップの正規化 URL（`https://kakuyomu.jp/works/{workId}`）を生成して返却する。
  - パスから作品 ID（数字列）が抽出できない場合はエラー（`Error: Invalid Kakuyomu work URL`）を送出する。

---

## 3. 作品トップ（目次）抽出仕様（`parseNovelIndex`）

作品トップ HTML 文字列と URL を受け取り、作品メタデータおよび全エピソードの目次情報を抽出します。
DOM 要素の抽出は文書順ではなく、以下の優先順位リストに従って順次探索し、最初に見つかった要素を採用します。

### 3.1 抽出対象と DOM セレクタ一覧

| フィールド名     | 型               | 抽出元 DOM セレクタ（優先順位リスト）                                                      | フォールバック / 備考                                          | 対応 AC / 要件 |
| :--------------- | :--------------- | :----------------------------------------------------------------------------------------- | :------------------------------------------------------------- | :------------- |
| `siteType`       | `'kakuyomu'`     | 固定値 `'kakuyomu'`                                                                        | -                                                              | `SYS-REQ-01`   |
| `remoteWorkId`   | `string`         | URL パス `/works/([0-9]+)` から抽出                                                        | URLから取得不可の場合 `link[rel="canonical"]` の href より抽出 | `AC-02`        |
| `canonicalUrl`   | `string`         | `https://kakuyomu.jp/works/{remoteWorkId}`                                                 | 正規化 URL                                                     | `SYS-REQ-01`   |
| `title`          | `string`         | 1. `#workTitle a`<br>2. `#workTitle`<br>3. `#catchphrase-and-title h1`                     | 前後空白トリム、空の場合は空文字                               | `AC-02`        |
| `author`         | `string`         | 1. `#workAuthor-activityName a`<br>2. `#workAuthor-activityName`<br>3. `[href^="/users/"]` | 前後空白トリム、空の場合は空文字                               | `AC-02`        |
| `synopsis`       | `string`         | 1. `#introduction`<br>2. `.widget-work-introduction`<br>3. `#description`                  | 前後空白トリム、空の場合は空文字                               | `AC-02`        |
| `nextTocPageUrl` | `string \| null` | 常に `null`（カクヨムは全目次が 1 ページに展開される）                                     | -                                                              | `AC-02`        |

### 3.2 目次エピソードリスト（`chapters: ParsedTocItem[]`）

目次コンテナ（`.widget-toc-items`, `.widget-toc-main`, または全目次要素群）内の要素を出現順に走査し、以下の規則で各エピソード情報を構築します。

1. **部・章見出し（`partTitle`）の伝播**:
   - セレクタ `[class*="widget-toc-chapter"], [class*="widget-toc-section"]` に合致する要素が出現した場合、そのテキストを現在のアクティブな `currentPartTitle` として記憶する。
   - 章見出しがない場合、または最初の章見出し以前のエピソードでは `partTitle = null` とする。
2. **エピソード（`ParsedTocItem`）の抽出**:
   - セレクタ `[class*="widget-toc-episode"]` に合致する要素（またはエピソードリンク `a[href*="/episodes/"]` を含む要素）を抽出する。
   - `chapterIndex`: 1 始まりの連番インデックス（1, 2, 3...）。
   - `remoteChapterId`: リンク URL の `/episodes/([0-9]+)` から抽出。
   - `title`: エピソードリンク内のテキスト（サブタイトル）。前後空白トリム。
   - `url`: `https://kakuyomu.jp/works/{workId}/episodes/{episodeId}`（絶対 URL に正規化）。
   - `publishedAt`: `<time>` 要素の `datetime` 属性、または公開日時のテキスト（存在しない場合は `null`）。

---

## 4. 各話本文抽出仕様（`parseChapterContent`）

各話エピソードページの HTML 文字列と URL を受け取り、サブタイトル、サニタイズ済み本文 HTML、バイトサイズ、および前後のナビゲーションリンクを抽出します。
DOM 要素の抽出は以下の優先順位リストに従って順次探索し、最初に見つかった要素を採用します。

### 4.1 抽出対象と DOM セレクタ一覧

| フィールド名      | 型               | 抽出元 DOM セレクタ（優先順位リスト）                                                              | 対応 AC / 要件        |
| :---------------- | :--------------- | :------------------------------------------------------------------------------------------------- | :-------------------- |
| `remoteChapterId` | `string`         | URL パス `/episodes/([0-9]+)` から抽出                                                             | `AC-04`               |
| `title`           | `string`         | 1. `.widget-episodeTitle`<br>2. `header h1`<br>3. `.episode-title`                                 | `AC-04`               |
| `bodyHtml`        | `string`         | 本文コンテナ（1. `.widget-episodeBody`<br>2. `.js-episode-body`）の innerHTML をサニタイズしたもの | `SYS-REQ-08`, `AC-04` |
| `byteSize`        | `number`         | サニタイズ後 `bodyHtml` の UTF-8 バイト長（`new TextEncoder().encode(bodyHtml).length`）           | `AC-04`               |
| `prevChapterUrl`  | `string \| null` | 1. `a#contentMain-previousEpisode`<br>2. `a[rel="prev"]` の `href`（絶対 URL 化。なければ `null`） | `AC-06`               |
| `nextChapterUrl`  | `string \| null` | 1. `a#contentMain-nextEpisode`<br>2. `a[rel="next"]` の `href`（絶対 URL 化。なければ `null`）     | `AC-06`               |

### 4.2 本文 HTML サニタイズ＆ルビ・傍点規約（`HtmlSanitizer`）

リーダー画面での安全かつ統一された組版表示（`vertical-rl` / `horizontal-tb`）を保証するため、本文コンテナ内の HTML は以下のホワイトリスト規約に従って厳格に整形・サニタイズされます。

1. **危険要素・属性の完全除去（XSS 防止）**:
   - `<script>`, `<iframe>`, `<style>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<form>`, `<input>`, `<button>` 等のタグは内容ごと完全に除去する。
   - すべての要素から `on*` イベント属性（`onclick`, `onload`, `onerror` 等）および `style`, `id` 等の属性を除去する。
   - `javascript:` スキームを含むリンクや属性値は無効化する。
2. **許可する HTML タグ**:
   - `<p>`: 段落要素（属性なし）
   - `<br>`: 改行要素（属性なし）
   - `<ruby>`, `<rb>`, `<rt>`, `<rp>`: ルビ構成要素（属性なし）
   - `<em>`: 傍点要素（`class="bouten"` 属性のみ許可。その他の属性・クラスは除去）
3. **カクヨム固有表現の正規化**:
   - カクヨム本文中の傍点マークアップ（`<em class="bouten">`）はクラス `class="bouten"` を維持する。
   - 未許可タグ（`<span>`, `<div>` 等）はタグを取り除き、テキストおよび内部の許可子孫タグを展開（unwrap）する。
   - 空行（`<p class="blank"><br></p>` または `<p><br></p>`）は `<p><br></p>` に統一する。

---

## 5. 受け入れ条件一覧（Acceptance Criteria: `AC-xx`）

| AC ID       | 対象機能             | 検証条件                                                                                                                                                                                                   | 関連要件 ID  |
| :---------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- |
| **`AC-01`** | URL 判定と正規化     | カクヨムの作品トップ URL・エピソード URL を正しく判定（`canParse`）し、クエリやハッシュが付与されていても作品トップ URL へ正規化（`normalizeWorkUrl`）できること。他サイトの URL では `false` を返すこと。 | `SYS-REQ-01` |
| **`AC-02`** | 作品トップ情報の抽出 | 作品トップ HTML から作品 ID、タイトル、著者名、あらすじ、および全エピソード目次（`chapters`）を正しく抽出できること。                                                                                      | `SYS-REQ-01` |
| **`AC-03`** | 章見出しの紐付け     | 目次内に章・部見出し（`widget-toc-chapter`）が存在する場合、以降のエピソードの `partTitle` に正しく紐付けられ、エピソード連番（`chapterIndex = 1, 2...`）が付与されること。                                | `SYS-REQ-01` |
| **`AC-04`** | 本文ルビ・傍点の抽出 | 各話 HTML からサブタイトルおよび `<ruby>`（`<rb>`, `<rt>`, `<rp>`）と傍点（`<em class="bouten">`）を保持した本文 HTML を抽出できること。                                                                   | `SYS-REQ-08` |
| **`AC-05`** | XSS 防止サニタイズ   | `<script>`, `onerror`, `style` 等の悪意あるタグや属性が本文 HTML に含まれていた場合、それらが完全に無害化・除去されること。                                                                                | `SYS-REQ-08` |
| **`AC-06`** | 前後ナビゲーション   | 単話作品、第1話（前話なし）、最終話（次話なし）、中間話において、`prevChapterUrl` および `nextChapterUrl` が正しく絶対 URL または `null` として抽出されること。                                            | `SYS-REQ-01` |
| **`AC-07`** | 決定論的検証         | 一切の外部ネットワーク通信を行わず、ローカル HTML フィクスチャ（`__fixtures__/*.html`）により Vitest で C0/C1 100% 検証できること。                                                                        | `SYS-REQ-01` |

### 4.2 本文 HTML サニタイズ＆ルビ・傍点規約（`HtmlSanitizer`）

リーダー画面での安全かつ統一された組版表示（`vertical-rl` / `horizontal-tb`）を保証するため、本文コンテナ内の HTML は以下のホワイトリスト規約に従って厳格に整形・サニタイズされます。

1. **危険要素・属性の完全除去（XSS 防止）**:
   - `<script>`, `<iframe>`, `<style>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<form>`, `<input>`, `<button>` 等のタグは内容ごと完全に除去する。
   - すべての要素から `on*` イベント属性（`onclick`, `onload`, `onerror` 等）および `style`, `id` 等の属性を除去する。
   - `javascript:` スキームを含むリンクや属性値は無効化する。
2. **許可する HTML タグ**:
   - `<p>`: 段落要素（属性なし）
   - `<br>`: 改行要素（属性なし）
   - `<ruby>`, `<rb>`, `<rt>`, `<rp>`: ルビ構成要素（属性なし）
   - `<em>`: 傍点要素（`class="bouten"` 属性のみ許可。その他の属性・クラスは除去）
3. **カクヨム固有表現の正規化**:
   - カクヨム本文中の傍点マークアップ（`<em class="bouten">`）はクラス `class="bouten"` を維持する。
   - 未許可タグ（`<span>`, `<div>` 等）はタグを取り除き、テキストおよび内部の許可子孫タグを展開（unwrap）する。
   - 空行（`<p class="blank"><br></p>` または `<p><br></p>`）は `<p><br></p>` に統一する。

---

## 5. 受け入れ条件一覧（Acceptance Criteria: `AC-xx`）

| AC ID       | 対象機能             | 検証条件                                                                                                                                                                                                   |
| :---------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AC-01`** | URL 判定と正規化     | カクヨムの作品トップ URL・エピソード URL を正しく判定（`canParse`）し、クエリやハッシュが付与されていても作品トップ URL へ正規化（`normalizeWorkUrl`）できること。他サイトの URL では `false` を返すこと。 |
| **`AC-02`** | 作品トップ情報の抽出 | 作品トップ HTML から作品 ID、タイトル、著者名、あらすじ、および全エピソード目次（`chapters`）を正しく抽出できること。                                                                                      |
| **`AC-03`** | 章見出しの紐付け     | 目次内に章・部見出し（`widget-toc-chapter`）が存在する場合、以降のエピソードの `partTitle` に正しく紐付けられ、エピソード連番（`chapterIndex = 1, 2...`）が付与されること。                                |
| **`AC-04`** | 本文ルビ・傍点の抽出 | 各話 HTML からサブタイトルおよび `<ruby>`（`<rb>`, `<rt>`, `<rp>`）と傍点（`<em class="bouten">`）を保持した本文 HTML を抽出できること。                                                                   |
| **`AC-05`** | XSS 防止サニタイズ   | `<script>`, `onerror`, `style` 等の悪意あるタグや属性が本文 HTML に含まれていた場合、それらが完全に無害化・除去されること。                                                                                |
| **`AC-06`** | 前後ナビゲーション   | 単話作品、第1話（前話なし）、最終話（次話なし）、中間話において、`prevChapterUrl` および `nextChapterUrl` が正しく絶対 URL または `null` として抽出されること。                                            |
| **`AC-07`** | 決定論的検証         | 一切の外部ネットワーク通信を行わず、ローカル HTML フィクスチャ（`__fixtures__/*.html`）により Vitest で C0/C1 100% 検証できること。                                                                        |
