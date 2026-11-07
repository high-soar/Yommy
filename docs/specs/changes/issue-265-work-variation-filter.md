---
type: spec-delta
title: "ランキング・検索画面（SCR-07 / SCR-06）における作品種別（長編/連載・短編）フィルタ切替対応の設計"
description: "Issue #265 に対する差分仕様、カクヨム・小説家になろうの作品種別ランキング/検索URL生成仕様、ランキング画面の作品種別セグメントピルおよび検索画面の短編ピル追加設計、テスト計画、およびSub-issue分割計画。"
issue: "#265"
status: "Review (#265)"
updated: "2026-11-07"
tags:
  - delta
  - ranking
  - search
  - scr-07
  - scr-06
  - parser
  - kakuyomu
  - narou
  - syosetu
  - work-variation
  - short-story
  - filtering
related_specs:
  - docs/specs/features/ranking.md
  - docs/specs/features/search.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/parsers/narou.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/quality/bug-and-handover-log.md
related_tests:
  - src/parsers/kakuyomu/KakuyomuParser.test.ts
  - src/parsers/narou/NarouParser.test.ts
  - src/features/ranking/components/RankingFilterBar.test.tsx
  - src/features/ranking/components/RankingPage.test.tsx
  - src/features/ranking/components/RankingContainer.test.tsx
  - src/features/ranking/hooks/useNovelRanking.test.ts
  - src/features/search/components/SearchFilterBar.test.tsx
  - src/features/search/hooks/useNovelSearch.test.ts
  - src/app/ServiceProvider.test.tsx
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
---

# 差分仕様書：ランキング・検索画面（SCR-07 / SCR-06）における作品種別（長編/連載・短編）フィルタ切替対応（Issue #265）

本ドキュメントは、Issue #265「`[v0.8] ランキング・検索画面（SCR-07 / SCR-06）における作品種別（長編/連載・短編）フィルタ切替対応`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **ランキング画面（`SCR-07`）の対象外スコープ解消**:
  これまでカクヨムのランキング取得 URL は長編固定（`work_variation=long`）、小説家になろうのランキングは全作品対象（`type` 未指定）となっており、短編ランキングや全体・長編（連載）への明示的な切り替え UI が未実装であった（`docs/specs/features/ranking.md` §1 対象外スコープ）。
- **検索画面（`SCR-06`）における短編・完結済連載の明確な絞り込み**:
  検索画面の連載状況フィルタ（`NovelSerialStatus`）はこれまで「すべて (`all`) / 連載中 (`running`) / 完結済 (`completed`)」の 3 択であり、小説家になろうでは `completed` が `type=ter`（短編＋完結済連載）にマッピングされていたため、「完結済の連載作品のみ (`type=er`)」と「短編作品のみ (`type=t`)」を分けて探索することができなかった。
- **改善目的**:
  `SYS-REQ-17` および `SYS-REQ-18` を拡張し、ランキング画面に作品種別フィルタ（すべて / 長編・連載 / 短編）を新設するとともに、検索画面の連載状況フィルタを 4 択（すべて / 連載中 / 完結済 / 短編）へ拡張して、長編・連載作品と短編作品を自在に切り替えられる探索体験を実現する。

---

## 2. 仕様・設計の差分（What Changes）

Step 1 の `/grill-me` インタビューおよび既存仕様・コード調査で合意した設計差分は以下の通りです。

### 2.1 Parser Layer（`NovelRankingOptions` / `NovelSerialStatus` / `KakuyomuParser` / `NarouParser`）の拡張

[docs/specs/architecture.md](../architecture.md)、[docs/specs/parsers/kakuyomu.md](../parsers/kakuyomu.md)、および [docs/specs/parsers/narou.md](../parsers/narou.md) の型契約および URL 生成仕様を以下の通り拡張します。

1. **型契約の拡張（`src/parsers/types.ts`）**:
   ```typescript
   /** 小説検索の連載状態・作品種別（v0.8 Issue #265 で "short" を追加） */
   export type NovelSerialStatus = "all" | "running" | "completed" | "short";

   /** ランキング作品種別区分（v0.8 Issue #265） */
   export type NovelRankingWorkVariation = "all" | "long" | "short";

   export interface NovelRankingOptions {
     period?: NovelRankingPeriod;
     genre?: string;
     /** 作品種別（"all": すべて / "long": 長編・連載 / "short": 短編、v0.8 Issue #265） */
     workVariation?: NovelRankingWorkVariation;
     page?: number;
   }
   ```
2. **カクヨム ランキング URL 生成（`KakuyomuParser.buildRankingUrl`）**:
   - クエリパラメータ `work_variation` に `options?.workVariation ?? "long"` を設定する：
     - `"all"` → `work_variation=all`（すべて）
     - `"long"` または未指定 → `work_variation=long`（長編：連載中または 20,000 文字以上、カクヨム公式標準）
     - `"short"` → `work_variation=short`（短編）
3. **小説家になろう ランキング URL 生成（`NarouParser.buildRankingUrl`）**:
   - `options?.workVariation` に応じて公式 API の `type` パラメータを設定する：
     - `"all"` または未指定 → `type` パラメータを省略（すべての作品を対象）
     - `"long"`（長編・連載）→ `type=re`（連載中 `r` ＋ 完結済連載 `er` の全連載作品を対象）
     - `"short"`（短編）→ `type=t`（短編のみを対象）
4. **小説家になろう 検索 URL 生成（`NarouParser.buildSearchUrl`）**:
   - `options?.serialStatus` に応じて公式 API の `type` パラメータを以下の 4 区分で設定する：
     - `"all"` または未指定 → `type` パラメータを省略（すべての作品）
     - `"running"`（連載中）→ `type=r`（連載中の作品のみ）
     - `"completed"`（完結済）→ `type=er`（完結済の連載作品のみ ※短編が `"short"` として独立したため `ter` から `er` へ分離）
     - `"short"`（短編）→ `type=t`（短編作品のみ）
5. **カクヨム 検索 URL 生成（`KakuyomuParser.buildSearchUrl`）**:
   - `options?.serialStatus` に応じて `serial_status` パラメータを設定する：
     - `"all"` または未指定 → `serial_status` を省略
     - `"running"`（連載中）→ `serial_status=running`
     - `"completed"`（完結済）または `"short"`（短編）→ `serial_status=completed`（カクヨム Web 検索では短編も完結済作品として扱われるため `completed` にマッピング）

### 2.2 ランキング画面（`SCR-07`）の作品種別フィルタ UI と状態管理（`useNovelRanking`）

[docs/specs/features/ranking.md](../features/ranking.md) のコンポーネントおよびカスタムフック契約を以下の通り拡張します。

1. **作品種別定数定義（`src/features/ranking/types.ts`）**:
   ```typescript
   export interface RankingWorkVariationOption {
     value: NovelRankingWorkVariation;
     label: string;
   }

   export const RANKING_WORK_VARIATIONS: readonly RankingWorkVariationOption[] =
     [
       { value: "all", label: "すべて" },
       { value: "long", label: "長編・連載" },
       { value: "short", label: "短編" },
     ] as const;
   ```
2. **`RankingFilterBar`（上段右側への作品種別セグメントピル配置）**:
   - **Props 拡張（`RankingFilterBarProps`）**:
     ```typescript
     export interface RankingFilterBarProps {
       selectedSite?: NovelSiteType;
       selectedPeriod: NovelRankingPeriod;
       onSelectPeriod: (period: NovelRankingPeriod) => void;
       /** 選択中作品種別（省略時は "long"、v0.8 Issue #265） */
       selectedWorkVariation?: NovelRankingWorkVariation;
       /** 作品種別変更コールバック（v0.8 Issue #265） */
       onSelectWorkVariation?: (
         workVariation: NovelRankingWorkVariation,
       ) => void;
       selectedGenre?: string;
       onSelectGenre: (genre?: string) => void;
       disabled?: boolean;
     }
     ```
   - **UI 構造と振る舞い**:
     - 上段 `<div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">` の左側に既存の「集計期間」ピルグループ（`role="group" aria-label="集計期間"`）、右側に **「作品種別」ピルグループ（`role="group" aria-label="作品種別"`）** を横並びで配置し、`SearchFilterBar` と統一された縦 2 段構成を維持する。
     - 各ボタンは `data-testid="ranking-variation-${opt.value}"`（`ranking-variation-all`, `ranking-variation-long`, `ranking-variation-short`）、`aria-pressed={isSelected}`、`disabled={disabled}` を持ち、押下時に `!disabled` であれば `onSelectWorkVariation?.(opt.value)` を呼び出す。
3. **`RankingPage` / `RankingContainer`**:
   - `RankingPageProps` に `selectedWorkVariation?: NovelRankingWorkVariation`（省略時 `"long"`）および `onSelectWorkVariation?: (workVariation: NovelRankingWorkVariation) => void` を追加し、`RankingFilterBar` へ透過伝播する。
   - `RankingContainer` で `useNovelRanking()` の `workVariation` と `setWorkVariation` を `RankingPage` にバインドする。
4. **`useNovelRanking` カスタムフック**:
   - **インターフェース拡張（`UseNovelRankingResult`）**:
     - `workVariation: NovelRankingWorkVariation`（初期デフォルト値: **`"long"`［長編・連載］**）および `setWorkVariation: (workVariation: NovelRankingWorkVariation) => void` を追加する。
   - **世代カウンタ（`requestIdRef`）と排他制御**:
     - `requestIdRef = useRef<number>(0)` を導入し、`executeFetch` 発火ごとにインクリメントして、万一非同期応答が前後した場合も最新リクエスト世代（`currentRequestId === requestIdRef.current`）のみが `items` / `error` / `isLoading` を更新するよう保護する。
     - `setWorkVariation(newVariation)` 呼び出し時は、通信中（`isFetchingRef.current`）は無視し、`workVariation` state を更新して直ちに `executeFetch({ workVariation: newVariation })` を発火する（通信中は旧一覧をクリアして `ranking-loading` を表示し、フィルタバー・サイトセレクタを `disabled` 化）。
   - **サイト切替連動（`setSelectedSite`）**:
     - 「カクヨム ⇔ 小説家になろう」を切り替えた際、集計期間（`period`）と同様に **選択中の作品種別（`workVariation`）もそのまま引き継ぎ**、サイト固有の `genre` のみ `undefined`（「総合」）にリセットして即時再取得する。

### 2.3 検索画面（`SCR-06`）の連載状況・作品種別ピル拡張とモックルーティング調整

1. **`SEARCH_SERIAL_STATUSES`（`src/features/search/types.ts`）の 4 択化**:
   - `SEARCH_SERIAL_STATUSES` に `{ value: "short", label: "短編" }` を追加し、4 択（すべて `all` / 連載中 `running` / 完結済 `completed` / 短編 `short`）とする。
   - `SearchFilterBar` 上段右側の `role="group" aria-label="連載状況"` 内に `data-testid="search-serial-short"` ボタンが自動描画され、選択時に `useNovelSearch().setSerialStatus("short")` が発火する（検索実行済み時は即時自動再検索、サイト切替時も `serialStatus` を保持）。
2. **`ServiceProvider.tsx`（`createDefaultMockHttpClient`）のなろう API 検索/ランキング判定の精緻化**:
   - 従来、`createDefaultMockHttpClient` では `options.url.includes("type=")` を無条件で検索（`isSearch`）と判定していたが、本 Issue よりなろうランキング（`NarouParser.buildRankingUrl`）でも `type=re`（長編・連載）や `type=t`（短編）が付与される。
   - そのため、なろう API URL（`api.syosetu.com/novelapi/api/`）において、ランキング固有の期間ポイント順（`order=dailypoint` / `order=monthlypoint`）や、検索パラメータ（`word=`, `notword=`, `order=new`, `order=generalfirstup`, `type=r`, `type=er`, `type=ter`, 複数ジャンルハイフン指定等）の有無によって検索とランキングを正確に識別し、ランキング画面で `workVariation` を切り替えた際も決定論的に `narouRankingResultsJson` が返却されるようにする。

### 2.4 影響を受ける App 全体正本ファイル一覧

| 正本ファイルパス                       | 変更内容概要                                                                                                                                             |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/features/ranking.md`       | §1 対象外スコープ解消、`RankingFilterBarProps` / `RankingPageProps` / `UseNovelRankingResult` の `workVariation` 契約追加、`AC-RK-01`, `08`〜`10` 更新。 |
| `docs/specs/features/search.md`        | `NovelSerialStatus` 4 択（すべて / 連載中 / 完結済 / 短編）の反映、`AC-SE-04` 更新。                                                                     |
| `docs/specs/parsers/kakuyomu.md`       | §5.1 `buildSearchUrl` の `serialStatus: "short"` → `completed` マッピング、§6.1 `buildRankingUrl` の `work_variation`（`all`/`long`/`short`）可変化。    |
| `docs/specs/parsers/narou.md`          | §5.1 `buildSearchUrl` の `type` 4 区分（省略 / `r` / `er` / `t`）、§6.1 `buildRankingUrl` の `type` 3 区分（省略 / `re` / `t`）、`AC-NR-11`, `13` 更新。 |
| `docs/specs/architecture.md`           | §3.3 `NovelSerialStatus` に `"short"` 追加、`NovelRankingWorkVariation` および `NovelRankingOptions.workVariation` 追加。                                |
| `docs/specs/requirements.md`           | §3.6 `SYS-REQ-17`, `SYS-REQ-18` の作品種別フィルタ切替追記、`AC-RK-10` トレーサビリティ反映、§4 ロードマップ更新。                                       |
| `docs/specs/screen-transitions.md`     | §1 `SCR-06` / `SCR-07` の作品種別フィルタ説明更新、§4 `SCN-02` の受入条件トレーサビリティ（`AC-RK-01`〜`10`）更新。                                      |
| `docs/quality/bug-and-handover-log.md` | `related_specs` に本差分仕様を追加し、`status: "Review (#265)"` に更新。                                                                                 |
| `docs/index.md`                        | ディレクトリマップに `docs/specs/changes/issue-265-work-variation-filter.md` を登録。                                                                    |

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Vitest TDD / C0・C1・Functions 100%）

1. **Parser Layer 単体テスト（`KakuyomuParser.test.ts`, `NarouParser.test.ts`）**:
   - `KakuyomuParser.buildRankingUrl`:
     - `workVariation` 未指定時および `"long"` 指定時に `work_variation=long`、`"short"` 指定時に `work_variation=short`、`"all"` 指定時に `work_variation=all` が設定されること。
   - `KakuyomuParser.buildSearchUrl`:
     - `serialStatus: "short"` 指定時に `serial_status=completed` が設定されること。
   - `NarouParser.buildRankingUrl`:
     - `workVariation` 未指定時および `"all"` 指定時に `type` パラメータが省略され、`"long"` 指定時に `type=re`、`"short"` 指定時に `type=t` が設定されること。
   - `NarouParser.buildSearchUrl`:
     - `serialStatus: "all"`（または未指定）時に `type` 省略、`"running"` 時に `type=r`、`"completed"` 時に `type=er`（完結済連載のみ）、`"short"` 時に `type=t`（短編のみ）が設定されること。
2. **Viewer Layer / Hook 単体テスト（1対1 Story/UT・親子分離）**:
   - `RankingFilterBar.test.tsx`:
     - 「作品種別」グループ（`role="group" aria-label="作品種別"`）と 3 つのピル（`ranking-variation-all`, `ranking-variation-long`, `ranking-variation-short`）の描画、`selectedWorkVariation` に応じた `aria-pressed` 状態、クリック時の `onSelectWorkVariation` 発火、`disabled=true` 時の押下抑止を検証。
   - `RankingPage.test.tsx` / `RankingContainer.test.tsx`:
     - 親子分離（`vi.spyOn`）に基づき、`selectedWorkVariation`, `onSelectWorkVariation` が `RankingFilterBar` へ正しく伝播・バインドされることを検証。
   - `useNovelRanking.test.ts`:
     - 初期状態で `workVariation === "long"` として初回ランキング取得（カクヨム `work_variation=long`）が実行されること。
     - `setWorkVariation("short")` / `setWorkVariation("all")` による再取得（カクヨム `work_variation=short|all`、なろう `type=t` / `type` 省略）、通信中ガード、世代カウンタ（`requestIdRef`）による競合防止。
     - `setSelectedSite("narou")` によるサイト切替時に `workVariation` が保持され、なろう側でも対応する `type`（初期値 `"long"` なら `type=re`）で取得されること。
   - `SearchFilterBar.test.tsx` / `useNovelSearch.test.ts`:
     - `search-serial-short`（「短編」）ピルの描画・選択時の `onSelectSerialStatus("short")` 発火、および `useNovelSearch` での `"short"` 指定検索・サイト切替時保持を検証。

### 3.2 Storybook ＆ VRT（1280px / 375px）

- `RankingFilterBar.stories.tsx`, `RankingPage.stories.tsx`, `SearchFilterBar.stories.tsx` 等に作品種別選択状態（短編選択状態等）のストーリーを追加・更新し、`npm run test:vrt:update` および `npm run test:vrt` で 1280px / 375px のスナップショット PASS を検証する。

### 3.3 結合テスト（Playwright IT / 全件 100% PASS）

- `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`:
  - ランキング画面（`SCR-07`）において、カクヨムおよび小説家になろうの双方で作品種別ピル（「長編・連載」「短編」「すべて」）を切り替えた際、`aria-pressed="true"` 状態および一覧表示が正常に更新されること、また検索画面（`SCR-06`）で「短編」ピルを選択して検索できることを E2E で検証する。

---

## 4. 実装 Sub-issue 分割計画

| Sub-issue  | Issue 番号 | 種別     | 作業範囲                                                                                                                                                                                                                                          | 完了ゲート / マージ権限                      |
| :--------- | :--------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------- |
| **MK1**    | **#276**   | 実装     | Parser Layer（`NovelRankingWorkVariation` / `NovelRankingOptions.workVariation` 新設、`NovelSerialStatus` への `"short"` 追加、`KakuyomuParser`・`NarouParser` の `buildRankingUrl` / `buildSearchUrl` 拡張と単体テスト C0/C1 100%）              | Task Completion Gate 1〜6 → 🤖 AI 自律マージ |
| **MK2/IT** | **#277**   | 実装＋IT | ランキング・検索画面（`SCR-07` / `SCR-06`）の作品種別 UI/Hook（`RankingFilterBar`, `RankingPage`, `RankingContainer`, `useNovelRanking`, `SearchFilterBar`, `ServiceProvider`）実装・1対1 Story/UT・VRT・Playwright `SCN-02` 拡充・アーカイブ移動 | Task Completion Gate 1〜6 → 👤 人間マージ    |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）・実機検証計画

- **Android 実機検証の実施タイミング判断**: **`B. Milestone 最終レビュー後に一括で実機検証を実施（完了ゲート: Milestone v0.8 完了前 / Issue #267）`**
  - **判断理由**:
    - 本 Issue は Parser のランキング・検索 URL クエリパラメータ拡張および探索画面ヘッダー内のセグメントピル追加であり、Android ネイティブプラグインの新設・変更や物理ジェスチャー追加を伴わない。
    - 375px モバイル幅でのレイアウト整合性は Storybook VRT（375px）および Playwright 実ブラウザ結合テスト（`SCN-02`）で自動検証し、Android 実機での最終確認は Milestone `v0.8` 完了承認 Issue #267（Step 2）にて他機能（#264, #266）と一筆書きで一括実施する。
  - **新規申し送り事項（`HO-xx`）**: なし（現在 `Open` な申し送り事項は 0 件）。
