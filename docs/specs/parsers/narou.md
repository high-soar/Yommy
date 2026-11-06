---
type: spec-parser
title: "小説家になろう パーサー・スクレイピング仕様書（ncode.syosetu.com）"
description: "小説家になろう（ncode.syosetu.com）の作品トップ・複数ページ目次抽出、短編作品対応、各話本文（前書き・本編・後書き）抽出、ルビ・傍点正規化、およびURL正規化ルールの正本仕様。"
status: "Review (#239)"
updated: "2026-11-06"
tags:
  - parser
  - narou
  - syosetu
  - scraping
  - ruby
  - bouten
  - multi-page-toc
  - short-story
related_specs:
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/db-schema.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/archive/issue-239-narou-parser-and-multi-page-toc.md
  - docs/guidelines/testing.md
related_tests:
  - src/parsers/parserRegistry.test.ts
  - src/parsers/sanitizer.test.ts
---

# 小説家になろう パーサー・スクレイピング仕様書（ncode.syosetu.com）

本ドキュメントは、小説家になろう（一般作品サイト：`https://ncode.syosetu.com`）の作品メタデータ、エピソード目次（100 話超の複数ページ目次および 1 話完結の短編作品を含む）、各話本文 HTML（前書き・本編・後書き結合、ルビ `<ruby>`・傍点 `<em class="bouten">` 正規化）の抽出・サニタイズ仕様を定める正本（Single Source of Truth）です。

---

## 1. 概要・対象ドメイン

- **対象サイト**: 小説家になろう 一般作品（`https://ncode.syosetu.com`）
  - ※18 禁サイト（`novel18.syosetu.com` 等、年齢確認 Cookie 必須領域）は対象外。
- **サイト識別子 (`NovelSiteType`)**: `'narou'`
- **取得方式**:
  - Android 実機環境: `CapacitorHttp`（`HttpClientBridge` 経由）によるネイティブ CORS 回避通信
  - UT / テスト環境: ローカル HTML フィクスチャ（`src/parsers/narou/__fixtures__/*.html`）を用いた決定論的解析
- **解析基盤**: `DOMParser`（ブラウザ標準 / Vitest `jsdom`）を用いた純粋な DOM トラバーサル処理（外部ネットワーク通信なし）

---

## 2. URL 体系と正規化仕様

### 2.1 URL パターン

| 種類                             | URL 形式                                      | 例                                       |
| :------------------------------- | :-------------------------------------------- | :--------------------------------------- |
| **作品トップ（目次・短編）**     | `https://ncode.syosetu.com/{ncode}/`          | `https://ncode.syosetu.com/n9669bk/`     |
| **作品トップ（複数ページ目次）** | `https://ncode.syosetu.com/{ncode}/?p={page}` | `https://ncode.syosetu.com/n9669bk/?p=2` |
| **各話エピソード（連載）**       | `https://ncode.syosetu.com/{ncode}/{epNo}/`   | `https://ncode.syosetu.com/n9669bk/1/`   |

- `{ncode}` は先頭が `n`（または `N`）で始まる英数字識別子（正規表現: `/^n[0-9a-z]+$/i`）。Yommy 内では常に **小文字**（例: `n9669bk`）へ正規化し、末尾スラッシュ `/` を付与した `https://ncode.syosetu.com/{ncode}/` を正規化作品トップ URL（`canonicalUrl`）とする。

### 2.2 メソッド契約

- **`canParse(url: string): boolean`**:
  - 有効な `http:` または `https:` URL であり、ホスト名が `ncode.syosetu.com`（大文字小文字不問）であり、かつパスの第 1 セグメントが有効な ncode（`/^\/(n[0-9a-z]+)(?:\/|$)/i`、ただし予約パス `/novelview/` 等を除く `n` + 数字を含む形式 `/^\/(n\d+[a-z0-9]*)(?:\/|$)/i`）に一致する場合に `true` を返す。
  - それ以外（`novel18.syosetu.com`, `kakuyomu.jp`, 無効な文字列等）は `false` を返す。
- **`normalizeWorkUrl(url: string): string`**:
  - まず `this.canParse(url)` で対象 URL かどうかを検証し、対象外の場合はエラー（`Error: Invalid Narou work URL`）を送出する。
  - 作品トップ URL、複数ページ目次 URL（`?p=2`）、各話エピソード URL（`/n9669bk/1/`）、大文字 ncode URL（`/N9669BK/`）、またはクエリ・ハッシュ付き URL から小文字の `{ncode}` を抽出し、`https://ncode.syosetu.com/{ncode}/` に正規化して返却する。

---

## 3. 作品トップ（目次・短編）抽出仕様（`parseNovelIndex`）

作品トップ HTML 文字列と URL を受け取り、作品メタデータ、エピソード目次一覧、および次ページ目次 URL（`nextTocPageUrl`）を抽出します。
DOM 要素の抽出は文書順ではなく、以下の優先順位リストに従って順次探索（`queryFirst`）し、最初に見つかった要素を採用します。

### 3.1 抽出対象と DOM セレクタ一覧

| フィールド名     | 型               | 抽出元 DOM セレクタ（優先順位リスト）                                                                                                       | フォールバック / 備考                                                                                                                                                                                                                                                                                                                                                                                 | 対応 AC / 要件   |
| :--------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| `siteType`       | `'narou'`        | 固定値 `'narou'`                                                                                                                            | -                                                                                                                                                                                                                                                                                                                                                                                                     | `SYS-REQ-01`     |
| `remoteWorkId`   | `string`         | `pageUrl` のパス `/^\/(n\d+[a-z0-9]*)/i` から抽出し小文字化                                                                                 | `pageUrl` から取得不可の場合は `link[rel="canonical"]` または `meta[property="og:url"]` から抽出                                                                                                                                                                                                                                                                                                      | `AC-NR-01`, `02` |
| `canonicalUrl`   | `string`         | `https://ncode.syosetu.com/{remoteWorkId}/`                                                                                                 | 小文字 ncode ＋ 末尾スラッシュ `/`                                                                                                                                                                                                                                                                                                                                                                    | `AC-NR-01`       |
| `title`          | `string`         | 1. `.p-novel__title`<br>2. `.novel_title`<br>3. `meta[property="og:title"]` (`content`)<br>4. `title`                                       | 前後空白トリム                                                                                                                                                                                                                                                                                                                                                                                        | `AC-NR-02`       |
| `author`         | `string`         | 1. `.p-novel__author a`<br>2. `.p-novel__author`<br>3. `.novel_writername a`<br>4. `.novel_writername`<br>5. `meta[name="twitter:creator"]` | `.p-novel__author` / `.novel_writername` のテキストから先頭の `作者：` / `作者:` を除去して前後空白トリム                                                                                                                                                                                                                                                                                             | `AC-NR-02`       |
| `synopsis`       | `string`         | 1. `#novel_ex`<br>2. `.p-novel__summary`<br>3. `meta[name="description"]` (`content`)                                                       | `<br>` を改行 `\n` に変換してテキスト抽出・前後トリム。`meta[name="description"]` フォールバック時は末尾の `// 無料オンライン小説です` を除去                                                                                                                                                                                                                                                         | `AC-NR-02`, `05` |
| `nextTocPageUrl` | `string \| null` | 1. `.c-pager .c-pager__item--next[href]`<br>2. `.novelview_pager-next[href]`<br>3. `a.c-pager__item--next[href]`                            | `href` 属性が存在する場合は `https://ncode.syosetu.com` 基準の絶対 URL（例: `https://ncode.syosetu.com/n9669bk/?p=2`）に変換し、かつ **`https:` スキーム・`canParse(nextUrl) === true`・`normalizeWorkUrl(nextUrl) === canonicalUrl`（同一作品）** をすべて満たす場合のみ採用する（外部ドメイン・`http:`・`novel18.syosetu.com`・別作品パスの場合や、`<span>` リンクなし最終ページ・短編時は `null`） | `AC-NR-04`       |

### 3.2 連載作品の目次エピソードリスト（`.p-eplist` / `.index_box`）

1. **現行 DOM（`.p-eplist`）およびレガシー DOM（`.index_box`）の走査**:
   - コンテナ `.p-eplist`（存在しない場合は `.index_box`）内の要素 `.p-eplist__chapter-title, .p-eplist__sublist, .chapter_title, .novel_sublist2` を出現順に走査する。
   - 章見出し要素（`.p-eplist__chapter-title` または `.chapter_title`）が出現した場合、そのトリム済みテキストを現在の `currentPartTitle` として保持する（空文字の場合は `null`）。
   - エピソード要素（`.p-eplist__sublist` または `.novel_sublist2`）が出現した場合：
     - リンク要素（`a.p-eplist__subtitle` または `.subtitle a`）から `href` とサブタイトル文字列（`title`）を取得する。
     - `href`（例: `/n9669bk/1/`）からエピソード識別子 `remoteChapterId`（例: `"1"`）を抽出し、正規化 URL `https://ncode.syosetu.com/${remoteWorkId}/${remoteChapterId}/` を構築する。
     - 公開日時要素（`.p-eplist__update` または `.long_update`）から **初回公開日時**（先頭の `YYYY/MM/DD HH:mm` または `YYYY/MM/DD` 形式の文字列、例: `"2012/11/22 17:00"`）を正規表現 `/(\d{4}\/\d{2}\/\d{2}(?:\s+\d{2}:\d{2})?)/` で抽出し `publishedAt` に設定する（改稿日時 `<span title="... 改稿">` や `（... 改稿）` が付属していても初回公開日時を採用し、過去話の誤字修正による本棚ソート逆転を防止する）。

### 3.3 短編作品（1 話完結・`.p-eplist` なし）の擬似 1 話目次生成

- 作品トップページに目次リスト要素（`.p-eplist` / `.index_box` のエピソード）が 1 件も存在せず、ページ内に本文領域（`.p-novel__body` または `#novel_honbun`）が存在する場合は **短編作品（1 話完結）** と判定する。
- 短編作品の場合、`chapters` 配列に以下の擬似 1 話アイテムを格納して返却する：
  - `chapterIndex`: `1`
  - `remoteChapterId`: `"1"`
  - `partTitle`: `null`
  - `title`: 抽出した作品タイトル（`title`）
  - `url`: `canonicalUrl`（`https://ncode.syosetu.com/${remoteWorkId}/`）
  - `publishedAt`: `.p-novel__date-published`（例: `掲載日：2026/11/06` または `2026年11月06日`）から抽出した日付文字列（`"YYYY/MM/DD"` 形式に正規化、存在しない場合は `null`）
  - `nextTocPageUrl`: `null`

### 3.4 複数ページ目次（`nextTocPageUrl`）の連続取得パイプライン（`fetchFullNovelIndex`）

小説家になろうの連載作品では 1 ページあたり最大 100 話までの目次が表示され、101 話以上の作品は `?p=2`, `?p=3`... に分割されます。作品登録時および目次更新時には、共通ヘルパー `fetchFullNovelIndex`（`src/parsers/fetchFullNovelIndex.ts`）を用いて全ページを連続取得・結合します：

1. **ページ間レートリミット制御**:
   - 1 ページ目（`canonicalUrl`）を取得・パースした後、`nextTocPageUrl` が非 `null` の間、サーバー負荷軽減のため **`DEFAULT_TOC_PAGE_INTERVAL_MS`（`500ms`）** のウェイトを挟んで次ページを順次直列取得する（`AbortSignal` による中断に対応）。
2. **ループ上限ガード・循環参照防止・同一作品ホスト検証（SSRF 防止）**:
   - 最大取得ページ数を **`MAX_TOC_PAGES`（`100` ページ ＝ 最大 10,000 話）** に制限する。
   - 次ページ URL（`nextTocPageUrl`）に対して、**`https:` プロトコルかつ `parser.canParse(nextUrl) === true` かつ `parser.normalizeWorkUrl(nextUrl) === canonicalUrl`（同一作品）** を検証し、満たさない場合（外部ドメイン・非 HTTPS・別作品パス等）はリクエストを送信せずループを安全に終了する。
   - 訪問済み URL セット（`visitedUrls: Set<string>`）を管理し、万一同一 URL が再度 `nextTocPageUrl` に出現した場合または 100 ページに達した場合はループを安全に終了する。
3. **ページ跨ぎ時の章見出し（`partTitle`）引き継ぎと `chapterIndex` 連番再採番**:
   - 2 ページ目以降（`?p=2`...）の先頭エピソード群に `.p-eplist__chapter-title` が存在しない（`partTitle === null`）場合、直前ページの末尾エピソードが保持していた `partTitle` を引き継ぐ。
   - 全ページのエピソードを結合した上で、先頭から順に `chapterIndex: 1, 2, ..., N` の 1 始まり連番を再付与し、`nextTocPageUrl: null` とした完全な `ParsedNovelIndex` を返却する。
4. **途中ページ失敗時のアトミック中断**:
   - 2 ページ目以降の HTTP 取得やパースで例外が発生した場合は、部分的な不完全目次で DB を上書きしないようそのまま例外を送出し、呼び出し元で既存データを保護する。

---

## 4. 各話本文抽出仕様（`parseChapterContent`）

各話エピソードページ（または短編作品トップページ）の HTML 文字列と URL を受け取り、サブタイトル、サニタイズ済み本文 HTML（前書き・本編・後書き結合）、UTF-8 バイトサイズ、および前後のナビゲーションリンクを抽出します。

### 4.1 抽出対象と DOM セレクタ一覧

| フィールド名      | 型               | 抽出元 DOM セレクタ（優先順位リスト）                                                                                                                            | 対応 AC / 要件                               |
| :---------------- | :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| `remoteChapterId` | `string`         | URL パス `/^\/n\d+[a-z0-9]*\/(\d+)/i` から抽出（短編作品トップ URL `/^\/n\d+[a-z0-9]*\/?$/i` の場合は `"1"`）                                                    | `AC-NR-05`, `06`                             |
| `title`           | `string`         | 1. `.p-novel__subtitle-episode`<br>2. `.p-novel__title--rensai`<br>3. `.novel_subtitle`<br>4. `.p-novel__title`<br>5. `.novel_title`                             | `AC-NR-05`, `06`                             |
| `bodyHtml`        | `string`         | 前書き・本編・後書きを結合し、傍点正規化および `HtmlSanitizer.sanitizeChapterHtml` を適用した HTML 文字列                                                        | `SYS-REQ-02`, `SYS-REQ-07`, `AC-NR-06`〜`08` |
| `byteSize`        | `number`         | サニタイズ後 `bodyHtml` の UTF-8 バイト長（`new TextEncoder().encode(bodyHtml).length`）                                                                         | `AC-NR-06`                                   |
| `prevChapterUrl`  | `string \| null` | 1. `.c-pager__item--before[href]`<br>2. `.novel_bn a[rel="prev"]`<br>3. `a[rel="prev"]` の `href`（`https://ncode.syosetu.com` 基準の絶対 URL、なければ `null`） | `AC-NR-09`                                   |
| `nextChapterUrl`  | `string \| null` | 1. `.c-pager__item--next[href]`<br>2. `.novel_bn a[rel="next"]`<br>3. `a[rel="next"]` の `href`（`https://ncode.syosetu.com` 基準の絶対 URL、なければ `null`）   | `AC-NR-09`                                   |

### 4.2 前書き・本編・後書きの抽出と区切り結合ルール

なろうの現行 DOM では、前書き・本編・後書きのすべてに `.p-novel__text` クラスが付与され、前書きには `.p-novel__text--preface`、後書きには `.p-novel__text--afterword` のモディファイアクラスが追加されます。

1. **各パートの抽出セレクタ**:
   - **前書き (`preface`)**: `1. .p-novel__text.p-novel__text--preface`, `2. #novel_p`
   - **本編 (`mainBody`)**: `1. .p-novel__text:not(.p-novel__text--preface):not(.p-novel__text--afterword)`, `2. #novel_honbun`
   - **後書き (`afterword`)**: `1. .p-novel__text.p-novel__text--afterword`, `2. #novel_a`
2. **区切り結合フォーマット**:
   - `HtmlSanitizer` の許可タグ契約（`<p>`, `<br>`, `<ruby>`, `<rb>`, `<rt>`, `<rp>`, `<em class="bouten">`）を変更せず、前書き・後書きが存在して非空の場合には、本編との間に以下の区切り段落を挿入して結合する：
     ```html
     <p><br /></p>
     <p>────────────</p>
     <p><br /></p>
     ```
   - 前書きが存在しない場合は先頭に区切りを入れず、後書きが存在しない場合は末尾に区切りを入れない。

### 4.3 なろう傍点表現の `<em class="bouten">` 正規化とサニタイズ

1. **傍点 `<ruby>` の検出と変換**:
   - なろうの本文では、傍点が `<ruby>思われている<rp>(</rp><rt>・・・・・・</rt><rp>)</rp></ruby>` または `<ruby><rb>文字</rb><rp>(</rp><rt>・・</rt><rp>)</rp></ruby>` のように、`<rt>` 内が中黒等の傍点記号（正規表現 `/^[・﹅●]+$/`）のみで構成された `<ruby>` 要素として出力される。
   - `NarouParser`（またはサニタイズ前処理）では、`<ruby>` 要素のうち `<rt>` のトリム済みテキストが `/^[・﹅●]+$/` に一致し、かつ基底テキスト（`<rb>` または `<rt>`/`<rp>` 以外のテキストノード）が非空であるものを **`<em class="bouten">{基底テキスト}</em>`** に置換する。
   - `<rt>` が通常の読み仮名（ひらがな・カタカナ・漢字・英数字等）である `<ruby>` 要素は、そのまま `<ruby>` として保持する。
2. **XSS 防止サニタイズ（`HtmlSanitizer` 連携）**:
   - 正規化後の HTML を `sanitizeChapterHtml` に通し、`<script>`, `<style>`, `id="L1"` 等の不要属性・危険要素を完全に除去し、空段落 `<p></p>` や `<p><br /></p>` を `<p><br></p>` に統一する。

---

## 5. 受け入れ条件一覧（Acceptance Criteria: `AC-NR-xx`）

| AC ID          | 対象機能                                    | 検証条件                                                                                                                                                                                                                                                                | 関連要件 ID      |
| :------------- | :------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| **`AC-NR-01`** | URL 判定と小文字正規化                      | `https://ncode.syosetu.com/n9669bk/`、各話 URL、ページネーション URL、大文字 ncode URL を正しく判定（`canParse`）し、`https://ncode.syosetu.com/n9669bk/` へ正規化（`normalizeWorkUrl`）できること。他サイトや `novel18.syosetu.com` は `false` を返すこと。            | `SYS-REQ-01`     |
| **`AC-NR-02`** | 連載作品トップ情報の抽出                    | 連載作品トップ HTML から小文字 `remoteWorkId`、タイトル、著者名（「作者：」除去済み）、あらすじ、および各話目次（`chapters`）と初回公開日時（`publishedAt`）を正しく抽出できること。                                                                                    | `SYS-REQ-01`     |
| **`AC-NR-03`** | 章見出しの紐付け                            | 目次（`.p-eplist`）内に `.p-eplist__chapter-title` が存在する場合、以降のエピソードの `partTitle` に正しく紐付けられること。                                                                                                                                            | `SYS-REQ-01`     |
| **`AC-NR-04`** | 複数ページ目次の次ページ URL 抽出と検証     | 100 話超の連載作品目次ページにおいて `.c-pager__item--next[href]` から絶対 URL 化された `nextTocPageUrl`（`https://ncode.syosetu.com/{ncode}/?p=2` 等）を抽出し、最終ページ・100 話以下の作品、または外部ドメイン・非 HTTPS・別作品パスのリンクでは `null` を返すこと。 | `SYS-REQ-01, 04` |
| **`AC-NR-05`** | 短編作品（1 話完結）の目次・本文抽出        | `.p-eplist` が存在せず `.p-novel__body` が存在する短編作品ページにおいて、`chapterIndex: 1`, `remoteChapterId: "1"`, `url: canonicalUrl` の擬似 1 話目次を生成でき、`parseChapterContent` でも短編トップ URL から本文を抽出できること。                                 | `SYS-REQ-01, 02` |
| **`AC-NR-06`** | 前書き・本編・後書きの本文抽出結合          | 各話 HTML からサブタイトル（PC `.p-novel__title--rensai` / モバイル `.p-novel__subtitle-episode` 双方対応）を抽出し、前書き・本編・後書きが存在する場合は区切り段落 `<p><br></p><p>────────────</p><p><br></p>` を挟んで結合できること。                                | `SYS-REQ-02`     |
| **`AC-NR-07`** | ルビ保持と傍点 `<em class="bouten">` 正規化 | 通常ルビ `<ruby>` を保持しつつ、`<rt>` が傍点記号（`・` / `﹅` / `●`）のみの `<ruby>` を `<em class="bouten">` に正規化して抽出できること。                                                                                                                             | `SYS-REQ-07`     |
| **`AC-NR-08`** | XSS 防止サニタイズ                          | 本文中の `<script>`, `onerror`, `id="L1"` 等のタグ・属性が `HtmlSanitizer` により完全に無害化・除去されること。                                                                                                                                                         | `SYS-REQ-07`     |
| **`AC-NR-09`** | 前後話ナビゲーション URL 抽出               | `.c-pager__item--before` / `.c-pager__item--next` から `prevChapterUrl` / `nextChapterUrl` が絶対 URL または `null` として正しく抽出されること。                                                                                                                        | `SYS-REQ-02, 11` |
| **`AC-NR-10`** | 決定論的単体テスト                          | 外部ネットワーク通信を一切行わず、ローカル HTML フィクスチャ（`src/parsers/narou/__fixtures__/*.html`）により Vitest で C0/C1/Functions 100% 検証できること。                                                                                                           | `SYS-REQ-01`     |
