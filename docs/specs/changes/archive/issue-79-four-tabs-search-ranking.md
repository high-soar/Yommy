---
type: spec-delta
title: "下部4タブ化とカクヨム検索・ランキング画面新設（URL登録廃止・検索/ランキングからの登録への一本化）の設計"
description: "Issue #79 に対する差分仕様、影響する全体正本、テスト計画、および実装Sub-issue分割計画。"
issue: "#79"
status: "Completed (Archived)"
updated: "2026-10-30"
tags:
  - delta
  - four-tabs
  - bottom-nav
  - search
  - ranking
  - kakuyomu
  - scr-06
  - scr-07
  - routing
  - back-button
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/archive/issue-78-apk-signing-and-back-button.md
related_tests:
  - src/parsers/kakuyomu/KakuyomuParser.test.ts
  - src/shared/ui/BottomTabBar.test.tsx
  - src/features/reader/components/ReaderBottomOverlay.test.tsx
  - src/app/router.test.tsx
  - src/features/bookshelf/components/BookshelfPage.test.tsx
  - src/features/bookshelf/components/BookshelfContainer.test.tsx
  - src/features/bookshelf/components/BookshelfEmptyState.test.tsx
  - src/App.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
  - test/it/smoke.spec.ts
---

# 差分仕様書：下部4タブ化とカクヨム検索・ランキング画面新設（Issue #79）

本ドキュメントは、Issue #79「`[v0.3] 下部4タブ化とカクヨム検索・ランキング画面新設（URL登録廃止・検索/ランキングからの登録への一本化）`」に対する差分仕様、カクヨム実機 HTML / Next.js 解析結果、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **現状の課題（v0.2 までの運用課題）**:
  - これまでは本棚画面（`SCR-01`）の「URLから作品を追加」ダイアログ（`AddNovelDialog`）による直接 URL 入力のみであったため、ユーザーは外部ブラウザでカクヨムを開いて URL をコピーし、アプリに戻ってペーストする必要があり、モバイル体験として著しく煩雑であった。
  - 下部タブバー（`BottomTabBar`）が「本棚」「設定」の 2 タブしか存在せず、アプリ内で能動的に作品を探す導線が欠如していた。
  - 今後複数の小説サイト（カクヨム・小説家になろう等）に対応していくにあたり、サイトごとに異なる検索パラメータやランキング体系を柔軟に吸収できる UI 階層と作品登録導線が必要である。
- **改善目的**:
  - 下部ナビゲーションを **「本棚（`/`）」「検索（`/search`）」「ランキング（`/ranking`）」「設定（`/settings`）」の 4 タブ構成** へ拡張する。
  - 「検索・ランキング → 対象サイト選択」の UI 階層を新設し、v0.3 時点ではカクヨム（将来なろうを追加可能なセグメント/ピル切替構造）を提供する。
  - カクヨムの実際の HTML / Next.js Apollo State を解析し、精度の高い検索（キーワード・並び順・連載状態・ジャンルフィルタ・次ページ）およびランキング（期間 × 総合/主要ジャンル）のパーサーと画面を実装する。
  - **URL 入力による登録を廃止** し、検索結果・ランキング一覧の各カードからワンタップで本棚へ即時追加（`upsertNovelWithToc`）できるように一本化する。カードタップで作品詳細・目次（`SCR-02`）へ遷移できる統一導線を確立する。

---

## 2. カクヨム実機 HTML / Next.js 構造解析結果（Actual HTML Analysis）

カクヨム公式サイト（`kakuyomu.jp`）の実際の検索・ランキング HTML を取得・解析した結果に基づき、以下の仕様を確定しました。

### 2.1 Next.js Apollo State 構造

カクヨムのページには `<script id="__NEXT_DATA__" type="application/json">` が埋め込まれており、`props.pageProps.__APOLLO_STATE__` 内に GraphQL の Apollo キャッシュが完全な構造化データとして保持されています。

1. **検索（Search）**:
   - `ROOT_QUERY` 内に `searchWorks({"exclusionConditions":[],"first":20,"genres":[...],"inclusionConditions":[],"offset":0,"order":"...","query":"..."})` が存在。
   - `SearchWorkConnection` 型:
     - `nodes`: `[{ __ref: "Work:<workId>" }]`（作品参照リスト、1ページ20件）
     - `pageInfo`: `{ hasNextPage: boolean, hasPreviousPage: boolean }`
     - `totalCount`: ヒット全件数（`number`）
2. **ランキング（Ranking）**:
   - `ROOT_QUERY` 内に `rankedWorks({"first":100,"genre":...,"period":"...","workVariation":"LONG"})` が存在。
   - `WorkConnection` 型:
     - `nodes`: `[{ __ref: "Work:<workId>" }]`（ランキング順にソートされた100件の作品参照リスト。配列インデックス + 1 が順位）
3. **作品エンティティ（`Work:<id>`）**:
   - `id`: カクヨム作品識別子（`string`）
   - `title`: 作品タイトル（`string`）
   - `author`: `{ __ref: "UserAccount:<userId>" }` → `UserAccount` から `activityName`（著者表示名）を取得
   - `introduction`: あらすじテキスト（`string`）
   - `genre`: ジャンルコード（例: `"FANTASY"`）
   - `serialStatus`: 連載状態コード（`"RUNNING"`: 連載中 / `"COMPLETED"`: 完結済）
   - `publicEpisodeCount`: 公開話数（`number`）
   - `totalCharacterCount`: 総文字数（`number`）
   - `tagLabels`: タグラベル配列（`string[]`）
   - `totalReviewPoint`: 獲得応援レビュー／★ポイント数（`number`）
   - `lastEpisodePublishedAt`: 最終エピソード公開日時（ISO 8601 文字列）

### 2.2 検索クエリパラメータ仕様

- **ベース URL**: `https://kakuyomu.jp/search`
- **パラメータ一覧**:
  - `q`: 検索キーワード（URIエンコード文字列）
  - `order`: 並び順（小文字・大文字対応）
    - `weekly_ranking` / `WEEKLY_RANKING`: 週間ランキング（デフォルト）
    - `popular` / `POPULAR`: 累計ランキング
    - `last_episode_published_at` / `LAST_EPISODE_PUBLISHED_AT`: 更新順
    - `published_at` / `PUBLISHED_AT`: 新作順
  - `serial_status`: 連載状態（小文字・大文字対応）
    - 未指定: すべて
    - `running` / `RUNNING`: 連載中
    - `completed` / `COMPLETED`: 完結済
  - `genre_name`: ジャンル名スラッグ（カンマ区切りで複数指定可、単一指定対応）
    - `fantasy`（異世界ファンタジー）, `action`（現代ファンタジー）, `sf`（SF）, `love_story`（恋愛）, `romance`（ラブコメ）, `drama`（現代ドラマ）, `horror`（ホラー）, `mystery`（ミステリー）, `nonfiction`（エッセイ・ノンフィクション）, `history`（歴史・時代・伝奇）, `criticism`（創作論・評論）, `others`（詩・童話・その他）
  - `page`: ページ番号（1始まり整数、デフォルト: 1）

### 2.3 ランキング URL / パラメータ仕様

- **ベース URL 形式**: `https://kakuyomu.jp/rankings/{target}/{period}?work_variation={workVariation}&page={page}`
- **パスパラメータ**:
  - `{target}`: 対象ジャンル
    - `all`: 総合（全ジャンル）
    - `fantasy`, `action`, `sf`, `love_story`, `romance`, `drama`, `horror`, `mystery`, `nonfiction`, `history`, `criticism`, `others`（個別ジャンル）
  - `{period}`: 集計期間
    - `daily`: 日間
    - `weekly`: 週間（デフォルト）
    - `monthly`: 月間
    - `entire`: 累計
- **クエリパラメータ**:
  - `work_variation`: 作品長編/短編区分（カクヨム公式の標準は `long`）
    - `long`: 長編（連載中または2万文字以上）
    - `short`: 短編
    - `all`: すべて
  - `page`: ページ番号（デフォルト: 1）

---

## 3. 仕様・設計の差分（What Changes）

### 3.1 下部タブバー（`BottomTabBar`）およびリーダー下部オーバーレイの 4 タブ化

- **タブ構成の拡張（2タブ → 4タブ）**:
  - `BottomTab` 型を `"bookshelf" | "search" | "ranking" | "settings"` に拡張。
  - 各タブの定義:
    1. **本棚（`bookshelf`）**: アイコン 📚, ラベル「本棚」, `data-testid="tab-bookshelf"`, 遷移先 `/`
    2. **検索（`search`）**: アイコン 🔍, ラベル「検索」, `data-testid="tab-search"`, 遷移先 `/search`
    3. **ランキング（`ranking`）**: アイコン 🏆, ラベル「ランキング」, `data-testid="tab-ranking"`, 遷移先 `/ranking`
    4. **設定（`settings`）**: アイコン ⚙️, ラベル「設定」, `data-testid="tab-settings"`, 遷移先 `/settings`
- **グリッドレイアウト**:
  - `BottomTabBar`: `grid grid-cols-4 max-w-4xl mx-auto w-full h-14 border-t`
  - `ReaderBottomOverlay`: 下段タブ領域を `grid grid-cols-4` に拡張し、リーダー中からも検索・ランキングへダイレクトに移動可能とする。
- **アクティブタブ判定ルール**:
  - `/` → `bookshelf`
  - `/novels/:novelId`（目次）および `/novels/:novelId/chapters/:chapterIndex`（リーダー）→ 直前の遷移元が検索画面の場合は `search`、ランキング画面の場合は `ranking`、それ以外（本棚経由・直接）は `bookshelf`
  - `/search` → `search`
  - `/ranking` → `ranking`
  - `/settings` → `settings`

### 3.2 ルーティング（`router.tsx`）および OS バックキー論理階層遷移の 4 タブ対応

- **ルート定義の拡張**:
  - `AppRoute` に `{ name: "search"; path: "/search" }` および `{ name: "ranking"; path: "/ranking" }` を追加。
  - `useRouter()` に `navigateToSearch()` および `navigateToRanking()` ヘルパーを追加。
- **OS バックキー（論理階層遷移 `back()`）のルール更新**:
  1. **リーダー画面（`SCR-03`）**: しおりを保存し、常に目次画面（`SCR-02`）へ復帰。
  2. **作品詳細・目次画面（`SCR-02`）**: 直前の遷移元 `previousPath`（本棚 `/`、検索 `/search`、ランキング `/ranking`）へ復帰する（未指定時は `/`）。これにより検索やランキングから開いた作品の目次を閉じた際、閲覧していた検索・ランキング一覧へそのまま復帰できる。
  3. **下部タブ画面（`SCR-05: settings`, `SCR-06: search`, `SCR-07: ranking`）**: いずれのタブ上であっても、OS バックキーを押下したときはホームタブである **「本棚（`SCR-01: /`）」へ復帰** する。
  4. **本棚画面（`SCR-01`）**: ルート階層のため何もしない（Android OS によるアプリ終了待機）。

### 3.3 本棚画面（`SCR-01`）の URL 登録機能廃止と空状態誘導の刷新

- **URL 登録ダイアログの廃止**:
  - `BookshelfPage` ヘッダーから「＋ URLから追加」ボタン（`open-add-novel-button`）を削除。
  - `AddNovelDialog.tsx` および関連する状態・テストを廃止・クリーンアップ。
- **空状態（`BookshelfEmptyState`）の刷新**:
  - 旧: 「カクヨムの作品URLを入力して小説を追加しましょう」＋「URLから作品を追加」ボタン
  - 新: 「作品を検索したりランキングから探して、本棚に追加しましょう」のメッセージとともに、以下の 2 つの誘導ボタンを配置：
    - 「🔍 小説を検索する」（`data-testid="empty-search-button"`、遷移先: `/search`）
    - 「🏆 ランキングを見る」（`data-testid="empty-ranking-button"`、遷移先: `/ranking`）

### 3.4 パーサー層の検索・ランキング共通インターフェース拡張（`NovelParser`）

- **インターフェース定義（`src/parsers/types.ts`）**:
  - `NovelSearchOrder`: `"weekly_ranking" | "popular" | "last_episode_published_at" | "published_at"`
  - `NovelSerialStatus`: `"all" | "running" | "completed"`
  - `NovelSearchOptions`: `{ order?: NovelSearchOrder; serialStatus?: NovelSerialStatus; genre?: string; page?: number }`
  - `NovelRankingPeriod`: `"daily" | "weekly" | "monthly" | "entire"`
  - `NovelRankingOptions`: `{ period?: NovelRankingPeriod; genre?: string; page?: number }`
  - `NovelSearchResultItem`:
    - `remoteWorkId`: string
    - `title`: string
    - `author`: string
    - `synopsis`: string
    - `genre`: string
    - `genreLabel`: string
    - `serialStatus`: "running" | "completed"
    - `serialStatusLabel`: string
    - `episodeCount`: number
    - `characterCount`: number
    - `tags`: string[]
    - `reviewPoints`: number
    - `lastEpisodePublishedAt`: string | null
    - `workUrl`: string
  - `NovelRankingResultItem`: `NovelSearchResultItem` に `rank: number`（1位〜）を追加
  - `ParsedSearchResult`: `{ items: NovelSearchResultItem[]; pageInfo: { currentPage: number; hasNextPage: boolean; totalCount?: number } }`
  - `ParsedRankingResult`: `{ items: NovelRankingResultItem[]; pageInfo: { currentPage: number; hasNextPage: boolean } }`
  - `NovelParser` インターフェースへのオプショナル拡張:
    - `buildSearchUrl?(query: string, options?: NovelSearchOptions): string`
    - `searchNovels?(html: string, pageUrl: string): ParsedSearchResult`
    - `buildRankingUrl?(options?: NovelRankingOptions): string`
    - `getRanking?(html: string, pageUrl: string): ParsedRankingResult`
- **`KakuyomuParser` での実装**:
  - Next.js Apollo State 解析を最優先とし、DOM フォールバックを完備。
  - 純粋関数設計を維持し、外部通信は行わない。

### 3.5 検索画面（`SCR-06: /search`）の新設仕様

- **URL ルート**: `/search`
- **画面構成**:
  - **上部ヘッダー**: タイトル「検索」＋対象サイト選択ピル（カクヨムがアクティブ）
  - **検索バー**: キーワード入力欄 ＋ クリアボタン ＋ 検索実行ボタン
  - **フィルタ・ソートバー（横スクロールピル）**:
    - 並び順: 週間ランキング順（デフォルト） / 累計ランキング順 / 更新順 / 新作順
    - 連載状況: すべて（デフォルト） / 連載中 / 完結済
    - ジャンル: すべて（デフォルト） / 異世界ファンタジー / 現代ファンタジー / SF / 恋愛 / ラブコメ / 現代ドラマ / ホラー / ミステリー / エッセイ / 歴史 / 創作論 / その他
  - **作品カード一覧**:
    - タイトル、著者、ジャンルバッジ、連載状態バッジ、あらすじ抜粋、話数・文字数・★ポイント、タグラベル
    - 「＋ 本棚に追加」ボタン（登録済みは「✓ 登録済み」）
  - **ページャー / 次ページ読み込み**:
    - `hasNextPage` が true の場合、「次へ」またはページャーを表示。
- **状態管理（`useNovelSearch` カスタムフック）**:
  - `query`, `order`, `serialStatus`, `genre`, `page` の各状態管理
  - HTTP クライアント経由での HTML 取得および `KakuyomuParser.searchNovels` による解析
  - SQLite 内の登録済み作品 ID セットとの照合による `isRegistered` 判定
  - 通信中ローディング状態、0件時空状態、エラー時リトライ案内

### 3.6 ランキング画面（`SCR-07: /ranking`）の新設仕様

- **URL ルート**: `/ranking`
- **画面構成**:
  - **上部ヘッダー**: タイトル「ランキング」＋対象サイト選択ピル（カクヨムがアクティブ）
  - **集計期間タブ/ピル**: 日間 / 週間（デフォルト） / 月間 / 累計
  - **ジャンル選択ピル（横スクロール）**: 総合（デフォルト） ＋ 主要12ジャンル
  - **ランキング作品一覧**:
    - 順位バッジ（1位〜3位はゴールド/シルバー/ブロンズ強調表示、4位以降は数字バッジ）
    - 作品メタデータ、あらすじ、タグ
    - 「＋ 本棚に追加」ボタン（登録済みは「✓ 登録済み」）
- **状態管理（`useNovelRanking` カスタムフック）**:
  - `period`, `genre`, `page` の各状態管理
  - HTTP 取得 ＆ `KakuyomuParser.getRanking` による解析
  - 登録済み判定および追加アクション

### 3.7 作品カード「＋ 本棚に追加」その場登録とタップ遷移仕様

- **「＋ 本棚に追加」ボタン押下時**:
  - 画面遷移せず、その場でローディングインジケーター（スピナー / 「追加中...」）を表示。
  - バックグラウンドで `httpClient.getHtml(workUrl)` を実行し、`KakuyomuParser.parseNovelIndex` で目次を取得して `novelRepository.upsertNovelWithToc` で SQLite に永続化。
  - 成功するとボタンが即時に「✓ 登録済み」へ切り替わり、非活性化（または登録済みスタイル）となる。
  - 失敗した場合はエラー Toast / 通知を表示し、再試行可能な状態へ復帰する。
- **カード本体タップ時**:
  - **すでに登録済みの場合**: 直ちに該当作品の作品詳細・目次画面（`SCR-02: /novels/:novelId`）へ遷移する。
  - **未登録の場合**: 自動で「＋ 本棚に追加」の登録処理（目次取得 ＆ SQLite 保存）を実行し、保存完了後にそのまま該当作品の作品詳細・目次画面（`SCR-02`）へシームレスに遷移する。

---

## 4. 変更対象の App 全体正本ファイル一覧（影響度マトリクス）

| ファイルパス                           | 種別             | 変更内容概要                                                                                                            |
| :------------------------------------- | :--------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/requirements.md`           | App 全体正本     | `SYS-REQ-17`〜`20` 新設、`SYS-REQ-01` の URL 登録廃止反映、v0.3 要件追記                                                |
| `docs/specs/screen-transitions.md`     | App 全体正本     | `SCR-06`, `SCR-07` 新設、Mermaid 図更新、`TR-01` 4タブ化、`TR-07`・`TR-12` Backキー更新、`TR-14`, `TR-15` 新設          |
| `docs/specs/features/bookshelf.md`     | App 全体正本     | `AddNovelDialog` 廃止、ヘッダーURL追加ボタン削除、`BookshelfEmptyState` の検索・ランキング誘導化、`AC-BS-01`・`02` 更新 |
| `docs/specs/features/novel-detail.md`  | App 全体正本     | `TR-07`・`AC-ND-07`・`AC-ND-09` を直前の探索元（本棚/検索/ランキング）への復帰に拡張、4タブ連携同期                     |
| `docs/specs/features/reader-view.md`   | App 全体正本     | `ReaderBottomOverlayProps` の 4 タブ対応（`bookshelf` / `search` / `ranking` / `settings`）、`AC-RD-08` 同期            |
| `docs/specs/features/search.md`        | 新規機能正本     | 検索画面（`SCR-06`）のコンポーネント構成、`useNovelSearch` 契約、受入条件 `AC-SE-01`〜`08` を定義                       |
| `docs/specs/features/ranking.md`       | 新規機能正本     | ランキング画面（`SCR-07`）のコンポーネント構成、`useNovelRanking` 契約、受入条件 `AC-RK-01`〜`07` を定義                |
| `docs/specs/parsers/kakuyomu.md`       | App 全体正本     | カクヨム検索・ランキングの URL 生成仕様、Apollo State（`searchWorks`, `rankedWorks`）および DOM 抽出仕様の追記          |
| `docs/specs/architecture.md`           | App 全体正本     | UI 層（`features/search`, `features/ranking`）および Parser 層（検索/ランキング解析契約）の全体像反映                   |
| `docs/index.md`                        | ドキュメント目次 | 新設された `features/search.md`, `features/ranking.md` および本差分仕様書の登録                                         |
| `docs/quality/bug-and-handover-log.md` | 品質正本         | 申し送り事項 `HO-16`（検索/ランキングからの追加とIT検証）、`HO-17`（4タブ・OS Backキー結合検証）の起票                  |

---

## 5. テスト計画（UT / VRT / IT）

1. **単体テスト（Vitest TDD Red-Green-Refactor, C0/C1 100%）**:
   - `KakuyomuParser.test.ts`:
     - 検索 URL 生成（各パラメータ組み合わせ）
     - 検索結果 HTML フィクスチャ解析（Apollo State 正常系、DOM フォールバック、0件系、エラー系）
     - ランキング URL 生成（期間・ジャンル組み合わせ）
     - ランキング結果 HTML フィクスチャ解析（順位付け、Apollo State 正常系、DOM フォールバック）
   - `BottomTabBar.test.tsx` & `ReaderBottomOverlay.test.tsx`:
     - 4 タブ描画、各タブのアクセシビリティ（role, aria-selected）、クリックイベント発火
   - `router.test.tsx`:
     - `/search`, `/ranking` のルートマッチング
     - OS バックキー論理階層遷移（SCR-02 からの遷移元復帰、4タブからの本棚復帰）
   - `useNovelSearch.test.ts` & `SearchPage.test.tsx`:
     - 検索実行、フィルタ切替、登録済み判定、カードからの本棚追加アクション、エラー/空状態
   - `useNovelRanking.test.ts` & `RankingPage.test.tsx`:
     - 期間/ジャンル切替、順位表示、本棚追加アクション、エラー/空状態
   - `BookshelfPage.test.tsx` & `BookshelfEmptyState.test.tsx`:
     - URL 登録ボタン非表示確認、空状態からの `/search` および `/ranking` 遷移コールバック確認
2. **Storybook ＆ VRT（1280px / 375px）**:
   - `BottomTabBar.stories.tsx`: 4 タブ状態（各タブアクティブ）
   - `ReaderBottomOverlay.stories.tsx`: 4 タブオーバーレイ
   - `BookshelfEmptyState.stories.tsx`: 検索・ランキング誘導ボタンスタイル
   - `SearchPage.stories.tsx`: 検索入力前、検索結果一覧、空状態、ローディング
   - `RankingPage.stories.tsx`: 総合週間ランキング、各ジャンルランキング、順位バッジ強調表示
3. **結合テスト（Playwright IT `SCN-02`）**:
   - `test/it/scenarios/scn02-search-ranking-discovery.spec.ts` 新設:
     - 下部タブから「検索」タブを選択 → キーワード入力で検索実行 → 検索結果カードの「＋ 本棚に追加」を押下 → 「✓ 登録済み」へ切り替わることを確認。
     - 下部タブから「ランキング」タブを選択 → 週間ランキング表示 → 1位のカード本体をタップ → 自動追加されて作品詳細・目次（`SCR-02`）へ遷移することを確認。
     - 目次からエピソードを選択してリーダー（`SCR-03`）へ移動 → 読書後に OS バックキーを押下して目次へ復帰 → 再度バックキーでランキング画面へ復帰することを確認。
     - 下部タブから「本棚」へ移動し、追加した作品が本棚一覧に正しく表示されていることを確認。

---

## 6. 実装 Sub-issue 分割計画（5分割）

1 PR あたり 200〜400 行の適正粒度を維持するため、以下の 5 本の Sub-issue に分割して順次（直列）着手します。

### Sub-issue ① [MK-1]: パーサー層拡張（検索・ランキング解析と単体テスト）

- **対象**: `src/parsers/types.ts`, `src/parsers/kakuyomu/KakuyomuParser.ts`, Fixtures, 単体テスト
- **作業内容**:
  - `NovelParser` への検索・ランキング型定義およびメソッド追加
  - `KakuyomuParser` でのカクヨム検索・ランキング URL 構築と HTML/Apollo State 解析（フォールバック含む）の実装
  - 検索・ランキング実 HTML フィクスチャの配置と TDD 単体テスト（C0/C1 100%）

### Sub-issue ② [MK-2]: 4タブシェル・ルーティング・本棚URL登録廃止

- **対象**: `BottomTabBar`, `ReaderBottomOverlay`, `router.tsx`, `BookshelfPage`, `BookshelfEmptyState`, Stories, VRT
- **作業内容**:
  - `BottomTabBar` および `ReaderBottomOverlay` の 4 タブ化
  - `router.tsx` に `/search`, `/ranking` ルートおよび 4 タブ/探索元復帰の OS バックキー論理階層遷移を追加
  - 本棚から `AddNovelDialog` を削除し、`BookshelfEmptyState` に検索・ランキング誘導ボタンを実装
  - 関連 Storybook 作成、単体テスト、VRT スナップショット更新

### Sub-issue ③ [MK-3]: 検索画面（SCR-06）の実装

- **対象**: `src/features/search/`
- **作業内容**:
  - サイト選択ピル、検索キーワード入力バー、並び順セレクタ、ジャンル/連載状態フィルタピル
  - 検索結果作品カード（本棚追加ボタン、登録済みバッジ、ローディング、カードタップ遷移）
  - カスタムフック `useNovelSearch` の実装（検索、ページング、本棚登録連携）
  - `SearchPage`, `SearchContainer` の実装、Stories、Portable Stories UT（100% C0/C1）、VRT

### Sub-issue ④ [MK-4]: ランキング画面（SCR-07）の実装

- **対象**: `src/features/ranking/`
- **作業内容**:
  - サイト選択ピル、期間セレクタ（4種）、ジャンルピル（総合＋12ジャンル）
  - ランキング作品カード（順位バッジ強調、本棚追加ボタン、登録済みバッジ、カードタップ遷移）
  - カスタムフック `useNovelRanking` の実装（ランキング取得、本棚登録連携）
  - `RankingPage`, `RankingContainer` の実装、Stories、Portable Stories UT（100% C0/C1）、VRT

### Sub-issue ⑤ [IT]: Playwright E2E 結合テスト・全体回帰と申し送り精算

- **対象**: `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`, `docs/quality/bug-and-handover-log.md`
- **作業内容**:
  - 検索・ランキングから作品探索・その場追加・目次確認・リーダー読書・4タブ/Backキー遷移の一貫シナリオ `SCN-02` の実装
  - 既存 `SCN-01` を含む Playwright 全体回帰テスト 100% PASS 確認
  - 申し送り事項 `HO-16`, `HO-17` の解決確認と本差分仕様書のアーカイブ移動

---

## 7. 申し送り事項（Handover Items）

本要望の着手にあたり、以下の申し送り事項を `docs/quality/bug-and-handover-log.md` に登録します。

- **`HO-16`**: カクヨム検索・ランキングからの作品カード「＋ 本棚に追加」押下による目次取得および DB 登録（`upsertNovelWithToc`）と即時「✓ 登録済み」切り替え、および登録済みカードタップによる作品詳細（`SCR-02`）遷移の一連導線に関する Playwright 実ブラウザ IT シナリオ（`SCN-02`）での全体回帰検証
- **`HO-17`**: 下部 4 タブ（本棚・検索・ランキング・設定）およびリーダー下部オーバーレイ 4 タブ、ならびに OS バックキー論理階層遷移（SCR-02 戻り元復帰、4タブ本棚復帰）の Playwright IT（`SCN-01`/`SCN-02`）および実機での検証
