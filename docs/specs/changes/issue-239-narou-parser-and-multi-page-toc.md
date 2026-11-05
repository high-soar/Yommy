---
type: spec-delta
title: "小説家になろう（narou）パーサー（作品情報・複数ページ目次・本文）および複数ページ目次取得・クラウド同期対応仕様"
description: "Issue #239 に対する差分仕様、実サイトDOM構造に基づくNarouParser設計、複数ページ目次連続取得パイプライン、SyncEngineマルチサイト対応、テスト計画、およびSub-issue分割計画。"
issue: "#239"
status: "Review (#239)"
updated: "2026-11-06"
tags:
  - delta
  - parser
  - narou
  - syosetu
  - multi-page-toc
  - cloud-sync
  - ruby
  - bouten
  - ho-29
related_specs:
  - docs/specs/parsers/narou.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/quality/bug-and-handover-log.md
related_tests:
  - src/parsers/parserRegistry.test.ts
  - src/parsers/sanitizer.test.ts
  - src/features/bookshelf/hooks/useBookshelf.test.ts
  - src/features/novel-detail/hooks/useNovelDetail.test.ts
  - src/features/search/hooks/useNovelSearch.test.ts
  - src/features/ranking/hooks/useNovelRanking.test.ts
  - src/features/cloud-sync/services/syncEngine.test.ts
  - src/app/ServiceProvider.test.tsx
---

# 差分仕様書：小説家になろう（narou）パーサーおよび複数ページ目次取得・クラウド同期対応（Issue #239）

本ドキュメントは、Issue #239「`[v0.7] 小説家になろう（narou）パーサー（作品情報・複数ページ目次・本文）および複数ページ目次取得・クラウド同期対応`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **第 2 の対応小説サイトとしての「小説家になろう（`ncode.syosetu.com`）」対応（`HO-29`）**:
  `docs/specs/requirements.md` §2 のロードマップに基づき、カクヨム（`kakuyomu.jp`）に続く第 2 の対応小説サイトとして「小説家になろう（一般作品：`ncode.syosetu.com`）」に対応する。
- **なろう固有のサイト構造・仕様への対応**:
  1. **100 話超の複数ページ目次（`?p=2`, `?p=3`...）**: カクヨムは `__NEXT_DATA__` 内に全話目次が含まれるため 1 回の HTTP 通信で全目次を取得できたが、小説家になろうの連載作品は 1 ページあたり 100 話ずつ分割表示される。そのため、`nextTocPageUrl` を辿って全ページの目次を連続取得・結合する共通パイプラインが必要となる。また実サイト調査により、`?p=2` 以降の先頭エピソードには前ページから継続中の章見出し（`.p-eplist__chapter-title`）が再出力されないことが判明したため、ページ跨ぎ時の `partTitle` 引き継ぎが必要である。
  2. **短編作品（1 話完結）の DOM 構造**: なろうの短編作品は作品トップ（`https://ncode.syosetu.com/{ncode}/`）に `.p-eplist` が存在せず、トップページに直接本文（`.p-novel__body`）が配置される。
  3. **前書き・後書き・傍点表現**: 各話本文には前書き（`.p-novel__text--preface`）・本編（`.p-novel__text`）・後書き（`.p-novel__text--afterword`）が存在し、傍点は `<ruby>文字<rp>(</rp><rt>・・</rt><rp>)</rp></ruby>` 形式で出力される。
  4. **クラウド同期（`SyncEngine`）の URL ホワイトリスト**: 現在 `SyncEngine` の `parseNovelUrl` は `kakuyomu.jp` のみを許可しているため、`ncode.syosetu.com`（`siteType: "narou"`）も許可するよう拡張する必要がある。

---

## 2. 仕様・設計の差分（What Changes）

Step 1 の実サイト HTML 構造調査および `/grill-me` インタビューで合意した仕様は以下の通りです。

### 2.1 `NarouParser`（`src/parsers/narou/NarouParser.ts`）の新設と `ParserRegistry` 登録

正本仕様書 [docs/specs/parsers/narou.md](../parsers/narou.md) を新設し、以下の契約で `NarouParser` を実装して `createDefaultParserRegistry()` にデフォルト登録します：

1. **URL 判定・正規化（`canParse` / `normalizeWorkUrl`）**:
   - `https://ncode.syosetu.com/{ncode}/`（および各話 URL `/n9669bk/1/`、目次ページネーション `?p=2`、大文字 ncode `/N9669BK/`）を対象と判定し、小文字 ncode ＋末尾スラッシュ付きの `https://ncode.syosetu.com/{ncode}/` に正規化する。
   - 18 禁サイト（`novel18.syosetu.com`）や非作品パス（`/novelview/` 等）は `false` とする。
2. **作品トップ・目次抽出（`parseNovelIndex`）**:
   - 連載作品（`.p-eplist` / `.index_box` あり）: タイトル（`.p-novel__title`）、著者名（`.p-novel__author`、「作者：」接頭辞除去）、あらすじ（`#novel_ex` / `.p-novel__summary`）、章見出し（`.p-eplist__chapter-title`）、各話サブタイトル・URL・初回公開日時（`.p-eplist__update` の先頭 `YYYY/MM/DD HH:mm`）、および次ページ URL（`.c-pager__item--next[href]`）を抽出する。
   - 短編作品（`.p-eplist` がなく `.p-novel__body` あり）: `chapterIndex: 1`, `remoteChapterId: "1"`, `partTitle: null`, `title: 作品タイトル`, `url: canonicalUrl`, `publishedAt: .p-novel__date-published の掲載日（YYYY/MM/DD）` の擬似 1 話目次を生成する。あらすじが `#novel_ex` にない場合は `meta[name="description"]`（末尾の `// 無料オンライン小説です` を除去）から補完する。
3. **各話本文抽出（`parseChapterContent`）**:
   - サブタイトルはモバイル・PC 双方の現行 DOM（`.p-novel__subtitle-episode`, `.p-novel__title--rensai`）および短編タイトル（`.p-novel__title`）、レガシー（`.novel_subtitle`）の優先順で抽出する。
   - 前書き（`.p-novel__text.p-novel__text--preface`）、本編（`.p-novel__text:not(.p-novel__text--preface):not(.p-novel__text--afterword)`）、後書き（`.p-novel__text.p-novel__text--afterword`）を抽出し、前書き・後書きが存在する場合は既存の `HtmlSanitizer` 許可タグ内の区切り段落 `<p><br></p><p>────────────</p><p><br></p>` を挟んで本編と結合する。
   - `<rt>` 内が傍点記号（`/^[・﹅●]+$/`）のみの `<ruby>` 要素を `<em class="bouten">{基底テキスト}</em>` に正規化した上で、`sanitizeChapterHtml` によりサニタイズする。
   - `.c-pager__item--before[href]` / `.c-pager__item--next[href]` から `prevChapterUrl` / `nextChapterUrl` を絶対 URL として抽出する。

### 2.2 複数ページ目次連続取得パイプライン（`src/parsers/fetchFullNovelIndex.ts`）

```ts
export const DEFAULT_TOC_PAGE_INTERVAL_MS = 500;
export const MAX_TOC_PAGES = 100;

export interface FetchFullNovelIndexOptions {
  /** 2ページ目以降の取得間隔ウェイト（ミリ秒、既定値: 500ms） */
  intervalMs?: number;
  /** 最大取得ページ数上限（既定値: 100ページ = 最大10,000話） */
  maxPages?: number;
  /** 中断シグナル */
  signal?: AbortSignal;
}

export async function fetchFullNovelIndex(
  httpClient: HttpClientBridge,
  parser: NovelParser,
  workUrl: string,
  options?: FetchFullNovelIndexOptions,
): Promise<ParsedNovelIndex>;
```

- `parser.normalizeWorkUrl(workUrl)` で正規化した URL から 1 ページ目を取得・パースする。
- `nextTocPageUrl` が存在する間、`intervalMs`（デフォルト `500ms`）のウェイトを挟みながら最大 `maxPages`（デフォルト `100` ページ）まで順次取得する（`visitedUrls` セットにより同一 URL の無限ループも防止）。
- ページ結合時、次ページ先頭の `partTitle === null` のエピソードには前ページ末尾の `partTitle` を引き継ぎ、全エピソードの `chapterIndex` を `1..N` の連番に振り直す。
- 途中ページで通信エラー等が発生した場合は例外を送出して中断し、不完全な目次による DB 上書きを防止する。
- 以下の **全 5 箇所の目次取得ポイント** を `fetchFullNovelIndex` 経由に統一する：
  1. `useBookshelf`（`runSequentialUpdateCheck` 自動/手動更新チェック、および `addNovel`）
  2. `useNovelDetail`（`refreshToc` 手動目次更新）
  3. `useNovelSearch`（`addNovelToBookshelf` 検索結果からの本棚追加）
  4. `useNovelRanking`（`addNovelToBookshelf` ランキングからの本棚追加）
  5. `SyncEngine`（`mergeNewNovel` クラウド同期時の未登録作品自動目次補完）

### 2.3 クラウド同期（`SyncEngine`）のマルチサイト URL ホワイトリスト対応

- `src/features/cloud-sync/services/syncEngine.ts` の `ParsedNovelUrl` および `parseNovelUrl(url: string)` を拡張する：
  - `siteType`: `"kakuyomu" | "narou"`
  - カクヨム: `https://kakuyomu.jp/works/{workId}`（`www.kakuyomu.jp` 含む）→ `{ siteType: "kakuyomu", workId, canonicalUrl: "https://kakuyomu.jp/works/{workId}" }`
  - 小説家になろう: `https://ncode.syosetu.com/{ncode}/`（末尾スラッシュ有無・大文字小文字許容、パス `/^\/(n\d+[a-z0-9]*)\/?$/i`）→ `{ siteType: "narou", workId: lowerNcode, canonicalUrl: "https://ncode.syosetu.com/{lowerNcode}/" }`
  - それ以外のプロトコル（`http:` 等）や未知ドメイン（`novel18.syosetu.com` 含む）は `null` を返して SSRF を遮断する。

### 2.4 影響を受ける App 全体正本ファイル一覧

| 正本ファイルパス                       | 変更内容概要                                                                                                                              |
| :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/parsers/narou.md`          | **新規作成**。小説家になろう（`ncode.syosetu.com`）の URL 体系、連載/短編目次抽出、複数ページ目次パイプライン、本文・傍点抽出仕様を定義。 |
| `docs/specs/architecture.md`           | `NarouParser`、`fetchFullNovelIndex`、および `SyncEngine` のマルチサイト `parseNovelUrl` 仕様を反映。                                     |
| `docs/specs/requirements.md`           | §2 対応サイト方針および §3.1（`SYS-REQ-01`〜`04`, `06`）になろう対応・複数ページ目次取得・クラウド同期対応を反映。                        |
| `docs/specs/features/bookshelf.md`     | `useBookshelf` の更新チェック・作品追加における `fetchFullNovelIndex` 複数ページ目次取得連携を明記。                                      |
| `docs/specs/features/novel-detail.md`  | `useNovelDetail.refreshToc` における `fetchFullNovelIndex` 複数ページ目次取得連携を明記。                                                 |
| `docs/specs/features/search.md`        | `useNovelSearch.addNovelToBookshelf` における `fetchFullNovelIndex` 複数ページ目次取得連携を明記。                                        |
| `docs/specs/features/ranking.md`       | `useNovelRanking.addNovelToBookshelf` における `fetchFullNovelIndex` 複数ページ目次取得連携を明記。                                       |
| `docs/quality/bug-and-handover-log.md` | `related_specs` に本差分仕様および `docs/specs/parsers/narou.md` を追加。                                                                 |
| `docs/index.md`                        | ディレクトリマップに `docs/specs/parsers/narou.md` および本差分仕様を追加。                                                               |

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Vitest TDD / C0・C1・Functions 100%）

1. **`src/parsers/narou/NarouParser.test.ts`（新規・ローカル HTML フィクスチャ検証）**:
   - `src/parsers/narou/__fixtures__/` に実サイト DOM 構造に準拠したローカル HTML フィクスチャ（連載目次 1 ページ目 `work_index_page1.html`、連載目次 2 ページ目 `work_index_page2.html`、短編作品 `short_story.html`、各話本文［前書き・本編・後書き・ルビ・傍点含む］`episode_content.html`）を作成。
   - `canParse` / `normalizeWorkUrl`: 正常系（作品トップ、各話 URL、クエリ付き、大文字 `N9669BK`）、異常系（`novel18.syosetu.com`, `kakuyomu.jp`, `/novelview/`, 非 URL 文字列）の 100% 分岐検証。
   - `parseNovelIndex`: 連載作品のメタデータ・章見出し `partTitle`・各話サブタイトル・初回公開日時 `publishedAt`・`nextTocPageUrl` 抽出、最終ページの `nextTocPageUrl: null`、短編作品の擬似 1 話生成と `meta[name="description"]` あらすじ補完、レガシー DOM フォールバックの検証。
   - `parseChapterContent`: モバイル `.p-novel__subtitle-episode` / PC `.p-novel__title--rensai` / 短編 `.p-novel__title` のサブタイトル抽出、前書き・本編・後書きの区切り段落結合、`<rt>` 傍点記号の `<em class="bouten">` 正規化と通常 `<ruby>` 保持、XSS サニタイズ、前後話 URL（`prevChapterUrl` / `nextChapterUrl`）の検証。
2. **`src/parsers/fetchFullNovelIndex.test.ts`（新規）**:
   - 単一ページ作品（`nextTocPageUrl === null`）での 1 回取得完了。
   - 複数ページ作品（`?p=1` → `?p=2` → `?p=3`）での `500ms` ウェイト順次取得、ページ跨ぎ時の `partTitle` 引き継ぎ、および `chapterIndex`（`1..N`）連番再採番。
   - `maxPages` 上限到達時および循環 URL 検出時の安全な停止ガード。
   - `AbortSignal` による中断および途中ページ通信失敗時の例外送出（部分データ破棄）。
3. **既存 Hook / Service 単体テストの拡充**:
   - `useBookshelf.test.ts`, `useNovelDetail.test.ts`, `useNovelSearch.test.ts`, `useNovelRanking.test.ts`: 複数ページ目次を持つ作品の追加・更新チェック・目次再取得時に全ページが結合されて `upsertNovelWithToc` に渡されることを検証。
   - `syncEngine.test.ts`: `parseNovelUrl` が `https://ncode.syosetu.com/n9669bk/` を許可し、リモートにのみ存在するなろう作品（複数ページ目次含む）の自動目次補完・しおり・既読マージが正常に行われることを検証。

### 3.2 Storybook ＆ VRT（1280px / 375px）

- 本 Issue では UI コンポーネントのレイアウト変更はないが、既存の全 VRT スナップショット（1280px / 375px）が 100% PASS することを確認する。

### 3.3 結合テスト（Playwright IT / 全件 100% PASS）

- `test/it/scenarios/scn05-cloud-sync.spec.ts`（および関連シナリオ）:
  - Google Drive クラウド同期において、小説家になろう作品（`narou:n9669bk`、複数ページ目次を含む）がリモート同期データから自動目次補完（全ページ結合）・本棚反映・作品詳細目次表示・リーダー縦書き/ルビ/傍点表示まで一気通貫で動作することを実ブラウザで検証する。

---

## 4. 実装 Sub-issue 分割計画

| Sub-issue  | Issue 番号 | 種別     | 作業範囲                                                                                                                                                                               | 完了ゲート / マージ権限                      |
| :--------- | :--------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| **MK1**    | **#249**   | 実装     | `NarouParser`（作品情報・連載/短編目次・前書き/本編/後書き本文・傍点正規化・ローカル HTML フィクスチャ単体テスト）の実装とデフォルト `ParserRegistry` 登録                             | Task Completion Gate 1〜6 → 🤖 AI 自律マージ |
| **MK2/IT** | **#250**   | 実装＋IT | `fetchFullNovelIndex` 複数ページ目次連続取得パイプライン実装・各 Hook/`SyncEngine` 統合・`SyncEngine` の `narou` ホワイトリスト対応・Playwright 結合テスト更新・差分仕様アーカイブ移動 | Task Completion Gate 1〜6 → 👤 人間マージ    |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）・実機検証計画

- **Android 実機検証の実施タイミング判断**: **`B. Milestone 最終レビュー後に一括で実機検証を実施（完了ゲート: Milestone v0.7 完了前）`**
  - **判断理由**:
    - 本 Issue は純粋な Parser ロジック、共通目次取得パイプライン、および `SyncEngine` の URL バリデーション拡張であり、Android ネイティブ層（Java / Capacitor Plugin）やタッチ・ハードウェアキー等の物理操作変更を含まない。
    - また、アプリ UI 上から新規作品を探索・追加する導線（検索・ランキング画面のサイト切替 `SiteSelector`）は後続の親 Issue #240 で実装されるため、#240 完了後の Milestone `v0.7` 実機検証フェーズにおいて「なろう作品の検索・ランキング探索 → 100 話超の複数ページ目次取得 → 縦書きリーダー（前書き・後書き・ルビ・傍点）閲覧 → Google Drive クラウド同期」を一筆書きで実機検証するのが最も網羅的かつ効率的である。

| 申し送り ID | 起票元 Issue | 申し送り事項の内容                                                                                                       | 解決先（対象 Issue / 成果物）          | 完了ゲート              |  状態  |
| :---------: | :----------: | :----------------------------------------------------------------------------------------------------------------------- | :------------------------------------- | :---------------------- | :----: |
| **`HO-29`** |  #239, #240  | 小説家になろう（`narou`: `ncode.syosetu.com`）作品の複数ページ目次取得・クラウド同期および検索・ランキング探索の実機検証 | Milestone `v0.7` 実機検証 / Issue #241 | Milestone `v0.7` 完了前 | `Open` |
