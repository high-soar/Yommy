---
type: spec-feature
title: 検索画面仕様書（SCR-06: Novel Search）
description: 複数小説サイト（v0.3はカクヨム）のキーワード検索、並び順・ジャンル・連載状態フィルタ、作品カード一覧およびその場での本棚追加を提供する検索画面（SCR-06）の正本仕様。
status: "Review (#79)"
updated: "2026-10-29"
tags:
  - search
  - scr-06
  - kakuyomu
  - filtering
  - sorting
  - ui
  - shell
  - bottom-nav
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/issue-79-four-tabs-search-ranking.md
related_tests:
  - src/App.test.tsx
  - src/app/router.test.tsx
  - test/it/smoke.spec.ts
---

# 検索画面仕様書（SCR-06）

本ドキュメントは、Yommy の作品検索機能を提供する **検索画面（`SCR-06`: ルート `/search`）** の画面構成、Presentational / Container コンポーネント契約、`useNovelSearch` カスタムフック契約、および受入条件（`AC-SE-xx`）を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 検索画面（`SCR-06`、ルートパス `/search`）
- **対応要件**:
  - `SYS-REQ-17`（カクヨム作品検索機能：キーワード、並び順4種、連載状態、ジャンルフィルタ、次ページ取得）
  - `SYS-REQ-19`（検索結果カードからの本棚ワンタップ即時登録および作品詳細遷移）
  - `SYS-REQ-20`（下部4タブナビゲーションおよびOSバックキー論理階層遷移）
- **関連画面遷移**:
  - `TR-01`（下部タブバーによる 4 画面「本棚 `/`」「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」相互切替）
  - `TR-12`（検索画面上での OS バックキー操作によるホーム「本棚 `SCR-01` `/`」への復帰）
  - `TR-14`（検索結果カード本体タップによる作品詳細・目次画面 `SCR-02` `/novels/:novelId` への遷移）
- **対象外スコープ（Milestone `v0.4` 以降）**:
  - 小説家になろう（`narou`）の検索実装（サイト選択ピルの切替対象追加）
  - 複数ジャンルの AND/OR チェックボックスによる複合モーダル検索

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/search/` 配下を以下のモジュール構成とします。

```text
src/features/search/
├── components/
│   ├── SiteSelector.tsx              # 対象サイト切替ピル（カクヨム / 将来のなろう）
│   ├── SiteSelector.stories.tsx
│   ├── SiteSelector.test.tsx
│   ├── SearchInputBar.tsx            # キーワード入力・クリア・検索ボタンバー
│   ├── SearchInputBar.stories.tsx
│   ├── SearchInputBar.test.tsx
│   ├── SearchFilterBar.tsx           # 並び順・連載状態・ジャンル切替横スクロールピル
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
  /** 選択中ジャンル（未指定時 undefined） */
  selectedGenre?: string;
  /** ジャンル変更コールバック */
  onSelectGenre: (genre?: string) => void;
  /** 検索結果作品リスト */
  items: NovelSearchResultItem[];
  /** 登録済み作品 ID（remoteWorkId）のセット */
  registeredWorkIds: Set<string>;
  /** 現在追加処理中の remoteWorkId（処理中でない場合 null） */
  addingWorkId: string | null;
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

---

## 4. `useNovelSearch` カスタムフック契約

```typescript
export interface UseNovelSearchResult {
  selectedSite: NovelSiteType;
  setSelectedSite: (site: NovelSiteType) => void;
  keyword: string;
  setKeyword: (keyword: string) => void;
  search: () => Promise<void>;
  order: NovelSearchOrder;
  setOrder: (order: NovelSearchOrder) => void;
  serialStatus: NovelSerialStatus;
  setSerialStatus: (status: NovelSerialStatus) => void;
  genre: string | undefined;
  setGenre: (genre: string | undefined) => void;
  items: NovelSearchResultItem[];
  registeredWorkIds: Set<string>;
  addingWorkId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  loadMore: () => Promise<void>;
  error: string | null;
  retry: () => Promise<void>;
  addNovelToBookshelf: (item: NovelSearchResultItem) => Promise<string | null>; // 追加成功時は novelId を返却
  handleCardSelect: (item: NovelSearchResultItem) => Promise<void>;
}
```

---

## 5. 受入条件（Acceptance Criteria: `AC-SE-xx`）

| 受入条件 ID    | 対象項目                            | 仕様・期待動作                                                                                                                                                                                                                           |
| :------------- | :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AC-SE-01`** | 初期表示とサイト選択                | `/search` への初回アクセス時、上部に「検索」タイトルと「カクヨム」ピルが表示され、未検索時は「キーワードを入力して小説を検索」の初期案内 UI が表示されること。                                                                           |
| **`AC-SE-02`** | キーワード検索実行                  | 検索バーに文字列を入力して検索を実行すると、`KakuyomuParser.buildSearchUrl` により生成された URL を `httpClient` 経由で取得し、`searchNovels` でパースされた作品一覧がカード形式で表示されること。                                       |
| **`AC-SE-03`** | 並び順の切り替え                    | フィルタバーの並び順（週間ランキング順、累計ランキング順、更新順、新作順）を選択すると、即座に対応するパラメータ（`order`）で再検索され、一覧が更新されること（デフォルトは週間ランキング順）。                                          |
| **`AC-SE-04`** | 連載状態・ジャンル絞り込み          | 連載状態ピル（すべて、連載中、完結済）およびジャンルピル（すべて、異世界ファンタジー、現代ファンタジー等12種）の選択により、絞り込み再検索が実行されること。                                                                             |
| **`AC-SE-05`** | 作品カードメタデータ描画            | 各作品カードに、タイトル、著者名、ジャンルバッジ、連載状態バッジ、あらすじ抜粋、話数、総文字数、★ポイント数、タグラベルが欠損なく描画されること。                                                                                        |
| **`AC-SE-06`** | カード内「＋ 本棚に追加」その場登録 | カードの「＋ 本棚に追加」ボタンを押下すると、画面遷移せずにボタンがローディング表示となり、バックグラウンドで作品トップ HTML 取得 ＆ 目次パース ＆ SQLite 保存（`upsertNovelWithToc`）が行われ、成功時に「✓ 登録済み」へ切り替わること。 |
| **`AC-SE-07`** | カード本体タップ時の導線            | 登録済みカードをタップしたときは直ちにその作品の目次画面（`SCR-02`）へ遷移し、未登録カードをタップしたときは自動で「本棚に追加」を実行した上で完了後に目次画面へ遷移すること。                                                           |
| **`AC-SE-08`** | 次ページ読み込み                    | 検索結果が20件以上あり `hasNextPage` が true の場合、最下部の「次へ」ボタン押下で次ページの作品が追加読み込み（またはページ切り替え）されること。                                                                                        |

---

## 6. テスト責務・カバレッジ計画

- **単体テスト (`SearchPage.test.tsx`, `SearchNovelCard.test.tsx`, `useNovelSearch.test.ts`)**:
  - `docs/guidelines/testing.md` に従い、全分岐（C0/C1 100%）およびアクセシビリティ（role, aria 属性）を検証。
  - SQLite リポジトリとの連携テストは `resetTestDb()` を使用して決定論的に実行。
- **Storybook ＆ VRT (1280px / 375px)**:
  - キーワード未入力初期状態、検索結果一覧表示状態、追加処理中状態、登録済み状態、空状態（0件）、通信エラー状態の各ストーリーを作成し VRT 検証を実施。
