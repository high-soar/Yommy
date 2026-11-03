---
type: spec-delta
title: "リーダー上下連動オーバーレイ＆ページシークバー（RTL）実装の設計"
description: "Issue #202 に対する差分仕様、影響する全体正本、テスト計画、および実装Sub-issue分割計画。"
issue: "#202"
status: "Completed (Archived)"
updated: "2026-11-03"
tags:
  - delta
  - reader
  - overlay
  - seekbar
  - rtl
  - truncate
  - navigation
  - scr-03
  - tr-06
  - ho-27
related_specs:
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/reader-view.md
related_tests:
  - src/features/reader/components/ReaderBottomOverlay.test.tsx
  - src/features/reader/components/ReaderPage.test.tsx
  - src/features/reader/components/ReaderContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：リーダー上下連動オーバーレイ＆ページシークバー（RTL）実装（Issue #202）

本ドキュメントは、Issue #202「`[v0.6] リーダー上下連動オーバーレイ（作品名・サブタイトル1行省略表示・目次導線）＆ページシークバー（RTL）の実装`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- 現在のリーダー画面（`SCR-03`）は全画面テキスト表示（`100dvh`）となっており、画面中央タップや最下部タッチでオーバーレイを開いても、下部オーバーレイ（`ReaderBottomOverlay`）に「第 X 話 / 全 Y 話」と前後話ボタン・下部4タブが表示されるのみである。
- 現在読んでいる作品タイトル・エピソードサブタイトルの確認、作品詳細（目次一覧 `SCR-02`）へ戻る明示的ボタン、およびエピソード内の任意ページへ素早く移動するページシークバー（スライダー）が存在しない。
- 一方で、下部オーバーレイにすべての情報を詰め込むと縦幅が肥大化して読書画面を過度に圧迫し、また Web 小説特有の長大な作品タイトル・サブタイトル（100文字超）によってレイアウト崩れが生じる懸念がある。
- そのため、下部オーバーレイの開閉（`isOpen`）と完全同期する上部オーバーレイ（`ReaderTopOverlay`）を新設して作品名・サブタイトル（各1行固定省略）と「← 目次」導線を上部に分離し、下部オーバーレイには縦書きページめくり時の右→左（RTL）ページシークバーを追加する。

---

## 2. 要求仕様と設計合意事項（What）

### 2.1 上部オーバーレイ（`ReaderTopOverlay`）の新設と長文タイトル保護

1. **開閉同期・アニメーション**:
   - 下部オーバーレイ（`ReaderBottomOverlay`）の `isOpen` 状態と完全同期する。
   - `isOpen === true`: 画面上端からスライドイン（`translate-y-0`）。
   - `isOpen === false`: 画面上外へ退避（`-translate-y-full pointer-events-none`、`transition-transform duration-200 ease-in-out`）。
2. **レイアウトと「← 目次」遷移導線**:
   - 左端に「← 目次」ボタン（`data-testid="reader-top-back-to-toc"`、`shrink-0`）を配置し、押下時にしおり・進捗率を即時保存（`flushBookmark`）して作品詳細・目次画面（`SCR-02: /novels/:novelId`）へ遷移する（`TR-06`）。
   - 右側（`min-w-0 flex-1`）に作品タイトル（`data-testid="reader-top-novel-title"`）とエピソードサブタイトル（`data-testid="reader-top-chapter-title"`）を上下2段で配置する。
3. **長文タイトル・サブタイトルの表示上限（1行固定省略）**:
   - 作品タイトル・エピソードサブタイトルともに `truncate`（`overflow-hidden text-ellipsis whitespace-nowrap`、最大1行固定・末尾 `...` 省略）を適用する。
   - どれほど長いタイトル・サブタイトル（100文字超）であっても上部オーバーレイの高さが一切変化せず、レイアウト崩れを起こさないことを保証する。
4. **コンポーネント契約（`ReaderTopOverlayProps`）**:
   ```ts
   export interface ReaderTopOverlayProps {
     /** オーバーレイの開閉表示状態（true: スライドイン表示、false: 画面外へ退避） */
     isOpen: boolean;
     /** 作品タイトル */
     novelTitle: string;
     /** エピソードサブタイトル */
     chapterTitle: string;
     /** 「← 目次」ボタン押下時のコールバック */
     onBackToToc: () => void;
   }
   ```

### 2.2 下部オーバーレイ（`ReaderBottomOverlay`）へのページシークバー（RTL）追加

1. **表示条件**:
   - 実効ページ送りモードが `"paged"`（縦書きページめくりモード）のときのみ、前後話ナビゲーション（`ReaderChapterNav`）の上段にページシークバー領域（`data-testid="reader-page-seekbar-section"`）を表示する（連続スクロールモード時は非表示）。
2. **右→左（RTL）スライダー仕様**:
   - 縦書き右綴じの進行方向と一致させ、右端が `1` ページ目、左へスライドするほどページが進み、左端が `totalPages`（最終ページ）となる RTL 方向（`dir="rtl"`）のレンジスライダー（`data-testid="reader-page-seekbar"`、`min={1}`, `max={totalPages}`, `value={currentPage}`）とページ表示（`data-testid="reader-page-seekbar-label"`、`{currentPage} / {totalPages} ページ`）を配置する。
   - `totalPages <= 1` または `isLoading === true` のときは `disabled` とする。
3. **シークバー操作時のオーバーレイ維持**:
   - オーバーレイ内のページシークバーを操作してページを変更した際は、オーバーレイを自動で閉じずに開いたまま維持し、ユーザーが目標ページを確認しながら連続してスライダーを微調整できるようにする。
4. **コンポーネント契約拡張（`ReaderBottomOverlayProps`）**:
   ```ts
   export interface ReaderBottomOverlayProps {
     isOpen: boolean;
     chapterIndex: number;
     totalChapters: number;
     isLoading?: boolean;
     activeTab?: BottomTab;
     onPrevChapter: () => void;
     onNextChapter: () => void;
     onSelectTab?: (tab: BottomTab) => void;
     /** 実効ページ送りモード（'paged' または 'scroll'、省略時: 'scroll'） */
     effectivePagingMode?: "paged" | "scroll";
     /** ページめくり表示時の現在ページ番号（1始まり、省略時: 1） */
     currentPage?: number;
     /** ページめくり表示時の総ページ数（省略時: 1） */
     totalPages?: number;
     /** ページシークバー操作時のコールバック */
     onPageChange?: (targetPage: number) => void;
   }
   ```

### 2.3 `ReaderPage` / `ReaderContainer` での上下連動と画面遷移統合（`TR-06`）

1. **`ReaderPage` の責務**:
   - `ReaderTopOverlay` を内包し、下部オーバーレイと共通の `isOpen` 状態を伝播する。
   - `onBackToToc` コールバックを受け取り、上部オーバーレイの「← 目次」ボタン押下時に発火させる。
   - `ReaderBottomOverlay` へ `effectivePagingMode`, `currentPage`, `totalPages`, `onPageChange` を伝播する。
   - シークバー操作（`onPageChange`）発生時、オーバーレイを閉じず `isOpen = true` を維持する（本文タップ・スクロールによる自動非表示とは明確に区別）。
2. **`ReaderContainer` の責務**:
   - `onBackToToc` ハンドラーにおいて、`await flushBookmark()` を実行して現在の読書進捗を SQLite へ即時保存した上で、`router.navigateToNovelDetail(targetNovelId)` を呼び出し、作品詳細・目次画面（`SCR-02`）へ遷移する（`TR-06` の拡張）。

### 2.4 後続 Issue（#203: ハードウェア音量キー対応）との明確な境界分離

- **本 Issue（#202）の責務**:
  - `ReaderTopOverlay` の新設（タイトル1行省略・目次導線）。
  - `ReaderBottomOverlay` への RTL ページシークバー追加。
  - `ReaderPage` / `ReaderContainer` での上下オーバーレイ連動と目次遷移・シークバー操作統合。
  - 音量キーに関するコード（キーイベント購読、Capacitor プラグイン連携）は一切含めない。
- **後続 Issue（#203）の責務**:
  - 設定画面（`SCR-05`）の「音量キーでページ送り」ON/OFF トグル UI および SQLite 永続化。
  - Android ネイティブ層（Capacitor プラグイン）での音量キー捕捉と Web 側へのキーイベント通知。
  - リーダー画面（`SCR-03`）でのキーイベント購読およびページ送り連携。

---

## 3. 影響を受ける正本仕様書一覧

| 正本仕様書                             | 区分         | 変更概要                                                                                                                                                                                                                                   |
| :------------------------------------- | :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/features/reader-view.md`   | App 全体正本 | ・コンポーネント構成に `ReaderTopOverlay` を追加<br>・`ReaderTopOverlay`, `ReaderBottomOverlay`, `ReaderPage`, `ReaderContainer` のプロパティ契約更新<br>・新規受入条件 `AC-RD-22`〜`AC-RD-25` の追加<br>・`SCN-01` 結合シナリオ仕様の更新 |
| `docs/specs/screen-transitions.md`     | App 全体正本 | ・`SCR-03` 画面説明を上下連動オーバーレイ（上部タイトル省略・目次導線、下部RTLシークバー）へ更新<br>・`TR-06` 遷移トリガーに「リーダー上部オーバーレイの『← 目次』ボタン押下」を追加                                                       |
| `docs/specs/requirements.md`           | App 全体正本 | ・`SYS-REQ-11`（リーダー組版・操作体験）および `SYS-REQ-16`（共通シェル・ナビゲーション）へ上下連動オーバーレイと RTL ページシークバーの要件を反映                                                                                         |
| `docs/quality/bug-and-handover-log.md` | 品質記録正本 | ・申し送り事項 `HO-27`（実機でのシークバー操作感および長文タイトル表示崩れなし検証）を登録                                                                                                                                                 |

---

## 4. 新規受入条件（Acceptance Criteria）

| AC ID          | 対象機能                                       | 検証条件                                                                                                                                                                                                                                                                                                   | 関連要件 / 遷移        |
| :------------- | :--------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| **`AC-RD-22`** | 上部オーバーレイ新設と下部オーバーレイ連動     | リーダー画面においてオーバーレイ展開時（`isOpen === true`）に上部オーバーレイ（`ReaderTopOverlay`）と下部オーバーレイ（`ReaderBottomOverlay`）が同時に画面端からスライドインし、本文中央タップ等の閉じる操作で同時に画面外へ退避（非表示時は `pointer-events-none`）すること。                             | `SYS-REQ-11`           |
| **`AC-RD-23`** | 長文タイトル・サブタイトルの1行固定省略保護    | 上部オーバーレイに作品タイトル（`reader-top-novel-title`）とエピソードサブタイトル（`reader-top-chapter-title`）が上下2段で表示され、100文字超の長文であっても各1行固定で末尾 `...` 省略（`truncate`）され、上部オーバーレイの高さ変化やレイアウト崩れが一切発生しないこと。                               | `SYS-REQ-11`           |
| **`AC-RD-24`** | 上部オーバーレイ「← 目次」ボタンによる目次復帰 | 上部オーバーレイ左端の「← 目次」ボタン（`reader-top-back-to-toc`）を押下した際、現在のしおり進捗率が即座に SQLite へ保存（`flushBookmark`）された上で、作品詳細・目次画面（`SCR-02: /novels/:novelId`）へ遷移すること（`TR-06`）。                                                                         | `SYS-REQ-12` / `TR-06` |
| **`AC-RD-25`** | 縦書きページめくり時の RTL ページシークバー    | 縦書きページめくりモード（実効 `paged`）時のみ、下部オーバーレイの前後話ナビ上段に右→左（RTL: 右端1ページ、左端最終ページ）のレンジスライダー（`reader-page-seekbar`）が表示され、スライダー操作でオーバーレイを開いたまま任意ページへ即座に移動・しおり進捗更新ができること（連続スクロール時は非表示）。 | `SYS-REQ-11` / `TR-05` |

---

## 5. テスト計画

### 5.1 単体テスト（Vitest & Portable Stories）

- **`ReaderTopOverlay.test.tsx`**:
  - `isOpen === true` で `translate-y-0`、`isOpen === false` で `-translate-y-full pointer-events-none` が適用されること。
  - 作品名・サブタイトルが表示され、それぞれ `truncate` クラスが付与されていること。
  - 100文字超の長文タイトルを与えてもレンダリングに失敗しないこと。
  - 「← 目次」ボタン押下で `onBackToToc` コールバックが呼び出されること。
- **`ReaderBottomOverlay.test.tsx`**:
  - `effectivePagingMode === "paged"` かつ `totalPages > 1` のとき `reader-page-seekbar-section` が描画されること。
  - スライダーが `dir="rtl"`、`min="1"`, `max={totalPages}`, `value={currentPage}` であること。
  - スライダーの `change` イベントで `onPageChange` が正しいページ番号で発火すること。
  - `totalPages <= 1` または `isLoading === true` のときスライダーが `disabled` であること。
  - `effectivePagingMode === "scroll"` のときはシークバー領域が描画されないこと。
- **`ReaderPage.test.tsx`**:
  - `ReaderTopOverlay` がレンダリングされ、`isOpen` 状態が下部オーバーレイと連動すること。
  - シークバー操作時にオーバーレイが閉じずに開いたまま維持されること。
  - 上部オーバーレイの「← 目次」ボタン押下で `onBackToToc` コールバックが呼び出されること。
- **`ReaderContainer.test.tsx`**:
  - 「← 目次」ボタン押下時に `flushBookmark` が実行され、`navigateToNovelDetail`（`SCR-02`）へ遷移すること。

### 5.2 Storybook & VRT（1280px / 375px）

- **`ReaderTopOverlay.stories.tsx`**:
  - `Open`: 通常タイトル表示（展開状態）
  - `Closed`: 非表示状態
  - `LongTitle`: 100文字超の長大タイトル・サブタイトルでの1行省略表示
- **`ReaderBottomOverlay.stories.tsx`**:
  - `PagedWithSeekbar`: 縦書きページめくり・シークバー表示（中間ページ）
  - `PagedSinglePage`: 総ページ数1（シークバー非活性）
  - `ScrollMode`: 連続スクロールモード（シークバー非表示）
- **`ReaderPage.stories.tsx`**:
  - `OverlayOpenPaged`: 上下連動オーバーレイ展開状態（シークバー付き）
  - `OverlayOpenLongTitle`: 長文タイトルでの上下オーバーレイ展開状態
- **VRT 検証**:
  - 1280px（デスクトップ）および 375px（モバイル）の双方でスナップショットを取得し、タイトル省略・シークバー配置の視覚的整合性を検証。

### 5.3 Playwright システム結合テスト（`SCN-01`）

- `test/it/scenarios/scn01-poc-vertical-reader.spec.ts`:
  - 画面中央タップで上下オーバーレイ（`reader-top-overlay` および `reader-bottom-overlay`）が同時にスライドイン展開することを確認。
  - 上部オーバーレイに作品タイトル・エピソードサブタイトルが表示されていることを確認。
  - 縦書きページめくり時、シークバー（`reader-page-seekbar`）を操作して任意ページへジャンプし、オーバーレイが開いたまま維持されページインジケーターが更新されることを確認。
  - 上部オーバーレイの「← 目次」ボタン（`reader-top-back-to-toc`）をクリックし、しおり進捗率が保存されて作品詳細・目次画面（`SCR-02: /novels/:novelId`）へ遷移することを確認。
  - 設定画面で連続スクロールモードへ切り替えた後、リーダーでオーバーレイを展開した際にシークバー領域が表示されないことを確認。

---

## 6. 実装 Sub-issue 分割計画

推奨粒度（1 PR = 200〜400行目安）に基づき、以下の 4 本の Sub-issue に分割して順次推進する。

| Sub-issue         | 種別 | タイトル                                                                                                             | 主な作業内容                                                                                                                                                                        | 推定規模 |
| :---------------- | :--: | :------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: |
| **① MK-1 (#214)** |  MK  | `[v0.6] ReaderTopOverlay 新設（作品名・サブタイトル1行省略表示と「← 目次」ボタン）の実装 (#202-1)`                   | ・`ReaderTopOverlay.tsx` 新設<br>・1行固定省略（`truncate`）保護<br>・`ReaderTopOverlay.stories.tsx` 作成<br>・`ReaderTopOverlay.test.tsx` 作成<br>・VRT スナップショット更新・検証 | ~250 行  |
| **② MK-2 (#215)** |  MK  | `[v0.6] ReaderBottomOverlay への RTL ページシークバー（スライダー）追加 (#202-2)`                                    | ・`ReaderBottomOverlay.tsx` へ RTL シークバー追加<br>・`ReaderBottomOverlay.stories.tsx` 更新<br>・`ReaderBottomOverlay.test.tsx` 更新<br>・VRT スナップショット更新・検証          | ~200 行  |
| **③ MK-3 (#216)** |  MK  | `[v0.6] ReaderPage / ReaderContainer での上下連動オーバーレイ・シークバー操作・目次復帰の統合 (#202-3)`              | ・`ReaderPage` へ `ReaderTopOverlay` 組み込み・シークバー連携<br>・`ReaderContainer` へ `onBackToToc`（`flushBookmark` ＋ 目次遷移）統合<br>・UT / Stories / VRT 更新               | ~250 行  |
| **④ IT (#217)**   |  IT  | `[v0.6] Playwright SCN-01 システム結合テスト拡張（上下連動・目次遷移・シークバー操作）と差分仕様アーカイブ (#202-4)` | ・`test/it/scenarios/scn01-poc-vertical-reader.spec.ts` 拡張<br>・全 IT シナリオ PASS 確認<br>・申し送り事項 `HO-27` の確認<br>・差分仕様書のアーカイブ移動（`git mv`）             | ~200 行  |

---

## 7. 申し送り事項（Handover Items: `HO-xx`）

| ID          | 内容                                                                                                                                                             | 解決先                                 | 完了ゲート              | 状態   |
| :---------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- | :---------------------- | :----- |
| **`HO-27`** | リーダー上下連動オーバーレイ（上部タイトル省略・目次導線、下部RTLページシークバー）における Android 実機でのスライダー操作感および長文タイトル表示崩れなしの検証 | Milestone `v0.6` 実機検証 / Issue #204 | Milestone `v0.6` 完了前 | `Open` |
