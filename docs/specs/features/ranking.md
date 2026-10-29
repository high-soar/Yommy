---
type: spec-feature
title: "ランキング画面仕様書（SCR-07: Novel Ranking）"
description: "複数小説サイト（v0.3はカクヨム）のランキング一覧（期間×総合/主要ジャンル）、順位バッジ表示、作品カード一覧およびその場での本棚追加を提供するランキング画面（SCR-07）の正本仕様。"
status: Approved
updated: "2026-10-30"
tags:
  - ranking
  - scr-07
  - kakuyomu
  - period
  - genre
  - ui
  - shell
  - bottom-nav
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/search.md
  - docs/specs/features/novel-detail.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
related_tests:
  - src/App.test.tsx
  - src/app/router.test.tsx
  - src/features/ranking/components/RankingPage.test.tsx
  - src/features/ranking/hooks/useNovelRanking.test.ts
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
  - test/it/smoke.spec.ts
---

# ランキング画面仕様書（SCR-07）

本ドキュメントは、Yommy の人気作品ランキング一覧を提供する **ランキング画面（`SCR-07`: ルート `/ranking`）** の画面構成、Presentational / Container コンポーネント契約、`useNovelRanking` カスタムフック契約、および受入条件（`AC-RK-xx`）を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: ランキング画面（`SCR-07`、ルートパス `/ranking`）
- **対応要件**:
  - `SYS-REQ-18`（カクヨムランキング機能：期間4種 × 総合/主要12ジャンル、長編ランキング、順位バッジ表示）
  - `SYS-REQ-19`（ランキング結果カードからの本棚ワンタップ即時登録および作品詳細遷移）
  - `SYS-REQ-20`（下部4タブナビゲーションおよびOSバックキー論理階層遷移）
- **関連画面遷移**:
  - `TR-01`（下部タブバーによる 4 画面「本棚 `/`」「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」相互切替）
  - `TR-12`（ランキング画面上での OS バックキー操作によるホーム「本棚 `SCR-01` `/`」への復帰）
  - `TR-14`（ランキング結果カード本体タップによる作品詳細・目次画面 `SCR-02` `/novels/:novelId` への遷移）
- **対象外スコープ（Milestone `v0.4` 以降）**:
  - 小説家になろう（`narou`）のランキング実装
  - 短編ランキング（`work_variation=short`）への明示的切替UI（v0.3 ではカクヨム標準の長編 `long` 固定）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/ranking/` 配下を以下のモジュール構成とします。

```text
src/features/ranking/
├── components/
│   ├── SiteSelector.tsx              # 対象サイト切替ピル（カクヨム / 将来のなろう）
│   ├── SiteSelector.stories.tsx
│   ├── SiteSelector.test.tsx
│   ├── RankingFilterBar.tsx          # 集計期間切替（4種）およびジャンル切替横スクロールピル（総合＋主要12ジャンル）
│   ├── RankingFilterBar.stories.tsx
│   ├── RankingFilterBar.test.tsx
│   ├── RankingNovelCard.tsx          # 順位バッジ付き作品カード（「＋ 本棚に追加」ボタン配置）
│   ├── RankingNovelCard.stories.tsx
│   ├── RankingNovelCard.test.tsx
│   ├── RankingPage.tsx               # ランキング画面 Presentational レイアウト統合
│   ├── RankingPage.stories.tsx
│   ├── RankingPage.test.tsx
│   ├── RankingContainer.tsx          # useNovelRanking / useRouter 接続 Container
│   ├── RankingContainer.stories.tsx
│   └── RankingContainer.test.tsx
├── hooks/
│   ├── useNovelRanking.ts            # ランキング状態管理・HTTP取得・DB登録カスタムフック
│   └── useNovelRanking.test.ts
└── types.ts                          # ランキング画面固有の UI 型定義
```

---

## 3. UI・Presentational コンポーネント契約

### 3.1 `RankingPageProps`

```typescript
export interface RankingPageProps {
  /** 選択中サイト識別子 */
  selectedSite: NovelSiteType;
  /** サイト変更コールバック */
  onSelectSite: (site: NovelSiteType) => void;
  /** 選択中集計期間 */
  selectedPeriod: NovelRankingPeriod;
  /** 集計期間変更コールバック */
  onSelectPeriod: (period: NovelRankingPeriod) => void;
  /** 選択中ジャンル（総合時は undefined または "all"） */
  selectedGenre?: string;
  /** ジャンル変更コールバック */
  onSelectGenre: (genre?: string) => void;
  /** ランキング作品リスト（順位昇順） */
  items: NovelRankingResultItem[];
  /** 登録済み作品 ID（remoteWorkId）のセット */
  registeredWorkIds: Set<string>;
  /** 現在追加処理中の remoteWorkId（処理中でない場合 null） */
  addingWorkId: string | null;
  /** 通信中フラグ */
  isLoading: boolean;
  /** エラーメッセージ（エラーがない場合 null） */
  error: string | null;
  /** エラー再試行コールバック */
  onRetry: () => void;
  /** カード内「＋ 本棚に追加」ボタン押下時のコールバック */
  onAddNovel: (item: NovelRankingResultItem) => void | Promise<void>;
  /** カード本体タップ時のコールバック */
  onSelectCard: (item: NovelRankingResultItem) => void;
}
```

### 3.2 `RankingNovelCardProps`

```typescript
export interface RankingNovelCardProps {
  item: NovelRankingResultItem;
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

### 3.3 `RankingFilterBarProps`

```typescript
export interface RankingFilterBarProps {
  /** 選択中集計期間 */
  selectedPeriod: NovelRankingPeriod;
  /** 集計期間変更コールバック */
  onSelectPeriod: (period: NovelRankingPeriod) => void;
  /** 選択中ジャンル（総合時は undefined または "all"） */
  selectedGenre?: string;
  /** ジャンル変更コールバック */
  onSelectGenre: (genre?: string) => void;
}
```

### 3.4 `SiteSelectorProps`

```typescript
export interface SiteSelectorProps {
  /** 選択中サイト識別子 */
  selectedSite: NovelSiteType;
  /** サイト変更コールバック */
  onSelectSite: (site: NovelSiteType) => void;
}
```

---

## 4. `useNovelRanking` カスタムフック契約

```typescript
export interface UseNovelRankingResult {
  selectedSite: NovelSiteType;
  setSelectedSite: (site: NovelSiteType) => void;
  period: NovelRankingPeriod;
  setPeriod: (period: NovelRankingPeriod) => void;
  genre: string | undefined;
  setGenre: (genre: string | undefined) => void;
  items: NovelRankingResultItem[];
  registeredWorkIds: Set<string>;
  addingWorkId: string | null;
  isLoading: boolean;
  error: string | null;
  retry: () => Promise<void>;
  addNovelToBookshelf: (item: NovelRankingResultItem) => Promise<string | null>;
  handleCardSelect: (item: NovelRankingResultItem) => Promise<void>;
}
```

---

## 5. 受入条件（Acceptance Criteria: `AC-RK-xx`）

| 受入条件 ID    | 対象項目                            | 仕様・期待動作                                                                                                                                                                                                                           |
| :------------- | :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AC-RK-01`** | 初期表示とデフォルト状態            | `/ranking` への初回アクセス時、上部に「ランキング」タイトルと「カクヨム」ピルが表示され、デフォルトで「週間」「総合（長編）」のランキングが自動取得・描画されること。                                                                    |
| **`AC-RK-02`** | 集計期間の切り替え                  | 期間タブ（日間、週間、月間、累計）の切り替えにより、即座に対応するパラメータ（`period`）でランキングが再取得され、一覧が更新されること。                                                                                                 |
| **`AC-RK-03`** | ジャンルの切り替え                  | ジャンルピル（総合、異世界ファンタジー、現代ファンタジー等12種）の選択により、該当ジャンルのランキングが再取得され、一覧が更新されること。                                                                                               |
| **`AC-RK-04`** | 順位バッジ強調表示                  | 1位〜3位の作品カードには特別スタイル（金・銀・銅をモチーフにしたアクセント表示）の順位バッジが付与され、4位以降は識別しやすい数字バッジが表示されること。                                                                                |
| **`AC-RK-05`** | ランキングカードメタデータ描画      | 各作品カードに、順位、タイトル、著者名、ジャンルバッジ、連載状態バッジ、あらすじ抜粋、話数、総文字数、★ポイント数、タグラベルが欠損なく描画されること。                                                                                  |
| **`AC-RK-06`** | カード内「＋ 本棚に追加」その場登録 | カードの「＋ 本棚に追加」ボタンを押下すると、画面遷移せずにボタンがローディング表示となり、バックグラウンドで作品トップ HTML 取得 ＆ 目次パース ＆ SQLite 保存（`upsertNovelWithToc`）が行われ、成功時に「✓ 登録済み」へ切り替わること。 |
| **`AC-RK-07`** | カード本体タップ時の導線            | 登録済みカードをタップしたときは直ちにその作品の目次画面（`SCR-02`）へ遷移し、未登録カードをタップしたときは自動で「本棚に追加」を実行した上で完了後に目次画面へ遷移すること。                                                           |

---

## 6. テスト責務・カバレッジ計画

- **単体テスト (`RankingPage.test.tsx`, `RankingNovelCard.test.tsx`, `useNovelRanking.test.ts`)**:
  - `docs/guidelines/testing.md` に従い、全分岐（C0/C1 100%）および順位バッジ・ボタン状態遷移を検証。
  - SQLite リポジトリとの連携テストは `resetTestDb()` を使用して決定論的に実行。
- **Storybook ＆ VRT (1280px / 375px)**:
  - 総合週間ランキング、1〜3位バッジ表示状態、追加処理中状態、登録済み状態、空状態、通信エラー状態の各ストーリーを作成し VRT 検証を実施。
