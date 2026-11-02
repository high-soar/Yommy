---
type: spec-delta
title: "フォント種別と画面余白のカスタマイズUIおよびリーダー組版反映の設計"
description: "Issue #169 に対する差分仕様、影響する全体正本、テスト計画、および実装Sub-issue分割計画。"
issue: "#169"
status: "Completed (Archived)"
updated: "2026-11-02"
tags:
  - delta
  - font-family
  - page-margin
  - reader
  - settings
  - typography
  - preview
  - multi-column
  - ho-25
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
  - docs/specs/changes/archive/issue-168-reader-pagination-and-touch-refinement.md
related_tests:
  - src/storage/schema.test.ts
  - src/storage/repositories/settingsRepository.test.ts
  - src/features/settings/hooks/useSettings.test.tsx
  - src/features/settings/components/SampleTextPreview.test.tsx
  - src/features/settings/components/SettingsPage.test.tsx
  - src/features/settings/components/SettingsContainer.test.tsx
  - src/features/reader/hooks/useReader.test.ts
  - src/features/reader/components/ReaderView.test.tsx
  - src/features/reader/components/ReaderPage.test.tsx
  - src/features/reader/components/ReaderContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：フォント種別と画面余白のカスタマイズUIおよびリーダー組版反映（Issue #169）

本ドキュメントは、Issue #169「`[v0.5] フォント種別（明朝/ゴシック/UD/教科書体）と画面余白（pageMarginPx）のカスタマイズUIおよびリーダー組版反映の実装（SYS-REQ-09拡張）`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- `docs/specs/requirements.md`（SYS-REQ-09: 読書ビューア［縦書き/横書き・カスタマイズ］）および `docs/specs/db-schema.md`（`reader_settings` テーブル）では、フォント種別（`font_family`: `mincho` / `gothic` / `biz-ud-mincho` / `biz-ud-gothic` / `klee`、初期値 `biz-ud-mincho`）および画面余白（`page_margin_px`: `8 〜 48`、初期値 `20`）のカラムと TypeScript 型定義（`ReaderFontFamily`, `pageMarginPx` in `src/storage/types.ts`）および `SqlSettingsRepository` の読み書き実装が既に用意されているが、UI 操作とリーダー組版への動的反映は `v0.5` 以降の拡張スコープとして据え置かれていた。
- 今回 `v0.5` にてリーダーのページめくり（1ページ単位マルチカラム組版・余白/column-gap 計算）を抜本改修（#168）するのに合わせ、フォント種別（5種）と画面余白（`pageMarginPx`）を設定画面（`SCR-05`）で変更し、サンプルプレビュー（`SampleTextPreview`）およびリーダー画面（`SCR-03`）の組版・ページ計算へリアルタイム反映できるようにする。

---

## 2. 仕様・設計の差分（What Changes）

### 2.1 設定画面（SCR-05: `SettingsPage` / `SampleTextPreview` / `useSettings`）の拡張

1. **配置場所**:
   - 既存の組み方向・カラーテーマ・文字サイズ・行間と同じく、設定画面（`SCR-05`）の「組版・表示設定」セクション（`typography-settings-section`）に集約する。
   - リーダー下部オーバーレイ（`ReaderBottomOverlay`）は読書没入感を最優先してシンプルに保ち、下部タブ「設定」⇔ OSバックキー（`TR-12`）で即座に往復する運用とする。

2. **フォント種別（`fontFamily`）選択 UI**:
   - **UI コントロール**: `<select>` ドロップダウン（`id="font-family-select"`, `data-testid="font-family-select"`）
   - **選択肢（5種・初期値 `'biz-ud-mincho'`）**:
     - `biz-ud-mincho`: `UD明朝（BIZ UDMincho）`（既定値）
     - `mincho`: `明朝体（標準）`
     - `biz-ud-gothic`: `UDゴシック（BIZ UDGothic）`
     - `gothic`: `ゴシック体（標準）`
     - `klee`: `教科書体（Klee）`
   - **CSS フォントスタック定義（DevContainer システムフォント・Android 実機互換）**:
     - `biz-ud-mincho`: `'BIZ UDMincho', 'Noto Serif CJK JP', 'Noto Serif JP', 'IPAexMincho', serif`
     - `mincho`: `'Noto Serif CJK JP', 'Noto Serif JP', 'IPAexMincho', 'Hiragino Mincho ProN', 'Yu Mincho', serif`
     - `biz-ud-gothic`: `'BIZ UDGothic', 'Noto Sans CJK JP', 'Noto Sans JP', 'IPAexGothic', sans-serif`
     - `gothic`: `'Noto Sans CJK JP', 'Noto Sans JP', 'IPAexGothic', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif`
     - `klee`: `'Klee One', 'Klee', 'Noto Serif CJK JP', serif`

3. **画面余白（`pageMarginPx`）調整 UI**:
   - **UI コントロール**: 文字サイズ・行間と統一した `−` / `＋` ステッパーボタン
     - 縮小ボタン: `data-testid="page-margin-decrease"`（`pageMarginPx <= 8` で `disabled`）
     - 現在値表示: `data-testid="page-margin-value"`（`{pageMarginPx}px`）
     - 拡大ボタン: `data-testid="page-margin-increase"`（`pageMarginPx >= 48` で `disabled`）
   - **調整範囲・刻み幅**: `8px 〜 48px`、`4px` 刻み、初期値 `20px`（`db-schema.md` の `page_margin_px INTEGER NOT NULL DEFAULT 20` と完全一致）

4. **`SampleTextPreview` への即時反映**:
   - `SampleTextPreviewProps` に `fontFamily?: ReaderFontFamily`（省略時 `'biz-ud-mincho'`）および `pageMarginPx?: number`（省略時 `20`）を追加。
   - `data-font-family={fontFamily}` および `data-page-margin={String(pageMarginPx)}` 属性を付与。
   - ハードコードされていた `font-serif` および `p-4 md:p-6` を廃止し、インラインスタイル `fontFamily: FONT_FAMILY_STACKS[fontFamily]` および `padding: ${pageMarginPx}px` を動的に適用する。

5. **`useSettings` での状態管理・永続化**:
   - `UseSettingsResult` に `fontFamily: ReaderFontFamily`, `pageMarginPx: number`, `changeFontFamily: (family: ReaderFontFamily) => Promise<void>`, `changePageMargin: (marginPx: number) => Promise<void>` を追加。
   - 変更時は即座にローカル State を楽観更新し、`settingsRepository.updateReaderSettings` へ保存。失敗時は直前の状態へロールバックし `error` を通知する。

---

### 2.2 リーダー画面（SCR-03: `ReaderView` / `ReaderPage` / `ReaderContainer` / `useReader`）への組版反映

1. **`useReader` での設定読み出し**:
   - `settingsRepository.getReaderSettings()` から `fontFamily`（初期値 `'biz-ud-mincho'`）および `pageMarginPx`（初期値 `20`）を読み出し、`UseReaderResult` として返却する。
   - `ReaderContainer` はこれらを `ReaderPage` へ伝播し、`ReaderPage` は `ReaderView` へ渡す。

2. **`ReaderView` の動的フォント・余白適用と #168 マルチカラム組版との統合**:
   - `ReaderViewProps` に `fontFamily?: ReaderFontFamily`（省略時 `'biz-ud-mincho'`）および `pageMarginPx?: number`（省略時 `20`）を追加。
   - `data-font-family={fontFamily}` および `data-page-margin={String(pageMarginPx)}` 属性を付与。
   - ハードコードされていた `font-serif` および `p-6`（固定 24px パディング）を廃止し、`fontFamily` に対応する CSS `font-family` スタックと `padding: ${pageMarginPx}px` を動的に適用する。
   - **縦書きページめくりモード（`vertical-rl` + 実効 `"paged"`）のマルチカラム組版（#168）との統合計算式**:
     - 1 ページ表示領域のカラム幅:
       $$\text{columnWidth} = \max(1, \text{pageWidth} - \text{pageMarginPx} \times 2)\,\text{px}$$
     - 1 ページ表示領域のカラム高さ:
       $$\text{columnHeight} = \max(1, \text{pageHeight} - \text{pageMarginPx} \times 2)\,\text{px}$$
     - カラム間隔（段送り余白）:
       $$\text{columnGap} = (\text{pageMarginPx} \times 2)\,\text{px}$$
     - 1 ページ送りストライド:
       $$\text{pageStride} = \text{pageHeight}$$
     - 総ページ数（`totalPages`）算出:
       $$\text{totalPages} = \max\left(1, \text{round}\left(\frac{\text{scrollHeight} + \text{pageMarginPx} \times 2}{\text{pageStride}}\right)\right)$$
     - 任意の `pageMarginPx`（`8px 〜 48px`）および任意の `fontFamily`（5種）において、文字・ルビの途中切断や `totalPages` の欠損・縮小が発生しないことを保証する。

---

### 2.3 新設・更新された受入条件（Acceptance Criteria）

| 受入条件 ID    | 項目                                         | 内容                                                                                                                                                                                                                                                                                                  | 対応要件 ID      |
| :------------- | :------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| **`AC-ST-17`** | フォント種別の設定とプレビュー反映           | 設定画面（`SCR-05`）の `<select id="font-family-select">` から 5 種のフォント（UD明朝、明朝、UDゴシック、ゴシック、教科書体）を選択でき、プレビュー（`SampleTextPreview`）に即座に反映され、`reader_settings.font_family` に非同期永続化されること。                                                  | `SYS-REQ-09`     |
| **`AC-ST-18`** | 画面余白の設定とプレビュー反映               | 設定画面（`SCR-05`）のステッパーボタンにより画面余白を 8px 〜 48px（4px刻み、初期値 20px）で変更でき、プレビューのパディングに即座に反映され、最小値（8px）・最大値（48px）で各ボタンが disabled 化され、`reader_settings.page_margin_px` に非同期永続化されること。                                  | `SYS-REQ-09`     |
| **`AC-RD-21`** | フォント種別・画面余白のリーダー組版動的反映 | 設定画面で保存されたフォント種別および画面余白が `SCR-03` リーダー画面に動的適用され、ハードコードされていた `font-serif` および `p-6` が廃止され、マルチカラム組版の段幅・段高・カラム間隔（`pageMarginPx * 2`）および総ページ数が正確に再計算され、文字・ルビ途切れや総ページ数縮小が生じないこと。 | `SYS-REQ-09, 11` |

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Unit Tests: Vitest）

- **`useSettings.test.tsx`**:
  - `fontFamily`, `pageMarginPx` の初期値読み込み（既定: `'biz-ud-mincho'`, `20`）
  - `changeFontFamily` 呼び出しによる State 更新と `settingsRepository.updateReaderSettings` 呼び出し
  - `changePageMargin` 呼び出しによる State 更新と `settingsRepository.updateReaderSettings` 呼び出し
  - 保存失敗時のロールバックと `error` 設定
- **`SampleTextPreview.test.tsx`**:
  - 渡された `fontFamily` および `pageMarginPx` に応じた `data-font-family`, `data-page-margin` 属性の付与
  - インラインスタイル（CSS `fontFamily` スタックおよび `padding`）の正確な反映
- **`SettingsPage.test.tsx`**:
  - `font-family-select` の 5 種 option 描画と選択変更イベント発火
  - `page-margin-decrease` / `page-margin-increase` ステッパーボタンの押下イベント発火
  - 最小余白（`8px`）での縮小ボタン disabled、最大余白（`48px`）での拡大ボタン disabled 境界値テスト
- **`SettingsContainer.test.tsx`**:
  - `useSettings` から提供される `fontFamily`, `pageMarginPx` およびハンドラが `SettingsPage` へ正しく配線されていること
- **`useReader.test.ts`**:
  - `settingsRepository.getReaderSettings()` から `fontFamily`, `pageMarginPx` が読み出され返却されること
- **`ReaderView.test.tsx`**:
  - 渡された `fontFamily`（5種）および `pageMarginPx`（8〜48px）に応じた動的スタイル適用
  - 縦書きマルチカラム組版時、段幅・段高・`columnGap`（`pageMarginPx * 2`）が正確に計算・適用されること
- **`ReaderPage.test.tsx` & `ReaderContainer.test.tsx`**:
  - `fontFamily`, `pageMarginPx` の props バケツリレーが正しく機能すること

### 3.2 Visual Regression Tests（Storybook VRT: 1280px / 375px）

- **`SampleTextPreview.stories.tsx`**:
  - 5種フォント（UD明朝、明朝体、UDゴシック、ゴシック体、教科書体 Klee）および余白（8px, 20px, 48px）のプレビューストーリー追加
  - 1280px / 375px での視覚的差分検証
- **`SettingsPage.stories.tsx`**:
  - フォント選択ドロップダウンおよび余白ステッパーが組み込まれた画面ストーリー
- **`ReaderView.stories.tsx` & `ReaderPage.stories.tsx`**:
  - フォント種別・余白バリエーションストーリーの追加と VRT スナップショット一致確認

### 3.3 システム結合テスト（Integration Tests: Playwright IT）

- 設定画面（`SCR-05`）でフォント種別および画面余白を変更し、プレビューに即座に反映されること
- リーダー画面（`SCR-03`）へ移動した際、選択したフォント種別および画面余白が適用され、縦書きページめくり／連続スクロールともに文字途切れなく快適に読書・ページ送りできること
- 既存の全 E2E シナリオ（`SCN-01`〜`SCN-05`）が回帰なくすべて PASS すること

---

## 4. 実装 Sub-issue 分割計画

| Sub-issue                 | 区分  | タイトル・作業範囲                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |    推定規模    |       進捗ステータス        |
| :------------------------ | :---: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------: | :-------------------------: |
| **Sub-issue ①**<br>(#179) | `MK1` | **設定画面（SCR-05）のフォント種別・画面余白カスタマイズUIと `useSettings` / `SampleTextPreview` の TDD 実装**（#179）<br>・`useSettings` の `fontFamily`, `pageMarginPx`, `changeFontFamily`, `changePageMargin` 実装・単体テスト<br>・`SampleTextPreview` のフォントスタック＆余白インラインスタイル動的適用・Storybook・VRT<br>・`SettingsPage` の `<select id="font-family-select">` ＆ 余白ステッパー UI 実装・Storybook・VRT<br>・`SettingsContainer` の配線                                              | 約 250〜350 行 |       完了（PR #191）       |
| **Sub-issue ②**<br>(#180) | `MK2` | **リーダー画面（SCR-03）のフォント種別・画面余白組版反映と `useReader` / `ReaderView` の TDD 実装**（#180）<br>・`useReader` での `fontFamily`, `pageMarginPx` 読み出し・返却<br>・`ReaderContainer` → `ReaderPage` → `ReaderView` の props 連携<br>・`ReaderView` のハードコード `font-serif` / `p-6` 廃止、動的フォントスタックおよび動的余白適用<br>・縦書きマルチカラム（#168）の段幅・段高・`columnGap`（`pageMarginPx * 2`）動的組版計算<br>・Storybook・VRT（1280px / 375px）および単体テスト C0/C1 100% | 約 250〜350 行 |       完了（PR #194）       |
| **Sub-issue ③**<br>(#181) | `IT`  | **Playwright システム結合テスト（フォント・余白組版検証 ＆ SCN-xx 回帰）と仕様書アーカイブ**（#181）<br>・設定変更 → プレビュー反映 → リーダー組版反映の E2E シナリオ検証<br>・全 E2E シナリオ（`SCN-01`〜`SCN-05`）回帰 PASS<br>・差分仕様 `docs/specs/changes/issue-169-*.md` の `archive/` 移動と正本 `Approved` 化<br>・申し送り事項 `HO-25` の実機確認用整理                                                                                                                                               | 約 150〜250 行 | 完了（PR #195 / Refs #181） |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）

|   ID    | 内容                                                                                                                                                                                                                                                    | 解決先                                                                  | 完了ゲート             |  状態  |
| :-----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------- | :--------------------- | :----: |
| `HO-25` | Android 実機環境におけるフォント種別（明朝/ゴシック/UD明朝/UDゴシック/Klee教科書体）のフォールバック表示および画面余白（8〜48px）変更時の文字切れ・折り返し描画の実機確認（検証手順: ①SCR-05でフォント5種・余白変更、②プレビュー確認、③SCR-03組版確認） | Issue #169（v0.5 IT PR #195 結合完了・Milestone v0.5 実機確認へと引継） | 実機インストール確認時 | `Open` |
