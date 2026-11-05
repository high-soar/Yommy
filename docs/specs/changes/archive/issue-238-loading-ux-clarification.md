---
type: spec-delta
title: "Webアクセス発生時（ランキング・検索の条件切替、リーダー未キャッシュ話遷移）のローディング状態明示UX改善仕様"
description: "Issue #238 に対する差分仕様、影響するApp全体正本、テスト計画、および実装Sub-issue分割計画。"
issue: "#238"
status: "Completed (Archived)"
updated: "2026-11-06"
tags:
  - delta
  - ranking
  - search
  - reader
  - loading-ux
  - race-condition
  - ho-30
related_specs:
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/ranking.md
  - docs/specs/features/search.md
  - docs/specs/features/reader-view.md
related_tests:
  - src/features/ranking/components/RankingPage.test.tsx
  - src/features/ranking/components/RankingFilterBar.test.tsx
  - src/features/ranking/hooks/useNovelRanking.test.ts
  - src/features/search/components/SearchPage.test.tsx
  - src/features/search/components/SearchInputBar.test.tsx
  - src/features/search/components/SearchFilterBar.test.tsx
  - src/features/search/hooks/useNovelSearch.test.ts
  - src/features/reader/components/ReaderPage.test.tsx
  - src/features/reader/components/ReaderContainer.test.tsx
  - src/features/reader/hooks/useReader.test.ts
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：Webアクセス発生時のローディング状態明示UX改善（Issue #238）

本ドキュメントは、Issue #238「`[v0.7] Webアクセス発生時（ランキング・検索の条件切替、リーダー未キャッシュ話遷移）のローディング状態明示UX改善`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **実機での低速モバイル回線における課題（`HO-30`）**:
  実機（Android）でランキング画面（`SCR-07`）の集計期間を「週間 → 月間」へ切り替えるなど、Web アクセス（HTTP 通信）が発生する操作を行った際、モバイル回線の通信速度が低下してレスポンスに時間がかかると、上部のピル（設定選択状態）だけが即座に切り替わる一方で下の作品一覧には直前の結果がそのまま表示され続け、「切り替わった結果が直前と同じ内容なのか、まだ読み込み中なのか」が判別できない UX 上の課題があった。
- **既存実装の課題調査結果**:
  以下の 3 画面において、「初回（データ 0 件時）はローディングスピナーが表示されるが、すでにデータが 1 件以上表示されている状態での再取得時はローディング状態が表示されず旧データが描画され続ける」条件分岐となっていた：
  1. **ランキング画面（`SCR-07` / `RankingPage.tsx`）**: ローディング表示条件が `isLoading && items.length === 0` となっており、期間・ジャンル・サイト切替時に既存 `items` が残ったまま通信されるため、旧ランキングが表示され続ける。また通信中のタブ・ピル連打による二重リクエストが抑止されていない。
  2. **検索画面（`SCR-06` / `SearchPage.tsx`）**: 同様に `isLoading && items.length === 0` となっており、1 度検索した後の並び順・連載状態・ジャンル・サイト切替や別キーワード再検索時に、旧検索結果が表示され続ける（次ページ追加読み込み `isLoadingMore` を除く）。また通信中の検索ボタン・フィルタピル連打が抑止されていない。
  3. **小説リーダー画面（`SCR-03` / `ReaderPage.tsx`, `useReader.ts`）**: ローディング表示条件が `isLoading && !hasBodyHtml` となっており、エピソード閲覧中（`hasBodyHtml === true`）に未キャッシュの次話・前話へ遷移（`goToChapter`）した際、オンデマンド HTTP 通信完了まで直前の話の本文が表示され続け、遷移処理中であるフィードバックが欠落している。

---

## 2. 要求仕様と設計合意事項（What）

Step 1 の `/grill-me` インタビューを通じて合意された確定仕様は以下の通りです。

### 2.1 ランキング画面（`SCR-07`）のローディング表示＆操作重複抑止仕様

1. **リスト置換方式ローディング**:
   - 集計期間（`period`）・ジャンル（`genre`）・対象サイト（`site`）の切替により再取得通信（`isLoading === true`）が発生した際、直前のランキングカード一覧（`ranking-results-list`）を画面から非表示とし、中央ローディングスピナー（`data-testid="ranking-loading"`）を明示的に表示する。
   - これにより、選択中のピル条件（例:「月間」）と画面に表示されている作品群（直前の「週間」の結果）の不整合や、旧カードの誤認・誤タップを完全に防止する。
2. **通信中操作一時無効化（重複抑止）**:
   - `isLoading === true` の間、`RankingFilterBar`（集計期間タブ・ジャンルピル）および `SiteSelector`（サイト切替ピル）に `disabled` プロパティを伝播し、視覚的に操作不可（不透明度低下・クリック無効化）とする。
   - `useNovelRanking` 内部でも `isLoading` 中の重複リクエストをガードし、非同期競合（Race Condition）を防止する。
3. **エラー表示と再試行（Retry）の振る舞い**:
   - 再取得通信が失敗した際は、直前の旧データを破棄（`items = []`）し、エラーカード（`data-testid="ranking-error"`）と「再試行する」ボタン（`data-testid="ranking-error-retry-button"`）を表示する。
   - 再試行ボタン押下時は、再び `isLoading === true` となって `ranking-loading` が表示され、成功時に新データが描画される。

---

### 2.2 検索画面（`SCR-06`）のローディング表示＆操作重複抑止仕様

1. **リスト置換方式ローディング（1ページ目）**:
   - キーワード再検索（フォーム送信）や並び順（`order`）・連載状態（`serialStatus`）・ジャンル（`genre`）・対象サイト（`site`）切替により 1 ページ目からの再検索通信（`isLoading === true`）が発生した際、直前の検索結果一覧（`search-results-list`）を非表示とし、中央ローディングスピナー（`data-testid="search-loading"`）を表示する。
2. **次ページ追加読み込み（`isLoadingMore`）の既存動作維持**:
   - 「さらに読み込む」ボタン押下による次ページ追加取得（`isLoadingMore === true`）時は、既存の作品カード一覧を維持したまま、最下部ボタン内にスピナー（「読み込み中...」）を表示する既存仕様を維持する。
3. **通信中操作一時無効化（重複抑止）**:
   - `isLoading === true` の間、`SearchInputBar` の検索実行ボタン（`data-testid="search-submit-button"`）を `disabled` とし、連打による二重検索を防止する。
   - ユーザーが文字修正や追加を行えるよう、検索テキスト入力欄（`data-testid="search-input"`）のフォーカスおよび文字入力は阻害せず利用可能を維持する。
   - `SearchFilterBar`（並び順・連載状態・ジャンルピル）および `SiteSelector`（サイト切替）を `disabled`（操作不可）とする。
4. **エラー表示と再試行（Retry）**:
   - 1 ページ目再検索の通信失敗時は旧一覧をクリアして `search-error` を表示し、「再試行する」ボタン押下時は `search-loading` を経て再実行する。

---

### 2.3 小説リーダー画面（`SCR-03`）の未キャッシュ話遷移時ローディング表示仕様

1. **未キャッシュ話遷移時のみローディング表示（チラつき防止）**:
   - 前後エピソード遷移（`goToChapter`）や話数移動において、移動先エピソードがローカル SQLite にキャッシュ済み（`targetChapter.bodyHtml !== null` かつ 7日以内）の場合は、ローディングスピナーのチラつき（数ms）を挟まず即座に新エピソード本文を描画する。
   - 移動先エピソードが未キャッシュ（`targetChapter.bodyHtml === null`）で Web アクセス（HTTP 通信）が発生する場合のみ、直前のエピソード本文を非表示にして `data-testid="reader-loading"`（「エピソードを読み込み中...」）を明示的に表示する。
2. **通信中操作制御**:
   - `goToChapter` 実行中（`isLoading === true`）は、下部オーバーレイ（`ReaderBottomOverlay`）の前後話ナビボタンおよびシークバーを `disabled` とし、通信中の連続押下を防止する（既存仕様維持・強化）。
3. **通信失敗時のエラーハンドリング**:
   - オンデマンド取得がタイムアウトやオフライン等で失敗した場合は、エラー表示（`reader-error`）が行われ、オーバーレイが自動展開されて目次復帰や再操作が可能となる。

---

### 2.4 Android 実機検証判断（実施タイミング）

- **判定**: **`B. Milestone 最終レビュー後に一括で実機検証を実施`**
  - **理由**:
    - 本 Issue は純粋な React UI コンポーネントおよびカスタムフック（状態管理）の変更であり、ネイティブ Java コードや Capacitor プラグイン、ハードウェアキー等の変更を含まない。
    - Vitest（C0/C1/Functions 100%）、Storybook VRT（1280px / 375px）、および Playwright 実ブラウザ IT（`SCN-01`, `SCN-02`）によって回帰・状態遷移を 100% 自動担保可能である。
    - 低速モバイル回線下での実際の操作体感確認（`HO-30`）は、Milestone `v0.7` の Step 2 指摘是正 PR マージ直後に、なろう対応（`HO-29`）とあわせて **「Android 実機検証試験項目表」** に基づき一括実施する。
  - **`HO-30` 完了ゲート**: `Milestone v0.7 完了前`

---

## 3. 影響を受ける App 全体正本（Single Source of Truth）一覧

| 正本ファイルパス                       | 変更内容概要                                                                                                                                                                                                   |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/features/ranking.md`       | `status: "Review (#238)"` に更新。`RankingFilterBarProps` / `SiteSelectorProps` への `disabled` 追加。`RankingPage` の排他描画順（`isLoading` 優先）および受入条件 `AC-RK-02`, `AC-RK-03`, `AC-RK-08` を定義。 |
| `docs/specs/features/search.md`        | `status: "Review (#238)"` に更新。`SearchInputBarProps`（`isLoading`）および `SearchFilterBarProps`（`disabled`）の拡張。`SearchPage` の排他描画順および受入条件 `AC-SE-03`, `AC-SE-04`, `AC-SE-09` を定義。   |
| `docs/specs/features/reader-view.md`   | `status: "Review (#238)"` に更新。未キャッシュ話遷移時のローディング表示仕様および受入条件 `AC-RD-06`, `AC-RD-28` を定義。                                                                                     |
| `docs/quality/bug-and-handover-log.md` | 申し送り事項一覧に `HO-29`（なろう対応）および `HO-30`（WebアクセスローディングUX）を登録。                                                                                                                    |
| `docs/index.md`                        | 進行中差分仕様として本ドキュメントを追加。                                                                                                                                                                     |

---

## 4. 受入条件（Acceptance Criteria）の差分定義

### 4.1 ランキング画面受入条件（`AC-RK-xx`）

| AC ID          | 対象項目                                       | 仕様・期待動作                                                                                                                                                                                                                                                                                              |
| :------------- | :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AC-RK-02`** | 集計期間の切り替え（更新）                     | 期間タブ（日間、週間、月間、累計）の切り替えにより、即座に対応するパラメータ（`period`）でランキング再取得が開始され、**旧一覧が非表示となって `ranking-loading` が表示され**、通信完了後に一覧が更新されること。通信中はフィルタ操作（タブ・ピル・サイト）が無効化されること。                             |
| **`AC-RK-03`** | ジャンルの切り替え（更新）                     | ジャンルピルの選択により、即座に対応するパラメータ（`genre`）でランキング再取得が開始され、**旧一覧が非表示となって `ranking-loading` が表示され**、通信完了後に一覧が更新されること。通信中はフィルタ操作が無効化されること。                                                                              |
| **`AC-RK-08`** | 再取得時ローディング表示と操作重複抑止（新規） | ランキング再取得通信中（`isLoading === true`）は、**直前のランキングカード一覧を画面からクリアし中央にローディングスピナー（`data-testid="ranking-loading"`）を明示すること**。また通信中は期間タブ・ジャンルピル・サイトセレクタが操作不能（`disabled`）となり二重リクエストや非同期競合が抑止されること。 |

### 4.2 検索画面受入条件（`AC-SE-xx`）

| AC ID          | 対象項目                                       | 仕様・期待動作                                                                                                                                                                                                                                                                                                                            |
| :------------- | :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AC-SE-03`** | 並び順の切り替え（更新）                       | フィルタバーの並び順（`order`）を選択すると、即座に**旧検索結果一覧が非表示となって `search-loading` が表示され**、通信完了後に一覧が更新されること。通信中はフィルタバーおよび検索ボタンが操作不能（`disabled`）となること。                                                                                                             |
| **`AC-SE-04`** | 連載状態・ジャンル絞り込み（更新）             | 連載状態ピルおよびジャンルピルの選択により、即座に**旧検索結果一覧が非表示となって `search-loading` が表示され**、絞り込み再検索が実行されること。通信中はフィルタバーおよび検索ボタンが操作不能となること。                                                                                                                              |
| **`AC-SE-09`** | 再検索時ローディング表示と操作重複抑止（新規） | キーワード再検索や並び順・連載状態・ジャンル・サイト切替による 1 ページ目再取得中（`isLoading === true`）は、**直前の検索結果一覧を画面からクリアし中央にローディングスピナー（`data-testid="search-loading"`）を表示すること**。通信中は検索実行ボタン・フィルタバー・サイトセレクタが操作不能となり、テキスト入力は可能を維持すること。 |

### 4.3 小説リーダー画面受入条件（`AC-RD-xx`）

| AC ID          | 対象項目                                       | 仕様・期待動作                                                                                                                                                                                                                                                                                                         |
| :------------- | :--------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AC-RD-06`** | 前後エピソード連続遷移（更新）                 | `ReaderBottomOverlay` 内のボタンや端ジェスチャー等でエピソード遷移（`goToChapter`）した際、**キャッシュ済みの話への遷移はスピナーを挟まず即座に本文が切り替わり、未キャッシュ話への遷移時（オンデマンド Web 通信発生時）は直前の本文を非表示にして `reader-loading` が明示され、取得完了後に新本文が描画されること**。 |
| **`AC-RD-28`** | 未キャッシュ話遷移時のローディング明示（新規） | 前後エピソード遷移において、対象エピソードがローカル未キャッシュ（`bodyHtml === null`）で Web アクセスが発生する際、直前のエピソード本文を画面上に残留させず `data-testid="reader-loading"` を明示的に表示すること。通信完了時に新エピソード本文へ切り替わり、通信失敗時は `reader-error` が表示されること。           |

---

## 5. UI・Presentational コンポーネントおよびフック契約の変更

### 5.1 ランキングコンポーネント契約の変更

```typescript
// src/features/ranking/components/RankingFilterBar.tsx
export interface RankingFilterBarProps {
  selectedPeriod: NovelRankingPeriod;
  onSelectPeriod: (period: NovelRankingPeriod) => void;
  selectedGenre?: string;
  onSelectGenre: (genre?: string) => void;
  /** 通信中操作抑止フラグ（省略時は false） */
  disabled?: boolean;
}

// src/features/ranking/components/SiteSelector.tsx
export interface SiteSelectorProps {
  selectedSite: NovelSiteType;
  onSelectSite: (site: NovelSiteType) => void;
  /** 通信中操作抑止フラグ（省略時は false） */
  disabled?: boolean;
}

// src/features/ranking/components/RankingPage.tsx
// 描画優先順位の是正:
// 1. error !== null -> ranking-error
// 2. isLoading === true -> ranking-loading（items.length に依存せず常に最優先でスピナー描画）
// 3. !isLoading && !error && items.length === 0 -> ranking-empty-state
// 4. items.length > 0 -> ranking-results-list
```

### 5.2 検索コンポーネント契約の変更

```typescript
// src/features/search/components/SearchInputBar.tsx
export interface SearchInputBarProps {
  keyword: string;
  onChangeKeyword: (keyword: string) => void;
  onSubmitSearch: () => void;
  /** 検索通信中フラグ（true時は検索ボタン無効化、テキスト入力はフォーカス・入力可能維持） */
  isLoading?: boolean;
}

// src/features/search/components/SearchFilterBar.tsx
export interface SearchFilterBarProps {
  selectedOrder: NovelSearchOrder;
  onSelectOrder: (order: NovelSearchOrder) => void;
  selectedSerialStatus: NovelSerialStatus;
  onSelectSerialStatus: (status: NovelSerialStatus) => void;
  selectedGenre?: string;
  onSelectGenre: (genre?: string) => void;
  /** 通信中操作抑止フラグ（省略時は false） */
  disabled?: boolean;
}

// src/features/search/components/SearchPage.tsx
// 描画優先順位の是正:
// 1. error !== null -> search-error
// 2. isLoading === true -> search-loading（1ページ目再取得時は items.length に依存せず最優先でスピナー描画）
// 3. !isLoading && !error && !hasSearched -> search-initial-state
// 4. !isLoading && !error && hasSearched && items.length === 0 -> search-empty-state
// 5. items.length > 0 -> search-results-list（isLoadingMore === true 時は下部ボタンのみスピナー表示）
```

### 5.3 リーダーコンポーネントおよびフック契約の変更

```typescript
// src/features/reader/hooks/useReader.ts
// goToChapter 内部での未キャッシュ話遷移時ローディング制御:
// 対象話（targetChapter）取得後、未キャッシュ（targetChapter.bodyHtml === null）の場合は
// resolveChapterBody の HTTP 通信開始前に chapter を未キャッシュ状態へ設定（または即座に本文をリセット）し、
// ReaderPage 側の loading 条件と連動して reader-loading を明示表示する。
// キャッシュ済みの場合は即座に本文が利用可能なため、スピナーのチラつきなしで瞬時に切り替える。

// src/features/reader/components/ReaderPage.tsx
// 描画優先順位:
// 1. error !== null -> reader-error
// 2. (isLoading && !hasBodyHtml) -> reader-loading
// 3. (!hasNovel || !chapter || chapter.bodyHtml === null) -> reader-empty
// 4. ReaderView（本文表示）
```

---

## 6. テスト計画

### 6.1 単体テスト（Vitest TDD / C0・C1・Functions 100%）

- **ランキング画面 (`RankingPage.test.tsx`, `RankingFilterBar.test.tsx`, `useNovelRanking.test.ts`)**:
  - `isLoading === true` かつ既存 `items.length > 0` の状態で `ranking-loading` が描画され、`ranking-results-list` が非表示となることを検証。
  - `isLoading === true` 時に `RankingFilterBar` の全タブ・ピルおよび `SiteSelector` のボタンが `disabled`（クリックイベントが発火しない）となることを検証。
  - `error` 発生時に `ranking-error` が表示され `items` がクリアされること、および `onRetry` 押下で `isLoading` を経て再取得されることを検証。
- **検索画面 (`SearchPage.test.tsx`, `SearchInputBar.test.tsx`, `SearchFilterBar.test.tsx`, `useNovelSearch.test.ts`)**:
  - `isLoading === true` かつ既存 `items.length > 0` の状態で `search-loading` が描画され、旧リストが非表示となることを検証。
  - `isLoading === true` 時に検索ボタンが `disabled` となり、テキスト入力欄は入力可能（`disabled` にならない）であることを検証。
  - `isLoadingMore === true` のときは既存 `search-results-list` が維持され、`search-load-more-button` がスピナー状態となることを検証。
- **小説リーダー画面 (`ReaderPage.test.tsx`, `useReader.test.ts`)**:
  - エピソード閲覧中から未キャッシュ話への遷移時（`goToChapter` で HTTP 通信発生中）、旧本文が消去されて `reader-loading` が表示されることを検証。
  - キャッシュ済みの話への遷移時、`reader-loading` が表示されずに即座に次話本文へ切り替わることを検証。
  - 通信エラー発生時に `reader-error` が表示されることを検証。

### 6.2 Storybook ＆ VRT（1280px / 375px）

- `RankingPage.stories.tsx`: `LoadingWithItems`（旧データが存在する状態でのローディング）ストーリーの追加・更新。
- `RankingFilterBar.stories.tsx`: `Disabled` ストーリーの追加・更新。
- `SearchPage.stories.tsx`: `LoadingWithItems` ストーリーの追加・更新。
- `SearchInputBar.stories.tsx` / `SearchFilterBar.stories.tsx`: `Disabled` / `Loading` ストーリーの追加・更新。
- `ReaderPage.stories.tsx`: `TransitionLoading`（話数遷移中ローディング）ストーリーの検証。

### 6.3 結合テスト（Playwright IT / 全件 100% PASS）

- `SCN-02`（検索・ランキング探索シナリオ）:
  - ランキングの集計期間切替時およびジャンル切替時に、旧リストが一瞬クリアされて `ranking-loading` が表示され、新リストへ更新される一連の挙動を検証。
  - 検索画面でのキーワード再検索およびフィルタ切替時にも同様に `search-loading` を経て更新されることを検証。
- `SCN-01`（リーダー閲覧シナリオ）:
  - 前後話遷移において、未キャッシュ話へのオンデマンド取得中にローディング表示を経て新話数が表示されるフローを検証。

---

## 7. 実装 Sub-issue 分割構成

合意された 2 分割構成に基づき、以下の Sub-issue を起票して順次 TDD 実装を進めます。

| Sub-issue | 種別 | 対象コンポーネント・モジュール                                                                     | 完了ゲート / マージ方針                  |
| :-------- | :--- | :------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| **MK1**   | 実装 | ランキング画面（`SCR-07`）・検索画面（`SCR-06`）のローディング表示 ＆ 操作重複抑止改善             | Task Completion Gate 1〜6 → AI自律マージ |
| **MK2**   | 実装 | 小説リーダー画面（`SCR-03`）の未キャッシュ話遷移時ローディング表示改善                             | Task Completion Gate 1〜6 → AI自律マージ |
| **IT**    | 結合 | Playwright 結合テスト（`SCN-01`, `SCN-02`）の回帰更新 ＆ 差分仕様アーカイブ（親 Issue クローズPR） | Task Completion Gate 1〜6 → 人間マージ   |

---

## 8. 申し送り事項（Handover Items）

| 申し送り ID | 起因 Issue | 申し送り内容                                                                                                                                 | 確認場所 / 解決先                | 完了ゲート              | ステータス |
| :---------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------- | :---------------------- | :--------- |
| **`HO-30`** | Issue #238 | Android 実機での低速モバイル回線下におけるランキング・検索の条件切替、およびリーダー未キャッシュ話遷移時のローディング表示 UX の実機体感確認 | Milestone `v0.7` 実機検証 / #241 | Milestone `v0.7` 完了前 | `Open`     |
