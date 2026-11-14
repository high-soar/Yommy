---
type: spec-feature
title: "検索画面仕様書（SCR-06: Novel Search）"
description: "複数小説サイト（カクヨム・小説家になろう）のサイト切替、キーワード・除外キーワード検索、並び順・連載状態（すべて/連載中/完結済/短編）・サイト別複数ジャンル（OR）フィルタ、作品カード一覧およびその場での本棚追加を提供する検索画面（SCR-06）の正本仕様。"
status: "Review (#368)"
updated: "2026-11-15"
tags:
  - search
  - scr-06
  - kakuyomu
  - narou
  - site-selector
  - multi-page-toc
  - filtering
  - short-story
  - exclude-keyword
  - multi-genre
  - sorting
  - ui
  - shell
  - bottom-nav
  - ho-31
related_specs:
  - docs/specs/changes/archive/issue-265-work-variation-filter.md
  - docs/specs/changes/archive/issue-264-advanced-search-filter.md
  - docs/specs/changes/archive/issue-240-narou-search-ranking-and-site-selector.md
  - docs/specs/changes/archive/issue-239-narou-parser-and-multi-page-toc.md
  - docs/specs/parsers/narou.md
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/archive/issue-238-loading-ux-clarification.md
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
related_tests:
  - src/App.test.tsx
  - src/app/router.test.tsx
  - src/features/search/constants.test.ts
  - src/features/search/components/SiteSelector.test.tsx
  - src/features/search/components/SearchInputBar.test.tsx
  - src/features/search/components/SearchFilterBar.test.tsx
  - src/features/search/components/SearchNovelCard.test.tsx
  - src/features/search/components/SearchPage.test.tsx
  - src/features/search/components/SearchContainer.test.tsx
  - src/features/search/hooks/useNovelSearch.test.ts
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
  - test/it/smoke.spec.ts
---

# 検索画面仕様書（SCR-06）

本ドキュメントは、Yommy の作品検索機能を提供する **検索画面（`SCR-06`: ルート `/search`）** の画面構成、Presentational / Container コンポーネント契約、`useNovelSearch` カスタムフック契約、および受入条件（`AC-SE-xx`）を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 検索画面（`SCR-06`、ルートパス `/search`）
- **対応要件**:
  - `SYS-REQ-01`（検索結果カードからのワンタップ作品登録・複数ページ目次取得）
  - `SYS-REQ-17`（マルチサイト作品検索機能：カクヨム・小説家になろうのサイト切替、キーワード・除外キーワード、並び順4種、連載状態、サイト別複数ジャンル［OR］フィルタ、次ページ取得）
  - `SYS-REQ-19`（検索結果カードからの本棚ワンタップ即時登録および作品詳細遷移）
  - `SYS-REQ-20`（下部4タブナビゲーションおよびOSバックキー論理階層遷移）
- **関連画面遷移**:
  - `TR-01`（下部タブバーによる 4 画面「本棚 `/`」「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」相互切替）
  - `TR-12`（検索画面上での OS バックキー操作によるホーム「本棚 `SCR-01` `/`」への復帰）
  - `TR-14`（検索結果カード本体タップによる作品詳細・目次画面 `SCR-02` `/novels/:novelId` への遷移）
- **対象外スコープ**:
  - 複数サイトを横断して 1 つのリストに混在表示する統合検索（サイトピルによる切り替え方式とする）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/search/` 配下を以下のモジュール構成とします。

```text
src/features/search/
├── __fixtures__/
│   └── searchFixtures.ts             # 検索画面用静的モックデータ（pure static fixtures）
├── components/
│   ├── SiteSelector.tsx              # 対象サイト切替ピル（カクヨム / 小説家になろう）
│   ├── SiteSelector.stories.tsx
│   ├── SiteSelector.test.tsx
│   ├── SearchInputBar.tsx            # キーワード入力・クリア・検索ボタンバー
│   ├── SearchInputBar.stories.tsx
│   ├── SearchInputBar.test.tsx
│   ├── SearchFilterBar.tsx           # 並び順・連載状態・サイト別ジャンル切替横スクロールピル
│   ├── SearchFilterBar.stories.tsx
│   ├── SearchFilterBar.test.tsx
│   ├── SearchNovelCard.tsx           # 検索結果作品カード（メタデータ・「＋ 本棚に追加」ボタン）
│   ├── SearchNovelCard.stories.tsx
│   ├── SearchNovelCard.test.tsx
│   ├── SearchPage.tsx                # 検索画面 Presentational レイアウト統合
│   ├── SearchPage.stories.tsx
│   ├── SearchPage.test.tsx
│   ├── SearchContainer.tsx           # useNovelSearch / useRouter 接続 Container
│   ├── SearchContainer.stories.tsx
│   └── SearchContainer.test.tsx
├── hooks/
│   ├── useNovelSearch.ts             # 検索状態管理・HTTP取得・DB登録カスタムフック
│   └── useNovelSearch.test.ts
├── constants.ts                      # 検索画面固有の実行時定数定義
├── constants.test.ts                 # constants.ts 1対1単体テスト
└── types.ts                          # 検索画面固有の UI 型定義
```

---

## 3. UI・Presentational コンポーネント契約

### 3.1 `SearchPageProps`

```typescript
export interface SearchPageProps {
  /** 選択中サイト識別子 */
  selectedSite: NovelSiteType;
  /** サイト変更コールバック */
  onSelectSite: (site: NovelSiteType) => void;
  /** 入力中のキーワード文字列 */
  keyword: string;
  /** キーワード変更コールバック */
  onChangeKeyword: (keyword: string) => void;
  /** 入力中の除外キーワード文字列（省略時は ""、v0.8 Issue #264） */
  excludeKeyword?: string;
  /** 除外キーワード変更コールバック（v0.8 Issue #264） */
  onChangeExcludeKeyword?: (excludeKeyword: string) => void;
  /** 検索実行コールバック */
  onSubmitSearch: () => void;
  /** 選択中並び順 */
  selectedOrder: NovelSearchOrder;
  /** 並び順変更コールバック */
  onSelectOrder: (order: NovelSearchOrder) => void;
  /** 選択中連載状況 */
  selectedSerialStatus: NovelSerialStatus;
  /** 連載状況変更コールバック */
  onSelectSerialStatus: (status: NovelSerialStatus) => void;
  /** 選択中ジャンル（単一指定・後方互換用、selectedGenres 未指定時に参照） */
  selectedGenre?: string;
  /** 複数選択中ジャンルID配列（空配列時は「すべて」、v0.8 Issue #264） */
  selectedGenres?: string[];
  /** ジャンルトグル選択コールバック（undefined 時は「すべて」＝全解除） */
  onSelectGenre: (genre?: string) => void;
  /** 検索結果作品リスト */
  items: NovelSearchResultItem[];
  /** 登録済み作品 ID（remoteWorkId）のセット */
  registeredWorkIds: Set<string>;
  /** 現在追加処理中の remoteWorkId（処理中でない場合 null） */
  addingWorkId: string | null;
  /** 検索実行済みフラグ（初回未検索状態と0件結果状態の判別用 / R1-14） */
  hasSearched?: boolean;
  /** 通信中フラグ */
  isLoading: boolean;
  /** 次ページ通信中フラグ */
  isLoadingMore: boolean;
  /** 次ページが存在するかどうか */
  hasNextPage: boolean;
  /** 次ページ取得コールバック */
  onLoadMore: () => void;
  /** エラーメッセージ（エラーがない場合 null） */
  error: string | null;
  /** エラー再試行コールバック */
  onRetry: () => void;
  /** カード内「＋ 本棚に追加」ボタン押下時のコールバック */
  onAddNovel: (item: NovelSearchResultItem) => void | Promise<void>;
  /** カード本体タップ時のコールバック */
  onSelectCard: (item: NovelSearchResultItem) => void;
}
```

### 3.2 `SearchNovelCardProps`

```typescript
export interface SearchNovelCardProps {
  item: NovelSearchResultItem;
  /** すでに SQLite DB に登録済みかどうか */
  isRegistered: boolean;
  /** 現在本棚追加の通信中かどうか */
  isAdding: boolean;
  /** 「＋ 本棚に追加」ボタン押下ハンドラ */
  onAdd: () => void;
  /** カード本体タップハンドラ */
  onSelect: () => void;
}
```

### 3.3 `SiteSelectorProps`

```typescript
export interface SiteSelectorProps {
  selectedSite: NovelSiteType;
  onSelectSite: (site: NovelSiteType) => void;
  /** 通信中操作抑止フラグ（省略時は false、v0.7 Issue #238） */
  disabled?: boolean;
}
```

### 3.4 `SearchInputBarProps`

```typescript
export interface SearchInputBarProps {
  keyword: string;
  onChangeKeyword: (keyword: string) => void;
  /** 除外キーワード文字列（省略時は ""、v0.8 Issue #264） */
  excludeKeyword?: string;
  /** 除外キーワード変更コールバック（v0.8 Issue #264） */
  onChangeExcludeKeyword?: (excludeKeyword: string) => void;
  /** 除外キーワード入力欄の初期開閉状態（Storybook / テスト用、省略時は excludeKeyword の有無で判定、R1-12） */
  defaultOpenExclude?: boolean;
  onSubmitSearch: () => void;
  /** 検索通信中フラグ（true時は検索ボタン無効化、テキスト入力は可能維持、v0.7 Issue #238） */
  isLoading?: boolean;
}
```

- 1 段目にキーワード入力欄（`data-testid="search-input"`, `placeholder="作品名・著者名・キーワードを入力"`）・クリアボタン（`data-testid="search-clear-button"`, `aria-label="キーワードをクリア"`）・「除外語」トグルボタン（`data-testid="search-exclude-toggle-button"`, `aria-expanded={isExcludeOpen}`, `aria-label="除外キーワード入力を開く"` / `"除外キーワード入力を閉じる"`, 展開時 `isExcludeOpen === true` のみ `aria-controls={excludeInputId}` を出力し折りたたみ時は出力しない、R2-09）・「検索」実行ボタン（`data-testid="search-submit-button"`, `aria-label="検索"`）を配置する。
- 「除外語」トグルボタン押下により、2 段目に除外キーワード入力欄（`data-testid="search-exclude-input"`, `id={excludeInputId}`［`useId()` で一意生成］, `aria-label="除外キーワード"`, `placeholder="除外ワード（スペース区切り）"`、R2-09）およびクリアボタン（`data-testid="search-exclude-clear-button"`, `aria-label="除外キーワードをクリア"`）をインライン開閉する（初期描画時に `excludeKeyword` が非空の場合は展開状態で初期化）。またパネルが閉じていても `excludeKeyword.trim().length > 0` のときはトグルボタンを強調表示（`data-active="true"`、青色ボーダーおよびドットインジケーター表示）する（v0.8 Issue #264）。

### 3.5 `SearchFilterBarProps`

```typescript
export interface SearchFilterBarProps {
  /** 選択中サイト識別子（サイト別ジャンルピル切替用、省略時は "kakuyomu"、v0.7 Issue #240） */
  selectedSite?: NovelSiteType;
  selectedOrder: NovelSearchOrder;
  onSelectOrder: (order: NovelSearchOrder) => void;
  selectedSerialStatus: NovelSerialStatus;
  onSelectSerialStatus: (status: NovelSerialStatus) => void;
  /** 単一ジャンル指定（後方互換用。selectedGenres 未指定時に参照） */
  selectedGenre?: string;
  /** 複数選択中ジャンルID配列（空配列時は「すべて」選択状態、v0.8 Issue #264） */
  selectedGenres?: string[];
  /** ジャンルトグル選択コールバック（undefined 渡し時は「すべて」＝全解除） */
  onSelectGenre: (genre?: string) => void;
  /** 通信中操作抑止フラグ（省略時は false、v0.7 Issue #238） */
  disabled?: boolean;
}
```

### 3.6 `SearchContainerProps`

```typescript
export interface SearchContainerProps {
  /** 作品カード本体タップ時の遷移コールバック（省略時は useNovelSearch().handleCardSelect を使用） */
  onSelectNovel?: (novelId: string) => void;
}
```

---

## 4. `useNovelSearch` カスタムフック契約

```typescript
export interface UseNovelSearchResult {
  selectedSite: NovelSiteType;
  setSelectedSite: (site: NovelSiteType) => void;
  keyword: string;
  setKeyword: (keyword: string) => void;
  excludeKeyword: string;
  setExcludeKeyword: (excludeKeyword: string) => void;
  search: () => Promise<void>;
  order: NovelSearchOrder;
  setOrder: (order: NovelSearchOrder) => void;
  serialStatus: NovelSerialStatus;
  setSerialStatus: (status: NovelSerialStatus) => void;
  genre: string | undefined;
  genres: string[];
  setGenre: (genre: string | undefined) => void;
  items: NovelSearchResultItem[];
  registeredWorkIds: Set<string>;
  addingWorkId: string | null;
  isLoading: boolean;
  hasSearched: boolean;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  loadMore: () => Promise<void>;
  error: string | null;
  retry: () => Promise<void>;
  addNovelToBookshelf: (item: NovelSearchResultItem) => Promise<string | null>; // 追加成功時は novelId を返却
  handleCardSelect: (item: NovelSearchResultItem) => Promise<void>;
}
```

- **直近検索実行条件の確定保持（`committedQueryRef`, R1-07 / R2-15）**:
  - 1 ページ目の検索実行（`executeSearch(..., 1, false)`）時に、その時点で確定した検索条件（`site`, `keyword`, `excludeKeyword`, `order`, `serialStatus`, `genres`）を `committedQueryRef` に保持する。
  - 次ページ追加読み込み（`loadMore`）時は、未送信の入力欄編集値（`keyword`, `excludeKeyword` state）ではなく、`committedQueryRef.current` に保持された確定済み検索条件を使用して 2 ページ目以降の URL を構築する。
- **アンマウント時クリーンアップと世代ガード（`isMountedRef` / `searchGenerationRef`, R2-17）**:
  - コンポーネントアンマウント時に `isMountedRef.current = false` および `searchGenerationRef.current += 1` を実行し、進行中の検索リクエストや作品登録・画面遷移（`addNovelToBookshelf` / `handleCardSelect`）の非同期完了後に State 更新や遅延 `navigateToNovelDetail` が発火しないようガードする。

---

## 5. 受入条件（Acceptance Criteria: `AC-SE-xx`）

| 受入条件 ID    | 対象項目                                 | 仕様・期待動作                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 関連要件 / 遷移            |
| :------------- | :--------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- |
| **`AC-SE-01`** | 初期表示とサイト選択                     | `/search` への初回アクセス時、上部に「検索」タイトルと対象サイトピル（「カクヨム」「小説家になろう」、双方選択可能、デフォルトは「カクヨム」）が表示され、未検索時は「キーワードを入力して小説を検索」の初期案内 UI が表示されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `SYS-REQ-17, 20` / `TR-01` |
| **`AC-SE-02`** | キーワード検索実行                       | 検索バーに文字列（または除外キーワード）を入力して検索を実行すると、選択中サイトのパーサー（`KakuyomuParser` または `NarouParser`）の `buildSearchUrl` により生成された URL を `httpClient` 経由で取得し、`searchNovels` でパースされた作品一覧がカード形式で表示されること。                                                                                                                                                                                                                                                                                                                                                                                                                                           | `SYS-REQ-17`               |
| **`AC-SE-03`** | 並び順の切り替え                         | フィルタバーの並び順（週間ランキング順、累計ランキング順、更新順、新作順）を選択すると、即座に対応するパラメータ（`order`）で再検索が開始され、旧検索結果一覧が非表示となって `search-loading` が表示され、通信完了後に一覧が更新されること（デフォルトは週間ランキング順）。通信中はフィルタバーおよび検索ボタンが無効化されること（v0.7 Issue #238）。                                                                                                                                                                                                                                                                                                                                                                | `SYS-REQ-17`               |
| **`AC-SE-04`** | 連載状態・サイト別複数ジャンル絞り込み   | 連載状態ピル（すべて `all`、連載中 `running`、完結済 `completed`、短編 `short` の4種。カクヨムは `completed` を `serial_status=completed`、`short` を `serial_status=completed` かつ `total_character_count_range=-20000`［完結済・20,000文字以下、R2-18］、なろうは省略/`type=r`/`type=er`/`type=t` にマッピング）およびサイト別ジャンルピル（カクヨム選択時は主要12種、なろう選択時は公式小ジャンル21種。複数ピルの ON/OFF トグル選択に対応し、「すべて」選択または全解除時は全ジャンル対象に復帰）の選択により、旧検索結果一覧が非表示となって `search-loading` が表示され、絞り込み再検索が実行されること。通信中はフィルタバーおよび検索ボタンが無効化されること（v0.7 Issue #238, #240、v0.8 Issue #264, #265）。 | `SYS-REQ-17`               |
| **`AC-SE-05`** | 作品カードメタデータ描画                 | 各作品カードに、タイトル、著者名、ジャンルバッジ、連載状態バッジ（連載中 / 完結済 / 短編）、あらすじ抜粋、話数、総文字数、★ポイント数、タグラベルが欠損なく描画されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `SYS-REQ-17`               |
| **`AC-SE-06`** | カード内「＋ 本棚に追加」その場登録      | カードの「＋ 本棚に追加」ボタンを押下すると、画面遷移せずにボタンがローディング表示となり、バックグラウンドで `fetchFullNovelIndex`（`nextTocPageUrl` による複数ページ目次連続取得対応、Issue #239）および SQLite 保存（`upsertNovelWithToc`）が行われ、成功時に「✓ 登録済み」へ切り替わり `syncEngine.notifyChanged()` による自動 Push がトリガーされること（R1-26）。                                                                                                                                                                                                                                                                                                                                                 | `SYS-REQ-01, 19` / `TR-14` |
| **`AC-SE-07`** | カード本体タップ時の導線                 | 登録済みカードをタップしたときは直ちにその作品の目次画面（`SCR-02`）へ遷移し、未登録カードをタップしたときは自動で「本棚に追加」を実行した上で完了後に目次画面へ遷移すること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `SYS-REQ-01, 19` / `TR-14` |
| **`AC-SE-08`** | 次ページ読み込み                         | 検索結果が20件以上あり `hasNextPage` が true の場合、最下部の「さらに読み込む」ボタン押下で直近の検索実行時の条件（`keyword`, `excludeKeyword`, `order`, `serialStatus`, `genres`、R1-07 / R2-15）を維持したまま次ページの作品が追加読み込みされること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `SYS-REQ-17`               |
| **`AC-SE-09`** | 再検索時ローディング表示と操作重複抑止   | キーワード再検索や並び順・連載状態・ジャンル・サイト切替による 1 ページ目再取得中（`isLoading === true`）は、直前の検索結果一覧を画面からクリアし中央にローディングスピナー（`data-testid="search-loading"`）を表示すること。通信中は検索実行ボタン・フィルタバー・サイトセレクタが操作不能となり、テキスト入力（キーワードおよび除外キーワード）はフォーカス・文字入力を維持すること（v0.7 Issue #238、v0.8 Issue #264）。                                                                                                                                                                                                                                                                                             | `SYS-REQ-17`               |
| **`AC-SE-10`** | サイト切替と条件・登録済み状態連動       | `SiteSelector` で「カクヨム ⇔ 小説家になろう」を切り替えた際、サイト共通のキーワード・除外キーワード・並び順・連載状態は保持しつつサイト固有のジャンル選択（`genres` / `genre`）のみ「すべて（`[]` / `undefined`）」にリセットされ、ジャンルピル一覧が切替後サイトの定義に切り替わること。また検索実行済み（`hasSearched === true`）時は直ちに新サイトで自動再検索が走り、未検索時は初期案内を維持したまま `registeredWorkIds` が切替後サイトの登録済み作品セットへ更新されること（v0.7 Issue #240、v0.8 Issue #264）。                                                                                                                                                                                                 | `SYS-REQ-17, 19`           |
| **`AC-SE-11`** | 除外キーワード指定・複数ジャンル詳細検索 | `SearchInputBar` の「除外語」トグルボタン（`search-exclude-toggle-button`）で除外キーワード入力欄（`search-exclude-input`）を開閉・クリアでき、除外キーワード設定時はパネルを閉じていてもトグルボタンが強調表示されること。また除外キーワード指定（カクヨムは `q` への `-語` 結合、なろうは `notword` パラメータ）および複数ジャンルピル同時選択（カクヨムは `genre_name` カンマ連結、なろうは `genre` ハイフン連結）により詳細条件で検索・再検索が実行されること（v0.8 Issue #264 / `HO-31`）。                                                                                                                                                                                                                        | `SYS-REQ-17`               |

---

## 6. テスト責務・カバレッジ計画

- **単体テスト (`SearchInputBar.test.tsx`, `SearchFilterBar.test.tsx`, `SiteSelector.test.tsx`, `SearchNovelCard.test.tsx`, `SearchPage.test.tsx`, `SearchContainer.test.tsx`, `useNovelSearch.test.ts`)**:
  - `docs/guidelines/testing.md` に従い、全分岐（C0/C1 100%）およびアクセシビリティ（role, aria 属性）を検証。
  - SQLite リポジトリとの連携テストは `resetTestDb()` を使用して決定論的に実行。
- **Storybook ＆ VRT (1280px / 375px)**:
  - キーワード未入力初期状態、除外キーワード展開・適用中状態、複数ジャンル選択状態、検索結果一覧表示状態、追加処理中状態、登録済み状態、空状態（0件）、通信エラー状態の各ストーリーを作成し VRT 検証を実施。
- **Playwright システム結合テスト（`SCN-02`: `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`）**:
  - 本棚空状態からの検索画面遷移（`TR-15`）、キーワード検索・除外キーワード指定・並び順/連載状態/複数ジャンルフィルタ・サイト切替・再検索ローディング・次ページ読み込み（`AC-SE-01`〜`05`, `08`, `09`, `10`, `11`）、カード内「＋ 本棚に追加」その場登録（`AC-SE-06`）、およびカード本体タップによる作品詳細（`SCR-02`）遷移と OS バックキーによる検索画面への論理復帰（`TR-14`, `TR-07`, `AC-SE-07`）を一気通貫で検証。
