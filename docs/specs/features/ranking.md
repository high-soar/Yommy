---
type: spec-feature
title: "ランキング画面仕様書（SCR-07: Novel Ranking）"
description: "複数小説サイト（カクヨム・小説家になろう）のサイト切替、ランキング一覧（期間×作品種別×総合/サイト別主要ジャンル）、順位バッジ表示、作品カード一覧およびその場での本棚追加を提供するランキング画面（SCR-07）の正本仕様。"
status: "Review (#265)"
updated: "2026-11-07"
tags:
  - ranking
  - scr-07
  - kakuyomu
  - narou
  - site-selector
  - multi-page-toc
  - period
  - work-variation
  - short-story
  - genre
  - ui
  - shell
  - bottom-nav
related_specs:
  - docs/specs/changes/issue-265-work-variation-filter.md
  - docs/specs/changes/archive/issue-240-narou-search-ranking-and-site-selector.md
  - docs/specs/changes/archive/issue-239-narou-parser-and-multi-page-toc.md
  - docs/specs/parsers/narou.md
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/search.md
  - docs/specs/features/novel-detail.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/archive/issue-238-loading-ux-clarification.md
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
related_tests:
  - src/App.test.tsx
  - src/app/router.test.tsx
  - src/features/ranking/components/SiteSelector.test.tsx
  - src/features/ranking/components/RankingFilterBar.test.tsx
  - src/features/ranking/components/RankingNovelCard.test.tsx
  - src/features/ranking/components/RankingPage.test.tsx
  - src/features/ranking/components/RankingContainer.test.tsx
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
  - `SYS-REQ-18`（マルチサイトランキング機能：カクヨム・小説家になろうのサイト切替、期間4種 × 作品種別3種［すべて / 長編・連載 / 短編］× 総合/サイト別ジャンル、順位バッジ表示、期間ポイント表示）
  - `SYS-REQ-19`（ランキング結果カードからの本棚ワンタップ即時登録および作品詳細遷移）
  - `SYS-REQ-20`（下部4タブナビゲーションおよびOSバックキー論理階層遷移）
- **関連画面遷移**:
  - `TR-01`（下部タブバーによる 4 画面「本棚 `/`」「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」相互切替）
  - `TR-12`（ランキング画面上での OS バックキー操作によるホーム「本棚 `SCR-01` `/`」への復帰）
  - `TR-14`（ランキング結果カード本体タップによる作品詳細・目次画面 `SCR-02` `/novels/:novelId` への遷移）
- **対象外スコープ**:
  - 複数サイトを横断して 1 つのリストに混在表示する統合ランキング（サイトピルによる切り替え方式とする）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/ranking/` 配下を以下のモジュール構成とします。

```text
src/features/ranking/
├── components/
│   ├── SiteSelector.tsx              # 対象サイト切替ピル（カクヨム / 小説家になろう）
│   ├── SiteSelector.stories.tsx
│   ├── SiteSelector.test.tsx
│   ├── RankingFilterBar.tsx          # 集計期間切替（4種）・作品種別切替（3種）およびサイト別ジャンル切替横スクロールピル
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
  /** 選択中作品種別（すべて / 長編・連載 / 短編、省略時は "long"、v0.8 Issue #265） */
  selectedWorkVariation?: NovelRankingWorkVariation;
  /** 作品種別変更コールバック（v0.8 Issue #265） */
  onSelectWorkVariation?: (workVariation: NovelRankingWorkVariation) => void;
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
  /** 選択中サイト識別子（サイト別ジャンルピル切替用、省略時は "kakuyomu"、v0.7 Issue #240） */
  selectedSite?: NovelSiteType;
  /** 選択中集計期間 */
  selectedPeriod: NovelRankingPeriod;
  /** 集計期間変更コールバック */
  onSelectPeriod: (period: NovelRankingPeriod) => void;
  /** 選択中作品種別（すべて / 長編・連載 / 短編、省略時は "long"、v0.8 Issue #265） */
  selectedWorkVariation?: NovelRankingWorkVariation;
  /** 作品種別変更コールバック（v0.8 Issue #265） */
  onSelectWorkVariation?: (workVariation: NovelRankingWorkVariation) => void;
  /** 選択中ジャンル（総合時は undefined または "all"） */
  selectedGenre?: string;
  /** ジャンル変更コールバック */
  onSelectGenre: (genre?: string) => void;
  /** 通信中操作抑止フラグ（省略時は false、v0.7 Issue #238） */
  disabled?: boolean;
}
```

- 上段左側に集計期間セグメントピル（`role="group" aria-label="集計期間"`, `data-testid="ranking-period-{daily|weekly|monthly|entire}"`）、上段右側に作品種別セグメントピル（`role="group" aria-label="作品種別"`, `data-testid="ranking-variation-{all|long|short}"`）を横並び配置し、下段にジャンル横スクロールピル（`role="group" aria-label="ジャンル"`）を配置する（v0.8 Issue #265）。

### 3.4 `SiteSelectorProps`

```typescript
export interface SiteSelectorProps {
  /** 選択中サイト識別子 */
  selectedSite: NovelSiteType;
  /** サイト変更コールバック */
  onSelectSite: (site: NovelSiteType) => void;
  /** 通信中操作抑止フラグ（省略時は false、v0.7 Issue #238） */
  disabled?: boolean;
}
```

### 3.5 `RankingContainerProps`

```typescript
export interface RankingContainerProps {
  /** 作品カード本体タップ時の遷移コールバック（省略時は useNovelRanking().handleCardSelect を使用） */
  onSelectNovel?: (novelId: string) => void;
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
  workVariation: NovelRankingWorkVariation;
  setWorkVariation: (workVariation: NovelRankingWorkVariation) => void;
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

| 受入条件 ID    | 対象項目                               | 仕様・期待動作                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 関連要件 / 遷移            |
| :------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------- |
| **`AC-RK-01`** | 初期表示とデフォルト状態               | `/ranking` への初回アクセス時、上部に「ランキング」タイトルと対象サイトピル（「カクヨム」「小説家になろう」、双方選択可能、デフォルトは「カクヨム」）が表示され、デフォルトで「週間」「長編・連載（`long`）」「総合」のランキングが自動取得・描画されること。                                                                                                                                                                                                                               | `SYS-REQ-18, 20` / `TR-01` |
| **`AC-RK-02`** | 集計期間の切り替え                     | 期間タブ（日間、週間、月間、累計）の切り替えにより、即座に対応するパラメータ（`period`）でランキング再取得が開始され、旧一覧が非表示となって `ranking-loading` が表示され、通信完了後に一覧が更新されること。通信中はフィルタ操作（タブ・ピル・サイト）が無効化されること（v0.7 Issue #238）。                                                                                                                                                                                              | `SYS-REQ-18`               |
| **`AC-RK-03`** | サイト別ジャンルの切り替え             | サイト別ジャンルピル（総合、およびカクヨム選択時は主要12種／なろう選択時は公式小ジャンル21種）の選択により、該当ジャンルのランキング再取得が開始され、旧一覧が非表示となって `ranking-loading` が表示され、通信完了後に一覧が更新されること。通信中はフィルタ操作が無効化されること（v0.7 Issue #238, #240）。                                                                                                                                                                              | `SYS-REQ-18`               |
| **`AC-RK-04`** | 順位バッジ強調表示                     | 1位〜3位の作品カードには特別スタイル（金・銀・銅をモチーフにしたアクセント表示）の順位バッジが付与され、4位以降は識別しやすい数字バッジが表示されること。                                                                                                                                                                                                                                                                                                                                   | `SYS-REQ-18`               |
| **`AC-RK-05`** | ランキングカードメタデータ描画         | 各作品カードに、順位、タイトル、著者名、ジャンルバッジ、連載状態バッジ（連載中 / 完結済 / 短編）、あらすじ抜粋、話数、総文字数、★ポイント数（なろうは選択期間に応じた期間ポイント）、タグラベルが欠損なく描画されること。                                                                                                                                                                                                                                                                   | `SYS-REQ-18`               |
| **`AC-RK-06`** | カード内「＋ 本棚に追加」その場登録    | カードの「＋ 本棚に追加」ボタンを押下すると、画面遷移せずにボタンがローディング表示となり、バックグラウンドで `fetchFullNovelIndex`（`nextTocPageUrl` による複数ページ目次連続取得対応、Issue #239）および SQLite 保存（`upsertNovelWithToc`）が行われ、成功時に「✓ 登録済み」へ切り替わり `syncEngine.notifyChanged()` による自動 Push がトリガーされること（R1-26）。                                                                                                                     | `SYS-REQ-19` / `TR-14`     |
| **`AC-RK-07`** | カード本体タップ時の導線               | 登録済みカードをタップしたときは直ちにその作品の目次画面（`SCR-02`）へ遷移し、未登録カードをタップしたときは自動で「本棚に追加」を実行した上で完了後に目次画面へ遷移すること。                                                                                                                                                                                                                                                                                                              | `SYS-REQ-19` / `TR-14`     |
| **`AC-RK-08`** | 再取得時ローディング表示と操作重複抑止 | ランキング再取得通信中（`isLoading === true`）は、直前のランキングカード一覧を画面からクリアし中央にローディングスピナー（`data-testid="ranking-loading"`）を明示すること。また通信中は期間タブ・作品種別ピル・ジャンルピル・サイトセレクタが操作不能（`disabled`）となり二重リクエストや非同期競合（世代カウンタ `requestIdRef`）が抑止されること。通信エラー時はエラー表示（`ranking-error`）および再試行ボタンが提供され、旧データは残留しないこと（v0.7 Issue #238、v0.8 Issue #265）。 | `SYS-REQ-18`               |
| **`AC-RK-09`** | サイト切替と条件・登録済み状態連動     | `SiteSelector` で「カクヨム ⇔ 小説家になろう」を切り替えた際、集計期間（`period`）および作品種別（`workVariation`）は保持しつつサイト固有のジャンル選択のみ「総合（`undefined`）」にリセットされ、ジャンルピル一覧が切替後サイトの定義に切り替わり、直ちに新サイト（`KakuyomuParser` または `NarouParser`）でランキング自動再取得が走るとともに `registeredWorkIds` が切替後サイトの登録済み作品セットへ更新されること（v0.7 Issue #240、v0.8 Issue #265）。                                | `SYS-REQ-18, 19`           |
| **`AC-RK-10`** | 作品種別（長編/連載・短編）の切り替え  | `RankingFilterBar` 上段の作品種別ピル（すべて `all` / 長編・連載 `long` / 短編 `short`、`data-testid="ranking-variation-{all                                                                                                                                                                                                                                                                                                                                                                | long                       | short}"`）の選択により、カクヨムでは `work_variation=all | long | short`、小説家になろうでは `type`省略 /`type=re`（全連載） / `type=t`（短編）でランキング再取得が開始され、旧一覧クリア・`ranking-loading` 明示・完了後の一覧更新が行われること（v0.8 Issue #265）。 | `SYS-REQ-18` |

---

## 6. テスト責務・カバレッジ計画

- **単体テスト (`SiteSelector.test.tsx`, `RankingFilterBar.test.tsx`, `RankingNovelCard.test.tsx`, `RankingPage.test.tsx`, `RankingContainer.test.tsx`, `useNovelRanking.test.ts`)**:
  - `docs/guidelines/testing.md` に従い、全分岐（C0/C1 100%）および順位バッジ・ボタン状態遷移を検証。
  - SQLite リポジトリとの連携テストは `resetTestDb()` を使用して決定論的に実行。
- **Storybook ＆ VRT (1280px / 375px)**:
  - 総合週間ランキング、1〜3位バッジ表示状態、追加処理中状態、登録済み状態、空状態、通信エラー状態の各ストーリーを作成し VRT 検証を実施。
- **Playwright システム結合テスト（`SCN-02`: `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`）**:
  - 本棚空状態または下部タブからのランキング画面遷移（`TR-01`, `TR-15`）、期間タブ×作品種別ピル×ジャンルピル切り替え、1〜3位強調順位バッジ表示（`AC-RK-01`〜`05`, `10`）、カード内「＋ 本棚に追加」その場登録（`AC-RK-06`）、およびカード本体タップによる作品詳細（`SCR-02`）遷移と OS バックキーによるランキング画面への論理復帰（`TR-14`, `TR-07`, `AC-RK-07`）を一気通貫で検証。
