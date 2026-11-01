---
type: spec-delta
title: "リーダーのページめくり・スクロール実機不具合修正と横書きスクロール限定化の設計"
description: "Issue #168 に対する差分仕様、影響する全体正本、テスト計画、および実装Sub-issue分割計画。"
issue: "#168"
status: "Review (#168)"
updated: "2026-11-01"
tags:
  - delta
  - reader
  - pagination
  - touch-action
  - multi-column
  - gestures
  - scroll
  - ho-23
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
related_tests:
  - src/storage/schema.test.ts
  - src/storage/repositories/settingsRepository.test.ts
  - src/features/settings/hooks/useSettings.test.tsx
  - src/features/settings/components/SettingsPage.test.tsx
  - src/features/settings/components/SettingsContainer.test.tsx
  - src/features/reader/hooks/useReader.test.ts
  - src/features/reader/hooks/useReaderGestures.test.ts
  - src/features/reader/components/ReaderView.test.tsx
  - src/features/reader/components/ReaderPage.test.tsx
  - src/features/reader/components/ReaderContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：リーダーのページめくり・スクロール実機不具合修正と横書きスクロール限定化（Issue #168）

本ドキュメントは、Issue #168「`[v0.5] リーダーのページめくり・スクロール実機不具合修正（スワイプ不発・文字途切れ・総ページ数欠損）と横書きスクロール限定化 (HO-23)`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

Android 実機にてリーダー画面（`SCR-03`）のページめくり（`paged`）およびスクロール（`scroll`）を触って検証（`HO-23` 実機検証）したところ、以下の 4 点の不具合および UX 上の課題が確認された。

1. **ページ送りの際にスクロール（スワイプ操作）が効かず、前後の話への移動もできない**
2. **ページ送りの際に、文字の途中でページが切り替わり読めない場合がある（ルビ等の微妙な幅変化の影響を含む）**
3. **ページ送りの際に総ページ数（`totalPages`）が本来の値より小さくなり、話の途中より先が見れない**
4. **横書きのページ送りで、右 20% で下（次）、左 20% で上（前）に行くことに違和感がある。上下タップは押しづらく下部オーバーレイとも競合するため、横書き時は連続スクロール限定としたい**

コードベースおよび実ブラウザ（Chromium）で原因を調査した結果、それぞれの技術的根本原因が特定されたため、本 Issue にて仕様整理および抜本修正を行い、あわせて申し送り事項 **`HO-23`**（および実機確認完了済みの **`HO-15`**, **`HO-22`**）を精算する。

### 実機事象の根本原因分析（Root Cause Analysis）

#### ① ページ送り時のスワイプ（ドラッグ）不発 ＆ エピソード端での前後話移動不可

- **原因 1（`paged` モードでの `touch-action` 未指定による `pointercancel` 発火）**:
  - `src/features/reader/components/ReaderPage.tsx` の `<main>` および `src/features/reader/components/ReaderView.tsx` のルート要素に CSS `touch-action: none`（Tailwind `touch-none` 等）が指定されていない（デフォルト `touch-action: auto`）。
  - Android WebView（モバイル Chromium）上で画面に指を置いて動かすと、約 8px 移動した時点でブラウザネイティブのジェスチャー制御にタッチが奪われ、即座に **`pointercancel`** が発火する。
  - `src/features/reader/hooks/useReaderGestures.ts` の `handlePointerMove` は `distance >= 10`（10px以上）でドラッグ開始と判定しているため、ドラッグ開始前に必ず `handlePointerCancel` が呼ばれて `touchStartRef.current = null` / `slideOffsetPx = 0` にリセットされ、**スワイプによるページ送りおよび先頭/最終ページ端でのラバーバンド引っ張りによる前後話移動が一切発火しない**（PC/CI の `page.mouse` では `pointercancel` が起きないためすり抜けていた）。
  - また、先頭/最終ページでの左右 20% タップ時は `currentPage < totalPages` / `currentPage > 1` のガードにより何も起きない実装となっているため、スワイプ不発によりオーバーレイ以外での前後話移動手段が失われていた。
- **原因 2（`scroll` モードでの `pointercancel` による 2段階境界スワイプの不発）**:
  - 連続スクロール（`scroll`）モードではネイティブスクロール（`overflow-x-auto` / `overflow-y-auto`）が動くため、タッチ移動開始時（約 8px）に必ず `pointercancel` が発火する。
  - `useReaderGestures.ts` の連続スクロール端 2段階スワイプ判定（`dx < -30` / `dy < -30`）も `PointerEvent`（`handlePointerMove`）で実装されており、`handlePointerCancel` で `wasAtEndOnDownRef.current = false` にリセットされるため、実機タッチ操作では 30px 到達前にキャンセルされ発火しない。

#### ② 縦書きページめくり時に文字・行の途中でページが切り替わり読めない場合がある

- **原因 1（縦書き `vertical-rl` 時に 1ページ単位のカラム/ページ分割組版が行われていない）**:
  - `ReaderView.tsx` の `getPagedContentStyle` が `isVertical ? {} : { columns: "1", ... }` となっており、**縦書き時はマルチカラム分割や 1ページ単位の行折り返し制御が一切行われていない**。
  - 全ページの縦書き行が 1 つの連続ブロックとして右から左へ隙間なく配置され、それを単にビューポート幅 `pageWidth`（`clientWidth`）単位で `translateX((currentPage - 1) * pageWidth)` スライドさせているだけになっている（既存 VRT `reader-readerview--page-indicator-375px.png` の左端でも行の縦切断が発生している）。
- **原因 2（画面幅と行送り幅の非整数比、およびルビ・傍点・ヘッダー・パディングによる行幅変化の累積）**:
  - 1行の幅（`fontSizePx * lineHeight`、例: `18px * 1.8 = 32.39px`）に対して画面幅（例: `375px`）が整数倍ではない（`11.57行`）ため、ページ境界 `k * pageWidth` が行間の空白に重なるページ（読める）と文字の真上に重なるページ（文字が縦に真っ二つに切れて読めない）が周期的に発生する。
  - さらに、行間が狭い設定（`lineHeight: 1.4` 等）では `<ruby>`（`28px`）や `<em class="bouten">`（`27px`）を含む行のボックス幅が通常行（`25.19px`）より微妙に広がるほか、第1ページのみの `<header>` 幅や `reader-content` 外枠のみの `p-6`（第2ページ以降には左右余白が存在しない）によっても行位置がシフトし、ページ境界での文字途切れを引き起こしている。

#### ③ ページめくり時に総ページ数（`totalPages`）が本来の値より小さくなり、話の途中より先が見れない

- **原因 1（`transform: translateX(...)` を持つ子要素ではなく親要素 `reader-view` の `scrollWidth` を計測している）**:
  - `ReaderView.tsx` では親要素 `containerRef.current`（`data-testid="reader-view"`）の `el.scrollWidth` を `el.clientWidth` で割って `totalPages` を算出しているが、スライド変位 `transform: translateX(slideTranslateX)` は子要素 `data-testid="reader-content"` に適用されている。
  - Chromium の仕様上、`vertical-rl`（右→左フロー）で子要素を `+X` 方向へ `(currentPage - 1) * pageWidth` だけ `translateX` させると、スクロール起点（右端）より右側へ移動した領域はスクロール可能幅から除外されるため、**親要素 `reader-view.scrollWidth` が `本来の全幅 - (currentPage - 1) * pageWidth` へと縮小する**。
- **原因 2（前後話遷移時の 200ms トランジション残存、および 2ページ目以降の再計測による総ページ数の切り詰め）**:
  - **前後話遷移時**: 第1話を `P` ページ目（例: 8ページ目）まで進めてから次の話へ遷移すると、`ReaderView` はアンマウントされずに `bodyHtml` が更新され `currentPage = 1`（`translateX(0px)`）へ戻るが、`transition: "transform 200ms ease-out"` が常時有効なため、新エピソードの `useEffect` が `el.scrollWidth` を計測する瞬間（`t = 0ms`）にはまだ旧エピソードの変位 `translateX((P - 1) * pageWidth)` が残っている。その結果、本来 8 ページある話が `8 - 7 = 1〜2ページ` と誤計測されたまま確定し、話の途中より先が一切見られなくなる。
  - **2ページ目以降での再計測時**: `currentPage > 1` の状態で Android WebView のシステムバー変化等による `resize` イベントや `useEffect` 再評価が走ると、`(currentPage - 1)` ページ分だけ減った `scrollWidth` で `totalPages` が上書きされ、現在ページまたは話の途中が最終ページ扱いとなって先へ進めなくなる。

#### ④ 横書きページ送りの左右 20% タップの違和感・横書き時はスクロール限定への整理

- **原因・課題**:
  - 横書き（`horizontal-tb`）のページめくりでは左開き基準で「右 20% タップ＝次（下方向）」「左 20% タップ＝前（上方向）」となっており、縦書き時と左右タップの進行方向が逆転する上、上下に流れる横書きテキストに対して左右タップで移動する操作に違和感がある。
  - 上下タップに変更すると画面上部が押しづらく、画面下部は下部オーバーレイ起動ゾーンと競合する。

---

## 2. 要求仕様と設計合意事項（What）

### 2.1 横書き時の連続スクロール限定化と設定画面（SCR-05）の整理（`SYS-REQ-11` / `SCR-05` 拡張）

1. **実効モード（`effectivePagingMode`）の算出ルール**:
   - 横書き（`horizontal-tb`）時は、設定された `pagingMode`（`auto` / `paged` / `scroll`）に関わらず **常に実効モードを `"scroll"`（連続スクロール）に固定** する。
   - ページめくり（`"paged"`）は縦書き（`vertical-rl`）専用とする。

```ts
export function resolveEffectivePagingMode(
  pagingMode: ReaderPagingMode,
  writingMode: WritingMode,
): "paged" | "scroll" {
  if (writingMode === "horizontal-tb") {
    return "scroll";
  }
  return pagingMode === "scroll" ? "scroll" : "paged";
}
```

2. **設定画面（`SCR-05`）の整理**:
   - 設定画面（`SCR-05`）の「ページ送り」設定セレクター（`data-testid="paging-mode-select"`）の選択肢を **「ページめくり（縦書き時）」「連続スクロール」の 2 択** に整理する。
   - 横書き（`horizontal-tb`）選択時はセレクターを無効化（`disabled`）し、「※横書き時は連続スクロール固定となります」という案内注記（`data-testid="paging-mode-note"`）を表示する。
   - DB の既存値 `'auto'` / `'paged'` はともに「ページめくり（縦書き時）」として透過的に扱う（DB スキーマ変更なし、完全後方互換）。

### 2.2 縦書きページめくり時のタッチ制御と前後話移動（`touch-action: none` ＋ ラバーバンドスワイプ ＋ 端2段階タップ）

1. **ジェスチャー領域の `touch-action: none`（`touch-none`）適用**:
   - `ReaderPage.tsx` のジェスチャー捕捉領域（`<main>` およびルートコンテナ）に CSS `touch-action: none`（Tailwind `touch-none`）を適用し、Android WebView（モバイル Chromium）のネイティブジェスチャーによる `pointercancel` 発火を完全に防止する。
   - これにより、指の動きにリアルタイムに水平追従するダイレクトマニピュレーション（`slideOffsetPx`）、30% 以上ドラッグ離上でのページ確定、および 30% 未満でのスナップバック復帰が実機上で確実に動作する。
2. **端ページでのラバーバンドスワイプ前後話移動**:
   - 最終ページでさらに「次へ」（左スワイプ）、第 1 ページで「前へ」（右スワイプ）ドラッグした際、ゴム抵抗感（変位減衰）を付与し、30% 以上引いた状態で案内バッジ（`data-testid="reader-episode-boundary-hint"`、「指を離して次の話へ／前の話へ」）を表示。指離しで次話先頭（前話末尾）へシームレス遷移する。
3. **端ページでの 2 段階タップによる前後話移動（誤遷移防止）**:
   - スワイプだけでなくタップ操作でもエピソードを読み進められるよう、端ページでの左右 20% タップによる前後話移動をサポートする。
   - **2段階タップの遷移シーケンス**:
     - 最終ページで次ページタップ領域（左 20%）を押下した 1 回目（または第 1 ページで前ページタップ領域［右 20%］を押下した 1 回目）: 即座に遷移せず、案内ヒント「もう一度タップで次の話へ／前の話へ」（`data-testid="reader-episode-boundary-hint"`）を画面中央に表示する。
     - 案内ヒント表示中（2.5 秒以内）に同方向タップが再入力された 2 回目: 直ちに「次の話へ」（または「前の話へ」）遷移（`TR-05`）を実行する。
     - 2.5 秒以内に再タップがなかった場合は、案内ヒントを自動消去し、タップ回数状態をリセットする。

### 2.3 連続スクロール時の前後話移動（先頭「前の話へ」・末尾「次の話へ」ボタン配置 ＋ 2段階スワイプ実機対応）

1. **本文先頭・末尾の前後話移動ボタン配置**:
   - 実効 `scroll` モード時（縦書き連続スクロールおよび横書き連続スクロール）、本文の自然な流れで前後のエピソードへ移動できるよう、本文要素の前後にボタンを配置する：
     - **本文先頭**: `data-testid="reader-scroll-prev-chapter"`「前の話へ」ボタン（第 1 話では `disabled`、クリックで `onPrevChapter()` を呼び出す）。
     - **本文末尾**: `data-testid="reader-scroll-next-chapter"`「次の話へ」ボタン（最終話では `disabled`、クリックで `onNextChapter()` を呼び出す）。
2. **スクロール端での 2 段階スワイプ実機対応**:
   - 連続スクロールの端（先頭または末尾）でのスワイプ操作による前後話移動について、Android 実機のネイティブスクロール時 `pointercancel` に阻害されないよう Touch Event / スクロール端状態監視を改善し、1 回目の端到達操作で案内ヒント「もう一度スワイプで次の話へ／前の話へ」を表示、2.5 秒以内の 2 回目操作で前後話へ遷移する。

### 2.4 縦書き CSS マルチカラム 1 ページ組版と総ページ数・ページ切替（文字途切れ・総ページ数ズレの根絶）

1. **縦書き CSS マルチカラム 1 ページ組版**:
   - 縦書き `paged` 表示時、ブラウザ標準の CSS マルチカラム組版（`writing-mode: vertical-rl`、`columns: 1`、`column-gap: 48px`、`column-fill: auto`）を適用する。
   - 1 ページ表示領域の段幅 `columnWidth: (pageWidth - 48)px`、段高 `columnHeight: (pageHeight - 48)px` を明示指定し、1 ページ内に収まる整数本の行だけを自動配置することで、**文字・ルビ・傍点の途中でのページ分断（縦切断）を完全に防止** する。
2. **マルチカラムのページ切替（`translateY`）とスワイプ追従（`translateX`）の分離**:
   - 縦書きマルチカラムでは、後続ページ（カラム）は CSS 仕様上 `Y` 軸（垂直方向）に段送りされて配置される。
   - したがって、確定したページ位置はマルチカラムコンテナの `translateY(-(currentPage - 1) * pageStride)`（`pageStride = pageHeight`）によって軽快に切り替える。
   - 一方でスワイプドラッグ中は、ユーザーの指の水平移動に合わせてリアルタイム横追従（`translateX(slideOffsetPx)`）およびスナップバックアニメーションを適用する。
3. **総ページ数（`totalPages`）の正確な計測と縮小バグ防止**:
   - 総ページ数は、`translateX` 変位に影響されないマルチカラム要素の `scrollHeight` から算出する：
     $$\text{totalPages} = \max\left(1, \text{round}\left(\frac{\text{scrollHeight} + \text{gap}}{\text{pageStride}}\right)\right)$$
   - 前後話遷移時（`chapterIndex` 変更時）やエピソード本文変更時は、前エピソードのアニメーション変位やトランジションの影響を排除するため、即座に変位を `0` にリセットした上で `scrollHeight` を計測する。
   - `currentPage > 1` の状態でリサイズや再評価が発生しても、`scrollHeight` は `translateX` 変位と直交（`Y` 軸）しているため縮小せず、話の途中より先が見られなくなるバグを根本解決する。

### 2.5 申し送り事項（`HO-15`, `HO-22`, `HO-23`）の精算計画

- **`HO-15`（APK 上書きインストール実証）**: 実機検証にて確認完了済みのため、`docs/quality/bug-and-handover-log.md` において `Resolved` に更新する。
- **`HO-22`（Google Drive クラウド同期実機疎通）**: 実機検証にて確認完了済みのため、`docs/quality/bug-and-handover-log.md` において `Resolved` に更新する。
- **`HO-23`（リーダー縦書きページめくり実機検証）**: 本 Issue #168 の MK 実装・IT 検証および実機確認完了をもって、Step 5 において `Resolved` とする。

---

## 3. 影響する App 全体正本の一覧と変更概要

| 対象正本ファイル                       | フロントマター `status` | 主な改修内容                                                                                                                                                                                      |
| :------------------------------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/specs/requirements.md`           | `Review (#168)`         | `SYS-REQ-11` を更新：縦書き 1 ページマルチカラム組版（文字途切れ防止）、`touch-action: none` 制御、横書きスクロール固定、本文先頭/末尾前後話ボタン、端ページ 2 段階タップによる前後話遷移を追加。 |
| `docs/specs/architecture.md`           | `Review (#168)`         | Reader Layer のコンポーネント責務・CSS マルチカラム組版契約（`ReaderView`）およびジェスチャー制御契約（`useReaderGestures`）を更新。                                                              |
| `docs/specs/screen-transitions.md`     | `Review (#168)`         | `SCR-03` / `SCR-05` および `TR-05` を更新：端 2 段階タップ、本文先頭/末尾ボタン、横書き連続スクロール固定を明記。                                                                                 |
| `docs/specs/features/reader-view.md`   | `Review (#168)`         | 縦書き CSS マルチカラム組版・総ページ数計測、`touch-action: none`、本文先頭/末尾前後話ボタン、端ページ 2 段階タップ、受入条件（`AC-RD-15`〜`AC-RD-19`）および `SCN-01` 結合シナリオを更新。       |
| `docs/specs/features/settings.md`      | `Review (#168)`         | ページ送りセレクターを「ページめくり（縦書き時）」「連続スクロール」の 2 択に整理し、横書き選択時の `disabled` 化と注記表示を定義。受入条件 `AC-ST-13` を更新。                                   |
| `docs/specs/db-schema.md`              | `Review (#168)`         | `reader_settings.paging_mode` の解説を更新（`'auto'` / `'paged'` は「縦書き時はページめくり、横書き時はスクロール固定」として透過的に扱う旨を追記、DDL スキーマ変更なし）。                       |
| `docs/quality/bug-and-handover-log.md` | `Approved`              | `HO-15` および `HO-22` を `Resolved` に更新。`HO-23` の解決先 Issue を `#168` に更新。                                                                                                            |

---

## 4. テスト計画（UT / VRT / IT）

### 4.1 単体テスト（Vitest TDD）

- **`useReader.test.ts`**:
  - `resolveEffectivePagingMode`: 横書き（`horizontal-tb`）時は `pagingMode`（`auto` / `paged` / `scroll`）に関わらず常に `"scroll"` を返すこと。
  - 縦書き時は `auto` / `paged` で `"paged"`、`scroll` で `"scroll"` を返すこと。
- **`useSettings.test.tsx` / `SettingsPage.test.tsx`**:
  - 設定画面で「ページめくり（縦書き時）」「連続スクロール」の 2 択が表示され、選択変更時に永続化されること。
  - 横書き選択時にセレクターが `disabled` となり、横書きスクロール固定の注記が表示されること。
- **`ReaderView.test.tsx`**:
  - 縦書き `paged` 時、CSS マルチカラムスタイル（`columns: 1`, `columnGap: 48px`, `writingMode: vertical-rl`）が正しく適用されること。
  - スワイプ中は `translateX(slideOffsetPx)`、確定後は `translateY(-(currentPage - 1) * pageStride)` で変位が制御されること。
  - `scrollHeight` から算出される `totalPages` がエピソード遷移直後やリサイズ時、2ページ目以降でも縮小しないこと。
  - 連続スクロールモード時、本文先頭に「前の話へ」ボタン、本文末尾に「次の話へ」ボタンが描画され、第1話・最終話で適切に `disabled` となること。
- **`useReaderGestures.test.ts` / `ReaderPage.test.tsx`**:
  - ルート要素および `<main>` に `touch-action: none` が付与されていること。
  - 最終ページでの左 20% タップ（または第 1 ページでの右 20% タップ）の 1 回目で案内ヒントが表示され、2.5 秒以内の 2 回目タップで次話（前話）へ遷移すること。
  - 2.5 秒経過後にヒントが自動消去され、リセットされること。
  - 連続スクロールモードでの先頭/末尾ボタン押下により `onPrevChapter` / `onNextChapter` が発火すること。

### 4.2 Storybook / VRT

- `SettingsPage`: 2 択セレクター、横書き時 disabled 注記表示の Storybook ストーリーおよびスナップショット。
- `ReaderView`: 縦書きマルチカラム組版（ルビ・傍点を含む複数ページ文章）、本文先頭/末尾ボタン（スクロール時）の Storybook ストーリーおよびスナップショット（1280px / 375px）。
- `ReaderPage`: 端 2 段階タップ案内ヒント表示状態の Storybook ストーリーおよびスナップショット。

### 4.3 結合テスト（Playwright IT）

- `test/it/scenarios/scn01-poc-vertical-reader.spec.ts`:
  - 縦書き 1 ページマルチカラム組版で文字途切れが発生しないこと。
  - 端 2 段階タップによる次話遷移。
  - 横書き選択時の連続スクロール固定動作。
  - スクロールモード時の本文先頭「前の話へ」・末尾「次の話へ」ボタンによる前後話遷移。
  - 全シナリオ（`SCN-01`〜`SCN-05`）の 100% PASS。

---

## 5. 実装 Sub-issue 分割計画（推奨粒度 200〜400行目安）

|    Sub-issue    | 種別 | タイトル                                                                                                                   | 主な作業範囲                                                                                                                             |
| :-------------: | :--: | :------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Sub-issue ①** |  MK  | 横書きスクロール限定化 ＆ 設定画面（SCR-05）の2択整理                                                                      | `resolveEffectivePagingMode` 横書きスクロール固定化、`SettingsPage` 2択化＋横書き disabled 注記、単体テスト、Storybook、VRT              |
| **Sub-issue ②** |  MK  | 縦書き CSS マルチカラム 1 ページ組版 ＆ 総ページ数計測・文字途切れ解消                                                     | `ReaderView` 縦書き CSS マルチカラム（`columns: 1`）適用、`translateY` ページ切替、`scrollHeight` 総ページ数計測・安定化、Storybook、VRT |
| **Sub-issue ③** |  MK  | 実機タッチ制御（touch-action: none）・端2段階タップ/スワイプ ＆ 本文先頭・末尾前後話ボタン                                 | `touch-action: none`、端ページ 2 段階タップ案内ヒント・遷移、スクロール時本文先頭/末尾ボタン配置、単体テスト、Storybook、VRT             |
| **Sub-issue ④** |  IT  | Playwright 全体回帰テスト（SCN-01〜SCN-05）更新・実ブラウザ検証 ＆ 申し送り精算（HO-15, HO-22, HO-23）・差分仕様アーカイブ | `SCN-01` 更新、全 IT 100% PASS 確認、`HO-15`/`HO-22`/`HO-23` 精算、差分仕様アーカイブ移動、親 Issue #168 完了                            |

---

## 6. 申し送り事項追跡（`HO-xx`）

|   ID    | 起票元 | 内容                                                                              |          解決先          |    状態    |
| :-----: | :----: | :-------------------------------------------------------------------------------- | :----------------------: | :--------: |
| `HO-15` |  #78   | Android 実機での APK 上書きインストール実証                                       |         実機検証         | `Resolved` |
| `HO-22` |  #120  | Google Drive appDataFolder クラウド同期の Android 実機疎通検証                    |         実機検証         | `Resolved` |
| `HO-23` |  #122  | リーダー縦書きページめくりにおける Android 実機でのタッチ・スワイプおよび組版検証 | Issue #168 / Sub-issue ④ |   `Open`   |
