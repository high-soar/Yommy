---
type: spec-delta
title: "小説家になろう（narou）の検索・ランキング対応と探索画面サイト切替（SiteSelector）仕様"
description: "Issue #240 に対する差分仕様、なろう小説APIによる検索・ランキング抽出設計、検索/ランキング画面のSiteSelector有効化とサイト別ジャンル連動、テスト計画、およびSub-issue分割計画。"
issue: "#240"
status: "Completed (Archived)"
updated: "2026-11-06"
tags:
  - delta
  - parser
  - narou
  - syosetu
  - search
  - ranking
  - site-selector
  - scr-06
  - scr-07
  - ho-29
  - ho-31
related_specs:
  - docs/specs/parsers/narou.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/quality/bug-and-handover-log.md
related_tests:
  - src/parsers/narou/NarouParser.test.ts
  - src/features/search/components/SiteSelector.test.tsx
  - src/features/search/components/SearchFilterBar.test.tsx
  - src/features/search/components/SearchPage.test.tsx
  - src/features/search/components/SearchContainer.test.tsx
  - src/features/search/hooks/useNovelSearch.test.ts
  - src/features/ranking/components/SiteSelector.test.tsx
  - src/features/ranking/components/RankingFilterBar.test.tsx
  - src/features/ranking/components/RankingPage.test.tsx
  - src/features/ranking/components/RankingContainer.test.tsx
  - src/features/ranking/hooks/useNovelRanking.test.ts
  - src/app/ServiceProvider.test.tsx
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
---

# 差分仕様書：小説家になろう（narou）の検索・ランキング対応と探索画面サイト切替（Issue #240）

本ドキュメントは、Issue #240「`[v0.7] 小説家になろう（narou）の検索・ランキング対応と探索画面サイト切替（SiteSelector）の実装`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **アプリ内からの「小説家になろう」作品探索・本棚ワンタップ登録の完成（`HO-29`）**:
  Issue #239 で実装した `NarouParser`（作品情報・100 話超の複数ページ目次・短編擬似 1 話・各話本文・傍点正規化）および `fetchFullNovelIndex` に続き、検索画面（`SCR-06`）およびランキング画面（`SCR-07`）から「小説家になろう」の作品を直接探索し、ワンタップで本棚へ登録・閲覧できるようにする。
- **探索画面におけるマルチサイト切替 UX の確立**:
  従来 `isAvailable: false`（準備中）として非活性化していた `SiteSelector` の「小説家になろう (`narou`)」を有効化し、カクヨムとなろうで異なるジャンル体系（カクヨム 12 ジャンル vs なろう公式小ジャンル 21 種）の切り替え、サイト切替時のジャンル自動リセット・自動再取得、およびサイト別の登録済み作品照合（`registeredWorkIds`）をシームレスに連動させる。

---

## 2. 仕様・設計の差分（What Changes）

Step 1 の `/grill-me` インタビューおよび公式なろう小説 API 仕様調査で合意した設計差分は以下の通りです。

### 2.1 `NarouParser` への検索・ランキング機能実装（公式「なろう小説 API」JSON 方式）

[docs/specs/parsers/narou.md](../../parsers/narou.md) に検索・ランキング仕様（§5, §6）および受入条件（`AC-NR-11`〜`AC-NR-14`）を追加し、`NarouParser` に以下の 4 メソッドを実装します。

1. **データ取得エンドポイント**:
   - 検索・ランキングとも、なろうデベロッパー公式の **なろう小説 API（`https://api.syosetu.com/novelapi/api/`）** に統一する（`out=json`、非圧縮 UTF-8、1 ページあたり `lim=20` 件）。
   - `CapacitorHttpClient.getHtml()` は JSON レスポンス（文字列または自動パースオブジェクト）を文字列へシリアライズして `response.html` として返却するため、既存の `HttpClientBridge` および `NovelParser` インターフェース契約を変更せずそのまま利用する。
2. **検索 URL 生成（`buildSearchUrl(query: string, options?: NovelSearchOptions): string`）**:
   - ベース URL: `https://api.syosetu.com/novelapi/api/`
   - クエリパラメータ:
     - `out=json`（固定）
     - `lim=20`（1 ページ 20 件固定）
     - `word`: `query.trim()` が非空の場合のみ付与（URL エンコード）
     - `order`: `options?.order` に応じて以下の値を設定（未指定時は `"weekly_ranking"` 相当の `"weeklypoint"`）：
       - `"weekly_ranking"`（週間ランキング順）→ `"weeklypoint"`
       - `"popular"`（累計ランキング順）→ `"hyoka"`
       - `"last_episode_published_at"`（更新順）→ `"new"`
       - `"published_at"`（新作順）→ `"generalfirstup"`
     - `type`: `options?.serialStatus` に応じて以下の値を設定：
       - `"all"` または未指定 → 省略（連載中・完結済連載・短編のすべてを対象）
       - `"running"`（連載中）→ `"r"`（連載中のみ）
       - `"completed"`（完結済）→ `"ter"`（短編および完結済連載小説の双方を対象）
     - `genre`: `options?.genre` が非空文字列の場合のみ付与（なろう小ジャンルコード、例: `"201"`）
     - `st`: `options?.page` が 2 以上の整数の場合のみ、開始位置 `st = (page - 1) * 20 + 1` を付与（1 または未指定時は省略。なお API 仕様上の最大開始位置は `2000`）。
3. **検索結果パース（`searchNovels(html: string, pageUrl: string): ParsedSearchResult`）**:
   - `JSON.parse(html)` により JSON 配列を解析する（不正 JSON や配列でない場合は空結果 `{ items: [], pageInfo: { currentPage, hasNextPage: false, totalCount: 0 } }` を返す）。
   - 配列先頭要素 `data[0]` の `allcount`（数値）を `totalCount` として取得し、`data.slice(1)` の各作品オブジェクトを走査して `NovelSearchResultItem` にマッピングする（`ncode` が存在しない要素はスキップ）：
     - `remoteWorkId`: `String(entry.ncode).trim().toLowerCase()`（例: `"n9669bk"`）
     - `title`: `String(entry.title ?? "").trim()`
     - `author`: `String(entry.writer ?? "").trim()`
     - `synopsis`: `String(entry.story ?? "").trim()`
     - `genre`: `String(entry.genre ?? "")`（例: `"201"`）
     - `genreLabel`: なろう小ジャンル定義マップ（`NAROU_GENRE_LABELS`）から逆引きした日本語名（例: `"ハイファンタジー"`、未知コード時は `"その他"`）
     - `serialStatus` / `serialStatusLabel`:
       - `entry.end === 1`（連載中）のとき: `serialStatus: "running"`, `serialStatusLabel: "連載中"`
       - `entry.end === 0` かつ `entry.novel_type === 2`（短編）のとき: `serialStatus: "completed"`, `serialStatusLabel: "短編"`
       - それ以外（`entry.end === 0` の完結済連載等）のとき: `serialStatus: "completed"`, `serialStatusLabel: "完結済"`
     - `episodeCount`: `Number(entry.general_all_no) || 1`
     - `characterCount`: `Number(entry.length) || 0`
     - `tags`: `String(entry.keyword ?? "").trim()` を空白文字（`/\s+/`）で分割した非空文字列配列
     - `reviewPoints`: `Number(entry.global_point) || 0`（検索結果カードでは常に総合評価ポイントを表示）
     - `lastEpisodePublishedAt`: `typeof entry.general_lastup === "string" && entry.general_lastup.trim() ? entry.general_lastup.trim() : null`
     - `workUrl`: `https://ncode.syosetu.com/${remoteWorkId}/`
   - `pageInfo`:
     - `currentPage`: `pageUrl` の `st` クエリパラメータから `Math.floor((st - 1) / 20) + 1`（または `page` パラメータ、未指定時は `1`）を算出。
     - `hasNextPage`: `items.length > 0` かつ `st + items.length - 1 < allcount` かつ次ページの開始位置 `nextSt = st + 20 <= 2000`（なろう API の `st` 上限 2000）を満たす場合に `true`、それ以外は `false`。
4. **ランキング URL 生成（`buildRankingUrl(options?: NovelRankingOptions): string`）**:
   - ベース URL: `https://api.syosetu.com/novelapi/api/`
   - クエリパラメータ:
     - `out=json`（固定）
     - `lim=20`（固定）
     - `order`: `options?.period`（未指定時は `"weekly"`）に応じて以下を設定：
       - `"daily"`（日間）→ `"dailypoint"`
       - `"weekly"`（週間）→ `"weeklypoint"`
       - `"monthly"`（月間）→ `"monthlypoint"`
       - `"entire"`（累計）→ `"hyoka"`
     - `genre`: `options?.genre` が非空かつ `"all"` 以外の場合のみ付与（なろう小ジャンルコード、例: `"201"`。総合時は省略）
     - `st`: `options?.page` が 2 以上の整数の場合のみ `st = (page - 1) * 20 + 1` を付与
5. **ランキング結果パース（`getRanking(html: string, pageUrl: string): ParsedRankingResult`）**:
   - `searchNovels` と同じ JSON 配列解析基盤を用いつつ、以下のランキング固有処理を行う：
     - **順位（`rank`）**: 開始位置 `st`（1 ページ目は `1`）を基準に `st + index`（1 位、2 位、3 位...）を付与。
     - **期間別ポイント（`reviewPoints`）**: `pageUrl` の `order` クエリパラメータに応じて、対象期間のポイントを `reviewPoints` に設定する：
       - `order=dailypoint`: `Number(entry.daily_point ?? entry.global_point) || 0`
       - `order=weeklypoint`: `Number(entry.weekly_point ?? entry.global_point) || 0`
       - `order=monthlypoint`: `Number(entry.monthly_point ?? entry.global_point) || 0`
       - `order=hyoka`（またはその他）: `Number(entry.global_point) || 0`

### 2.2 なろう公式小ジャンル 21 種定義とサイト別ジャンルピル切り替え

なろう公式の小ジャンルコード（`genre` パラメータ値）と日本語ラベルの対応は以下の 21 種とします（探索しやすさを考慮し、利用頻度の高いファンタジー系・恋愛系を先頭に配置）：

| ジャンルコード (`id`) | 表示ラベル (`label`) | 大ジャンル分類 |
| :-------------------- | :------------------- | :------------- |
| `undefined`           | すべて / 総合        | 全ジャンル     |
| `"201"`               | ハイファンタジー     | ファンタジー   |
| `"202"`               | ローファンタジー     | ファンタジー   |
| `"101"`               | 異世界〔恋愛〕       | 恋愛           |
| `"102"`               | 現実世界〔恋愛〕     | 恋愛           |
| `"301"`               | 純文学               | 文芸           |
| `"302"`               | ヒューマンドラマ     | 文芸           |
| `"303"`               | 歴史                 | 文芸           |
| `"304"`               | 推理                 | 文芸           |
| `"305"`               | ホラー               | 文芸           |
| `"306"`               | アクション           | 文芸           |
| `"307"`               | コメディー           | 文芸           |
| `"401"`               | VRゲーム             | SF             |
| `"402"`               | 宇宙                 | SF             |
| `"403"`               | 空想科学             | SF             |
| `"404"`               | パニック             | SF             |
| `"9901"`              | 童話                 | その他         |
| `"9902"`              | 詩                   | その他         |
| `"9903"`              | エッセイ             | その他         |
| `"9904"`              | リプレイ             | その他         |
| `"9999"`              | その他               | その他         |
| `"9801"`              | ノンジャンル         | ノンジャンル   |

- `SearchFilterBarProps` および `RankingFilterBarProps` に `selectedSite?: NovelSiteType`（省略時 `"kakuyomu"`）を追加し、`selectedSite === "narou"` のときはなろう用ジャンル配列（`NAROU_SEARCH_GENRES` / `NAROU_RANKING_GENRES`）、`"kakuyomu"` のときはカクヨム用ジャンル配列（`SEARCH_GENRES` / `RANKING_GENRES`）を横スクロールピルに描画する。

### 2.3 検索画面（`SCR-06`）・ランキング画面（`SCR-07`）での `SiteSelector` 有効化と状態連動

1. **`SiteSelector` の `narou` 有効化**:
   - `SEARCH_SITES`（`src/features/search/types.ts`）および `RANKING_SITES`（`src/features/ranking/types.ts`）の `{ siteType: "narou", label: "小説家になろう", isAvailable: true }` を有効化し、ボタンから `(準備中)` 表記を除去してタップ可能にする。
2. **検索画面（`useNovelSearch`）のサイト切替挙動**:
   - `setSelectedSite(newSite)` 呼び出し時、通信中（`isSearchingRef.current === true`）または同一サイト（`newSite === selectedSite`）の場合は何もしない。
   - 別サイトへ切り替わった場合：
     - `selectedSite` を `newSite` に更新し、サイト固有の `genre` を `undefined`（「すべて」）にリセットする（サイト共通の `keyword`, `order`, `serialStatus` は保持）。
     - `error` を `null` にクリアする。
     - **検索実行済み（`hasSearchedRef.current === true`）の場合**: 直ちに新サイト（`site: newSite, genre: undefined`）で 1 ページ目からの自動再検索 `executeSearch({ site: newSite, genre: undefined })` を発火する（通信中は旧検索結果一覧をクリアし `search-loading` を表示）。
     - **未検索（`hasSearchedRef.current === false`）の場合**: 初期案内表示を維持したまま、新サイトの `registeredWorkIds` を再照合する。
3. **ランキング画面（`useNovelRanking`）のサイト切替挙動**:
   - `setSelectedSite(newSite)` 呼び出し時、通信中（`isFetchingRef.current === true`）または同一サイト（`newSite === selectedSite`）の場合は何もしない。
   - 別サイトへ切り替わった場合：
     - `selectedSite` を `newSite` に更新し、サイト固有の `genre` を `undefined`（「総合」）にリセットする（サイト共通の `period` は保持）。
     - 直ちに `executeFetch({ site: newSite, genre: undefined })` を発火し、旧ランキング一覧をクリアして `ranking-loading` を表示し、新サイトのランキングを取得・描画する。
     - `executeFetch` 完了時の登録済み作品照合（`refreshRegisteredIds(targetSite)`）において、切替後の `targetSite` の登録済み作品を正確に反映する。

### 2.4 影響を受ける App 全体正本ファイル一覧

| 正本ファイルパス                       | 変更内容概要                                                                                                                                                     |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/parsers/narou.md`          | §5 検索結果抽出仕様（`buildSearchUrl` / `searchNovels`・小ジャンル21種定義）、§6 ランキング抽出仕様（`buildRankingUrl` / `getRanking`）、`AC-NR-11`〜`14` 追加。 |
| `docs/specs/features/search.md`        | `SiteSelector` のなろう有効化、`SearchFilterBarProps.selectedSite` によるサイト別ジャンルピル切替、`useNovelSearch` サイト切替連動、`AC-SE-10` 追加。            |
| `docs/specs/features/ranking.md`       | `SiteSelector` のなろう有効化、`RankingFilterBarProps.selectedSite` によるサイト別ジャンルピル切替、`useNovelRanking` サイト切替連動、`AC-RK-09` 追加。          |
| `docs/specs/requirements.md`           | §2 対応サイト方針、§3.6 `SYS-REQ-17`〜`19`（カクヨム・小説家になろうマルチサイト検索・ランキング対応、受入条件トレーサビリティ）、§4 ロードマップ更新。          |
| `docs/specs/architecture.md`           | §1 Mermaid 図、§2.1 ディレクトリ説明、§3.3 `NovelParser` 検索・ランキング契約の HTML/JSON 記述更新。                                                             |
| `docs/specs/screen-transitions.md`     | §1 `SCR-06` / `SCR-07` のサイト選択ピル説明更新、§4 `SCN-02` の小説家になろうサイト切替・検索/ランキング探索回帰範囲の更新。                                     |
| `docs/quality/bug-and-handover-log.md` | `related_specs` に本差分仕様を追加し、対象外スコープの高度検索フィルタを `HO-31`（`v0.8〜`）として申し送り台帳へ登録。                                           |
| `docs/index.md`                        | ディレクトリマップに `docs/specs/changes/issue-240-narou-search-ranking-and-site-selector.md` を追加。                                                           |

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Vitest TDD / C0・C1・Functions 100%）

1. **`src/parsers/narou/NarouParser.test.ts`（ローカル JSON フィクスチャ検証）**:
   - `src/parsers/narou/__fixtures__/` にローカル JSON フィクスチャ（`search_results.json`, `search_results_empty.json`, `ranking_results.json`）を追加。
   - `buildSearchUrl`: キーワード（空白トリム・空文字省略）、4 種の並び順（`weeklypoint`, `hyoka`, `new`, `generalfirstup`）、3 種の連載状態（省略, `r`, `ter`）、小ジャンル指定、ページ番号（`page=1` 時は `st` 省略、`page=2` 時は `st=21`）の URL 生成検証。
   - `searchNovels`: `allcount` と作品リストの抽出、大文字 `ncode` の小文字正規化、小ジャンルラベル逆引き（既知コード・未知コードフォールバック）、連載中（`end=1`）・完結済連載（`end=0, novel_type=1`）・短編（`end=0, novel_type=2` → `"短編"`）の判定、スペース区切り `keyword` のタグ配列化、`global_point` 抽出、次ページ判定（`hasNextPage`、`st` 上限 2000 境界含む）、0 件・不正 JSON 時の安全な空結果返却の検証。
   - `buildRankingUrl` / `getRanking`: 4 種の集計期間（`dailypoint`, `weeklypoint`, `monthlypoint`, `hyoka`）、総合/個別ジャンル指定、1 位からの連番 `rank` 付与、選択期間に応じた期間ポイント（`daily_point`, `weekly_point`, `monthly_point`, `global_point`）の `reviewPoints` 反映検証。
2. **検索・ランキング UI / Hook 単体テスト（1対1 Story/UT・親子分離）**:
   - `SiteSelector.test.tsx`（search / ranking 双方）: 「カクヨム」「小説家になろう」の双方が有効（`disabled=false`）で描画され、クリック時に `onSelectSite("narou")` / `onSelectSite("kakuyomu")` が呼ばれること、および `disabled=true`（通信中）時は全ピルが無効化されることを検証。
   - `SearchFilterBar.test.tsx` / `RankingFilterBar.test.tsx`: `selectedSite="kakuyomu"` 時はカクヨム 12 ジャンル、`selectedSite="narou"` 時はなろう小ジャンル（`201: ハイファンタジー` 等）が描画・選択できることを検証。
   - `SearchPage.test.tsx` / `RankingPage.test.tsx`: 親子分離（`vi.spyOn`）に基づき `selectedSite` が `SiteSelector` および `SearchFilterBar` / `RankingFilterBar` へ正しく伝播されることを検証。
   - `useNovelSearch.test.ts`: サイト切替時の `genre` 自動リセット（`undefined`）、未検索時（`hasSearched=false`）は通信せず `registeredWorkIds` のみ更新されること、検索済み時（`hasSearched=true`）は新サイトで即時自動再検索が走ること、同一サイト再選択や通信中のサイト切替が無視されることを検証。
   - `useNovelRanking.test.ts`: サイト切替時に `genre` が `undefined` にリセットされ、`period` を維持したまま新サイト（`NarouParser`）で即時自動再取得が走り、なろうの登録済み作品 ID セット（`registeredWorkIds`）が正しく反映されることを検証。

### 3.2 Storybook ＆ VRT（1280px / 375px）

- `SiteSelector.stories.tsx`, `SearchFilterBar.stories.tsx`, `SearchPage.stories.tsx`, `RankingFilterBar.stories.tsx`, `RankingPage.stories.tsx` になろう選択状態（小ジャンルピル表示）のストーリーを追加・更新し、`npm run test:vrt:update` および `npm run test:vrt` で 1280px / 375px の全スナップショット PASS を検証する。

### 3.3 結合テスト（Playwright IT / 全件 100% PASS）

- `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`:
  - 検索画面（`SCR-06`）およびランキング画面（`SCR-07`）において、`SiteSelector` で「小説家になろう」へ切り替え、ジャンルピルがなろう小ジャンル（ハイファンタジー等）へ切り替わることを確認。
  - なろう作品のキーワード検索およびランキング表示から、「＋ 本棚に追加」その場登録およびカードタップによる作品詳細・目次画面（`SCR-02`）→ 小説リーダー画面（`SCR-03`：前書き・本編・後書き・ルビ・傍点を含む縦書き表示）→ OS バックキーによる探索元画面への論理階層復帰まで一気通貫で動作することを検証する。

---

## 4. 実装 Sub-issue 分割計画

| Sub-issue  | Issue 番号 | 種別     | 作業範囲                                                                                                                                                                                                            | 完了ゲート / マージ権限                      |
| :--------- | :--------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------- |
| **MK1**    | **#254**   | 実装     | `NarouParser` への検索・ランキング 4 メソッド（`buildSearchUrl`, `searchNovels`, `buildRankingUrl`, `getRanking`）およびなろう小ジャンル定義の実装とローカル JSON フィクスチャ単体テスト（C0/C1 100%）              | Task Completion Gate 1〜6 → 🤖 AI 自律マージ |
| **MK2/IT** | **#255**   | 実装＋IT | 検索・ランキング画面（`SCR-06` / `SCR-07`）の `SiteSelector` 有効化・サイト別ジャンル連動・サイト切替自動再取得・1対1 Story/UT・VRT 更新・Playwright 結合テスト（`SCN-02`）拡充・差分仕様の `changes/archive/` 移動 | Task Completion Gate 1〜6 → 👤 人間マージ    |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）・実機検証計画

- **Android 実機検証の実施タイミング判断**: **`B. Milestone 最終レビュー後に一括で実機検証を実施（完了ゲート: Milestone v0.7 完了前）`**
  - **判断理由**:
    - 本 Issue は `NarouParser` の JSON パース拡張および既存の検索・ランキング画面におけるサイト切替・ジャンル配列切替であり、Android ネイティブプラグインの新設・変更や複雑な物理ジェスチャー追加を伴わない。
    - 先行する Issue #238（ローディング UX `HO-30`）および Issue #239（なろう作品目次・本文・複数ページ目次・クラウド同期 `HO-29`）と合わせ、Milestone `v0.7` 完了承認 Issue #241（Step 2）にて「なろう検索・ランキング探索 → 複数ページ目次取得 → 縦書きリーダー閲覧 → クラウド同期」を一筆書きで実機検証する計画（`HO-29`）に統合済みである。

| 申し送り ID | 起票元 Issue | 申し送り事項の内容                                                                                                       | 解決先（対象 Issue / 成果物）          | 完了ゲート              |  状態  |
| :---------: | :----------: | :----------------------------------------------------------------------------------------------------------------------- | :------------------------------------- | :---------------------- | :----: |
| **`HO-29`** |  #239, #240  | 小説家になろう（`narou`: `ncode.syosetu.com`）作品の複数ページ目次取得・クラウド同期および検索・ランキング探索の実機検証 | Milestone `v0.7` 実機検証 / Issue #241 | Milestone `v0.7` 完了前 | `Open` |
| **`HO-31`** |     #240     | 除外キーワード指定や複数ジャンル AND/OR モーダル等の高度な検索フィルタ機能の検討・実装（Issue #240 §3 対象外スコープ）   | 将来 Milestone（`v0.8〜`）             | Milestone `v0.8` 以降   | `Open` |
