---
type: spec-parser
title: カクヨム パーサー・スクレイピング仕様書（kakuyomu.jp）
description: カクヨム小説の作品トップ・目次抽出、各話本文抽出、ルビ・傍点解析、検索・ランキング解析、およびURL正規化ルールの正本仕様。
status: Approved
updated: "2026-10-30"
tags:
  - parser
  - kakuyomu
  - scraping
  - ruby
  - bouten
  - search
  - ranking
related_specs:
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/db-schema.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
  - docs/guidelines/testing.md
related_tests:
  - src/parsers/kakuyomu/KakuyomuParser.test.ts
---

# カクヨム パーサー・スクレイピング仕様書（kakuyomu.jp）

本ドキュメントは、カクヨム（`kakuyomu.jp`）の作品メタデータ、エピソード目次、本文 HTML、および検索・ランキング結果の抽出・サニタイズ仕様を定める正本（Single Source of Truth）です。

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

| 種類                   | URL 形式                                                             | 例                                                                           |
| :--------------------- | :------------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **作品トップ（目次）** | `https://kakuyomu.jp/works/{workId}`                                 | `https://kakuyomu.jp/works/1177354054881162325`                              |
| **各話エピソード**     | `https://kakuyomu.jp/works/{workId}/episodes/{episodeId}`            | `https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326` |
| **作品検索**           | `https://kakuyomu.jp/search?q={query}&order={order}...`              | `https://kakuyomu.jp/search?q=追放&order=weekly_ranking`                     |
| **ランキング**         | `https://kakuyomu.jp/rankings/{target}/{period}?work_variation=long` | `https://kakuyomu.jp/rankings/all/weekly?work_variation=long`                |

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
   - `doc.querySelector('script#__NEXT_DATA__')?.textContent` を JSON パースし、`props.pageProps.__APOLLO_STATE__` から `Work:${remoteWorkId}` オブジェクトを参照する。
   - `Work` オブジェクトの `tableOfContentsV2`（存在しない場合は `tableOfContents`）配列を順に走査し、各参照先の `TableOfContentsChapter` オブジェクトを取得する。
   - `TableOfContentsChapter.chapter` が `{ __ref: "Chapter:..." }` の場合は参照先 `Chapter.title.trim() || null` を `partTitle` とし、`null` の場合は `partTitle = null` とする。
   - `TableOfContentsChapter.episodeUnions` 配列の各要素から `Episode` オブジェクトを引き、`id` と `title` が存在する場合に `chapters` へ追加する（`chapterIndex` は 1 始まり連番、`url` は `https://kakuyomu.jp/works/${remoteWorkId}/episodes/${ep.id}`、`publishedAt` は文字列の場合のみ採用しそれ以外は `null`）。
2. **第 2 優先（フォールバック 1）：レガシー DOM（`.widget-toc-*`）の走査**:
   - `__NEXT_DATA__` から `chapters` が 1 件も得られなかった場合、セレクタ `[class*="widget-toc-chapter"], [class*="widget-toc-section"], [class*="widget-toc-episode"]` を出現順に走査する。
3. **第 3 優先（フォールバック 2）：現行 Next.js 静的 DOM（`[class*="WorkToc"]`）の走査**:
   - レガシー DOM でも 0 件の場合、セレクタ `[class*="WorkToc"] [class*="ChapterTitle"], [class*="WorkToc"] [class*="chapterTitle"], [class*="WorkToc"] a[href*="/episodes/"]` を文書順に走査する。

---

## 4. 各話本文抽出仕様（`parseChapterContent`）

各話エピソードページの HTML 文字列と URL を受け取り、サブタイトル、サニタイズ済み本文 HTML、バイトサイズ、および前後のナビゲーションリンクを抽出します。

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

1. **危険要素・属性の完全除去（XSS 防止）**:
   - `<script>`, `<iframe>`, `<style>`, `<form>` 等のタグおよび `on*` 属性、`style`, `id` 属性を除去。
2. **許可する HTML タグ**:
   - `<p>`, `<br>`, `<ruby>`, `<rb>`, `<rt>`, `<rp>`, `<em class="bouten">`
3. **カクヨム固有表現の正規化**:
   - カクヨム本文中の傍点マークアップ（`<em class="bouten">`）はクラス `class="bouten"` を維持する。
   - 未許可タグはタグを取り除き、テキストおよび内部の許可子孫タグを展開する。

---

## 5. 検索結果抽出仕様（`searchNovels` / `buildSearchUrl`）

### 5.1 URL 生成（`buildSearchUrl`）

- **ベース URL**: `https://kakuyomu.jp/search`
- **引数**: `query: string`, `options?: NovelSearchOptions`
- **クエリ文字列組み立て**:
  - `q`: `encodeURIComponent(query.trim())`
  - `order`: `options?.order`（未指定時は `"weekly_ranking"`）
  - `serial_status`: `options?.serialStatus`（`"running"` または `"completed"` の場合のみ付与、`"all"` または未指定時は省略）
  - `genre_name`: `options?.genre`（小文字スラッグ。未指定時は省略）
  - `page`: `options?.page`（2 以上の整数時のみ付与、1 または未指定時は省略）

### 5.2 解析処理（`searchNovels`）

1. **第 1 優先：`__NEXT_DATA__` 内 Apollo State の解析**:
   - `<script id="__NEXT_DATA__">` から JSON をパースし、`props.pageProps.__APOLLO_STATE__` を取得。
   - `ROOT_QUERY` 内のキー `searchWorks(...)` から `SearchWorkConnection` オブジェクトを特定。
   - `pageInfo`: `{ hasNextPage: boolean }`、`totalCount`: `number` を取得。
   - `nodes` 配列の各 `{ __ref: "Work:<id>" }` を走査し、Apollo State 内の `Work:<id>` エンティティから以下を抽出：
     - `remoteWorkId`: `work.id`
     - `title`: `work.title`
     - `author`: `apolloState[work.author.__ref]?.activityName || work.alternateAuthorName || ""`
     - `synopsis`: `work.introduction || work.catchphrase || ""`
     - `genre`: `work.genre`、`genreLabel`: 日本語ジャンル名
     - `serialStatus`: `work.serialStatus.toLowerCase()`、`serialStatusLabel`: "連載中" または "完結済"
     - `episodeCount`: `work.publicEpisodeCount || 0`
     - `characterCount`: `work.totalCharacterCount || 0`
     - `tags`: `work.tagLabels || []`
     - `reviewPoints`: `work.totalReviewPoint || 0`
     - `lastEpisodePublishedAt`: `work.lastEpisodePublishedAt || null`
     - `workUrl`: `https://kakuyomu.jp/works/${work.id}`
2. **第 2 優先（フォールバック）：静的 DOM 走査**:
   - `__NEXT_DATA__` が取得できない場合、HTML の `a[href*="/works/"]` 要素および周囲の親コンテナから作品メタデータを抽出する。

---

## 6. ランキング抽出仕様（`getRanking` / `buildRankingUrl`）

### 6.1 URL 生成（`buildRankingUrl`）

- **ベース URL 形式**: `https://kakuyomu.jp/rankings/{target}/{period}?work_variation=long`
- **引数**: `options?: NovelRankingOptions`
- **パラメータ組み立て**:
  - `{target}`: `options?.genre || "all"`（総合時は `"all"`、個別ジャンル指定時は小文字スラッグ）
  - `{period}`: `options?.period || "weekly"`（`"daily"`, `"weekly"`, `"monthly"`, `"entire"`）
  - `work_variation=long`: カクヨム公式標準の長編指定（固定）
  - `page`: `options?.page`（2 以上の場合にクエリパラメータ `page` を付与）

### 6.2 解析処理（`getRanking`）

1. **第 1 優先：`__NEXT_DATA__` 内 Apollo State の解析**:
   - Apollo State の `ROOT_QUERY` 内から `rankedWorks(...)` オブジェクトを特定。
   - `nodes` 配列（最大100件）を順に走査し、`index + 1` を `rank`（順位: 1位〜）として付与。
   - 各作品エンティティの抽出ルールは `searchNovels` と同一。
2. **第 2 優先（フォールバック）：静的 DOM 走査**:
   - ランキング要素（`.RankingWorkBox_rank` または順位テキスト）と作品リンク `a[href*="/works/"]` から順位・作品情報を抽出。

---

## 7. 受け入れ条件一覧（Acceptance Criteria: `AC-xx`）

| AC ID       | 対象機能             | 検証条件                                                                                                                                                                                                   | 関連要件 ID      |
| :---------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| **`AC-01`** | URL 判定と正規化     | カクヨムの作品トップ URL・エピソード URL を正しく判定（`canParse`）し、クエリやハッシュが付与されていても作品トップ URL へ正規化（`normalizeWorkUrl`）できること。他サイトの URL では `false` を返すこと。 | `SYS-REQ-01`     |
| **`AC-02`** | 作品トップ情報の抽出 | 作品トップ HTML から作品 ID、タイトル、著者名、あらすじ、および全エピソード目次（`chapters`）を正しく抽出できること。                                                                                      | `SYS-REQ-01`     |
| **`AC-03`** | 章見出しの紐付け     | 目次内に章・部見出しが存在する場合、以降のエピソードの `partTitle` に正しく紐付けられ、エピソード連番が付与されること。                                                                                    | `SYS-REQ-01`     |
| **`AC-04`** | 本文ルビ・傍点の抽出 | 各話 HTML からサブタイトルおよび `<ruby>` と傍点（`<em class="bouten">`）を保持した本文 HTML を抽出できること。                                                                                            | `SYS-REQ-02, 07` |
| **`AC-05`** | XSS 防止サニタイズ   | `<script>`, `onerror`, `style` 等の悪意あるタグや属性が本文 HTML に含まれていた場合、それらが完全に無害化・除去されること。                                                                                | `SYS-REQ-07`     |
| **`AC-06`** | 前後ナビゲーション   | 単話作品、第1話、最終話、中間話において、`prevChapterUrl` および `nextChapterUrl` が正しく絶対 URL または `null` として抽出されること。                                                                    | `SYS-REQ-02, 11` |
| **`AC-07`** | 決定論的検証         | 一切の外部ネットワーク通信を行わず、ローカル HTML フィクスチャにより Vitest で C0/C1 100% 検証できること。                                                                                                 | `SYS-REQ-01`     |
| **`AC-08`** | 検索 URL 生成        | `buildSearchUrl` により、キーワード、4種の並び順、連載状態、ジャンル、ページ番号がカクヨムの規格に合致したクエリパラメータとして正しく構築されること。                                                     | `SYS-REQ-17`     |
| **`AC-09`** | 検索結果パース       | `searchNovels` により、検索結果 HTML（Apollo State）から作品メタデータ一覧、順位、`hasNextPage`、`totalCount` が正確に抽出されること。                                                                     | `SYS-REQ-17`     |
| **`AC-10`** | ランキング URL 生成  | `buildRankingUrl` により、指定した期間（日間/週間/月間/累計）およびジャンル（総合/個別）に応じたパス・クエリが正しく構築されること。                                                                       | `SYS-REQ-18`     |
| **`AC-11`** | ランキング結果パース | `getRanking` により、ランキング HTML から1位から順に番号付けされた作品メタデータ一覧が正確に抽出されること。                                                                                               | `SYS-REQ-18`     |
