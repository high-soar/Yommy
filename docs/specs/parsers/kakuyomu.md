---
type: spec-parser
title: カクヨム パーサー・スクレイピング仕様書（kakuyomu.jp）
description: カクヨム小説の作品トップ・目次抽出、各話本文抽出、ルビ・傍点解析、およびURL正規化ルールの正本仕様。
status: Approved
updated: "2026-10-27"
tags: [parser, kakuyomu, scraping, ruby, bouten]
related_specs:
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/db-schema.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/novel-detail.md
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
  - まず `this.canParse(url)` でカクヨム作品 URL ドメインおよびパス形式を検証し、他サイト URL（例: `https://example.com/works/12345`）や非作品パスはエラー（`Error: Invalid Kakuyomu work URL`）を送出して拒否する。
  - 作品トップ URL、エピソード URL、およびクエリパラメータやフラグメント（`?foo=bar#p1`）が付与された URL から、作品トップの正規化 URL（`https://kakuyomu.jp/works/{workId}`）を生成して返却する。
  - パスから作品 ID（数字列）が抽出できない場合もエラー（`Error: Invalid Kakuyomu work URL`）を送出する。

---

## 3. 作品トップ（目次）抽出仕様（`parseNovelIndex`）

作品トップ HTML 文字列と URL を受け取り、作品メタデータおよび全エピソードの目次情報を抽出します。
DOM 要素の抽出は文書順ではなく、以下の優先順位リストに従って順次探索し、最初に見つかった要素を採用します。また、現行 Next.js レイアウトで埋め込まれる `<script id="__NEXT_DATA__" type="application/json">` の `props.pageProps.__APOLLO_STATE__` が存在する場合は、メタデータの補完および全エピソード・全章目次の優先抽出に利用します。

### 3.1 抽出対象と DOM セレクタ一覧

| フィールド名     | 型               | 抽出元 DOM セレクタ（優先順位リスト）                                                                                                                          | フォールバック / 備考                                                                                                                                | 対応 AC / 要件 |
| :--------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :------------- |
| `siteType`       | `'kakuyomu'`     | 固定値 `'kakuyomu'`                                                                                                                                            | -                                                                                                                                                    | `SYS-REQ-01`   |
| `remoteWorkId`   | `string`         | URL パス `/works/([0-9]+)` から抽出                                                                                                                            | URLから取得不可の場合 `link[rel="canonical"]` の href より抽出                                                                                       | `AC-02`        |
| `canonicalUrl`   | `string`         | `https://kakuyomu.jp/works/{remoteWorkId}`                                                                                                                     | 正規化 URL                                                                                                                                           | `SYS-REQ-01`   |
| `title`          | `string`         | 1. `#workTitle a`<br>2. `#workTitle`<br>3. `#catchphrase-and-title h1`<br>4. `header h1`<br>5. `h1`                                                            | 前後空白トリム。DOM から空の場合は `__APOLLO_STATE__` の `Work:${remoteWorkId}.title` で補完                                                         | `AC-02`        |
| `author`         | `string`         | 1. `#workAuthor-activityName a`<br>2. `#workAuthor-activityName`<br>3. `.partialGiftWidgetActivityName a`<br>4. `[href^="/users/"]`<br>5. `a[href*="/users/"]` | 前後空白トリム。DOM から空の場合は `__APOLLO_STATE__` の `UserAccount.activityName` → `Work.alternateAuthorName` → `UserAccount.name` の優先順で補完 | `AC-02`        |
| `synopsis`       | `string`         | 1. `#introduction`<br>2. `.widget-work-introduction`<br>3. `#description`<br>4. `[class*="IntroductionBox"]`<br>5. `[class*="introduction"]`                   | 前後空白トリム。DOM から空の場合は `__APOLLO_STATE__` の `Work.introduction` → `Work.catchphrase` の優先順で補完                                     | `AC-02`        |
| `nextTocPageUrl` | `string \| null` | 常に `null`（カクヨムは全目次が 1 ページに展開される）                                                                                                         | -                                                                                                                                                    | `AC-02`        |

### 3.2 目次エピソードリスト（`chapters: ParsedTocItem[]`）

カクヨム現行（Next.js）の作品トップページ HTML では、静的 DOM 上には初期 7 件程度のエピソードしか展開されず、アコーディオン形式の章や 8 話目以降は `<script id="__NEXT_DATA__" type="application/json">` 内の `props.pageProps.__APOLLO_STATE__` に格納されています。そのため、以下の 3 段階の優先順位で全エピソード・全章目次を抽出します。

1. **第 1 優先：`__NEXT_DATA__`（`__APOLLO_STATE__`）からの全件抽出**:
   - `doc.querySelector('script#__NEXT_DATA__')?.textContent` を JSON パースし、`props.pageProps.__APOLLO_STATE__` から `Work:${remoteWorkId}` オブジェクトを参照する（JSON パースエラーや構造不一致時は例外を握りつぶして DOM 走査へ安全にフォールバックする）。
   - `Work` オブジェクトの `tableOfContentsV2`（存在しない場合は `tableOfContents`）配列を順に走査し、各参照先の `TableOfContentsChapter` オブジェクトを取得する。
   - `TableOfContentsChapter.chapter` が `{ __ref: "Chapter:..." }` の場合は参照先 `Chapter.title.trim() || null` を `partTitle` とし、`null` の場合は `partTitle = null` とする。
   - `TableOfContentsChapter.episodeUnions` 配列の各要素から `Episode` オブジェクトを引き、`id` と `title` が存在する場合に `chapters` へ追加する（`chapterIndex` は 1 始まり連番、`url` は `https://kakuyomu.jp/works/${remoteWorkId}/episodes/${ep.id}`、`publishedAt` は文字列の場合のみ採用しそれ以外は `null`）。
2. **第 2 優先（フォールバック 1）：レガシー DOM（`.widget-toc-*`）の走査**:
   - `__NEXT_DATA__` から `chapters` が 1 件も得られなかった場合、セレクタ `[class*="widget-toc-chapter"], [class*="widget-toc-section"], [class*="widget-toc-episode"]` を出現順に走査する。
   - `widget-toc-chapter` / `widget-toc-section` のテキストを `currentPartTitle` として記憶し、後続の `widget-toc-episode` 内の `a[href*="/episodes/"]` からエピソード情報を構築する。
3. **第 3 優先（フォールバック 2）：現行 Next.js 静的 DOM（`[class*="WorkToc"]`）の走査**:
   - レガシー DOM でも 0 件の場合、セレクタ `[class*="WorkToc"] [class*="ChapterTitle"], [class*="WorkToc"] [class*="chapterTitle"], [class*="WorkToc"] a[href*="/episodes/"]` を文書順に走査する。
   - 章見出し要素（`ChapterTitle` / `chapterTitle`）が出現した場合は `currentPartTitle` を更新して後続エピソードへ伝播させる。
   - エピソードリンク `a[href*="/episodes/"]` では、`[class*="title"]` 子要素（なければリンク自身）のテキストから末尾の公開日付文字列（`/\d{4}年\d{1,2}月\d{1,2}日.*$/`）を除去した文字列を `title` とし、`<time>` 要素の `datetime` 属性を `publishedAt` として抽出する。

---

## 4. 各話本文抽出仕様（`parseChapterContent`）

各話エピソードページの HTML 文字列と URL を受け取り、サブタイトル、サニタイズ済み本文 HTML、バイトサイズ、および前後のナビゲーションリンクを抽出します。
DOM 要素の抽出は以下の優先順位リストに従って順次探索し、最初に見つかった要素を採用します。

### 4.1 抽出対象と DOM セレクタ一覧

| フィールド名      | 型               | 抽出元 DOM セレクタ（優先順位リスト）                                                              | 対応 AC / 要件                      |
| :---------------- | :--------------- | :------------------------------------------------------------------------------------------------- | :---------------------------------- |
| `remoteChapterId` | `string`         | URL パス `/episodes/([0-9]+)` から抽出                                                             | `AC-04`                             |
| `title`           | `string`         | 1. `.widget-episodeTitle`<br>2. `.episode-title`<br>3. `header h1`                                 | `AC-04`                             |
| `bodyHtml`        | `string`         | 本文コンテナ（1. `.widget-episodeBody`<br>2. `.js-episode-body`）の innerHTML をサニタイズしたもの | `SYS-REQ-02`, `SYS-REQ-07`, `AC-04` |
| `byteSize`        | `number`         | サニタイズ後 `bodyHtml` の UTF-8 バイト長（`new TextEncoder().encode(bodyHtml).length`）           | `AC-04`                             |
| `prevChapterUrl`  | `string \| null` | 1. `a#contentMain-previousEpisode`<br>2. `a[rel="prev"]` の `href`（絶対 URL 化。なければ `null`） | `AC-06`                             |
| `nextChapterUrl`  | `string \| null` | 1. `a#contentMain-nextEpisode`<br>2. `a[rel="next"]` の `href`（絶対 URL 化。なければ `null`）     | `AC-06`                             |

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

| AC ID       | 対象機能             | 検証条件                                                                                                                                                                                                        | 関連要件 ID                |
| :---------- | :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- |
| **`AC-01`** | URL 判定と正規化     | カクヨムの作品トップ URL・エピソード URL を正しく判定（`canParse`）し、クエリやハッシュが付与されていても作品トップ URL へ正規化（`normalizeWorkUrl`）できること。他サイトの URL では `false` を返すこと。      | `SYS-REQ-01`               |
| **`AC-02`** | 作品トップ情報の抽出 | 作品トップ HTML から作品 ID、タイトル、著者名、あらすじ、および全エピソード目次（`chapters`）を正しく抽出できること。                                                                                           | `SYS-REQ-01`               |
| **`AC-03`** | 章見出しの紐付け     | 目次内に章・部見出し（`__NEXT_DATA__` の `Chapter` または `widget-toc-chapter`）が存在する場合、以降のエピソードの `partTitle` に正しく紐付けられ、エピソード連番（`chapterIndex = 1, 2...`）が付与されること。 | `SYS-REQ-01`               |
| **`AC-04`** | 本文ルビ・傍点の抽出 | 各話 HTML からサブタイトルおよび `<ruby>`（`<rb>`, `<rt>`, `<rp>`）と傍点（`<em class="bouten">`）を保持した本文 HTML を抽出できること。                                                                        | `SYS-REQ-02`, `SYS-REQ-07` |
| **`AC-05`** | XSS 防止サニタイズ   | `<script>`, `onerror`, `style` 等の悪意あるタグや属性が本文 HTML に含まれていた場合、それらが完全に無害化・除去されること。                                                                                     | `SYS-REQ-07`               |
| **`AC-06`** | 前後ナビゲーション   | 単話作品、第1話（前話なし）、最終話（次話なし）、中間話において、`prevChapterUrl` および `nextChapterUrl` が正しく絶対 URL または `null` として抽出されること。                                                 | `SYS-REQ-02`, `SYS-REQ-11` |
| **`AC-07`** | 決定論的検証         | 一切の外部ネットワーク通信を行わず、ローカル HTML フィクスチャ（`__fixtures__/*.html`）により Vitest で C0/C1 100% 検証できること。                                                                             | `SYS-REQ-01`               |
