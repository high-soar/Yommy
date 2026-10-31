---
type: spec-feature
title: "小説リーダー画面仕様書（SCR-03: Novel Reader）"
description: "小説本文の全画面（100dvh）縦書き・横書き組版表示、ページめくり（タップ/Kindle様式スワイプ送り）と連続スクロール切替、エピソード端シームレス遷移、最下部タッチによる下部オーバーレイ（ReaderBottomOverlay: 前後話ナビ＋下部タブ）、ルビ・傍点描画、4カラーテーマ・文字サイズ・行間設定の永続化、前後エピソード遷移、未キャッシュ話のオンデマンド取得、既読・しおり・進捗率の自動保存/復元、およびSCN-01統合シナリオの正本仕様。"
status: "Review (#122)"
updated: "2026-10-31"
tags:
  - reader
  - scr-03
  - vertical-writing
  - ruby
  - bouten
  - theme
  - typography
  - bookmark
  - scn01
  - fullscreen
  - bottom-overlay
  - four-tabs
  - prefetch
  - batch-cache
  - cache-rules
  - cloud-sync
  - google-drive
  - paging
  - swipe
  - gestures
  - kindle
  - snap-back
related_specs:
  - docs/specs/changes/issue-122-reader-page-turning.md
  - docs/specs/changes/archive/issue-120-cloud-sync-google-drive.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/specs/db-schema.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/settings.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/archive/issue-123-reader-bottom-overlay-ui-improvement.md
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
  - docs/specs/changes/archive/issue-80-bookshelf-update-check-and-sort.md
  - docs/specs/changes/archive/issue-81-prefetch-and-cache-rules.md
  - docs/specs/changes/archive/issue-50-fullscreen-shell-and-settings.md
  - docs/specs/changes/archive/issue-52-reader-fullscreen-and-bottom-overlay.md
  - docs/specs/changes/archive/issue-12-bookshelf-and-routing.md
  - docs/specs/changes/archive/issue-13-novel-detail-and-toc.md
  - docs/specs/changes/archive/issue-14-reader-navigation-bookmark-settings.md
related_tests:
  - src/App.test.tsx
  - src/features/reader/hooks/useReader.test.ts
  - src/features/reader/components/ReaderChapterNav.test.tsx
  - src/features/reader/components/ReaderBottomOverlay.test.tsx
  - src/features/reader/components/ReaderView.test.tsx
  - src/features/reader/components/ReaderPage.test.tsx
  - src/features/reader/components/ReaderContainer.test.tsx
  - test/vrt/vrt.spec.ts
  - test/it/smoke.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
  - test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts
  - test/it/scenarios/scn04-prefetch-and-cache.spec.ts
---

# 小説リーダー画面仕様書（SCR-03）

本ドキュメントは、Yommy における小説本文閲覧（**`SCR-03`: ルート `/novels/:novelId/chapters/:chapterIndex`**）の全画面テキスト組版描画、最下部タッチによる下部オーバーレイ（前後話ナビ＋下部タブ）、しおり・スクロール進捗率・既読状態の自動保存、およびブラウザ環境におけるローカル永続化の仕様を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 小説リーダー画面（`SCR-03`、ルートパス `/novels/:novelId/chapters/:chapterIndex`）
- **対応要件**:
  - `SYS-REQ-02`（本文取得・オフライン閲覧・未キャッシュ話オンデマンド取得、キャッシュTTL 7日間・短タイムアウトフォールバック）
  - `SYS-REQ-03`（レートリミット・バックグラウンド取得：読書中の5話自動先読み、1.5秒間隔ウェイト、話数移動/離脱時の AbortController 中断）
  - `SYS-REQ-04`（作品詳細・リーダー閲覧による本棚「NEW」バッジ自動解除）
  - `SYS-REQ-06`（クラウド同期連携：話数遷移・既読更新時の自動 Push、2〜3秒デバウンス制御）
  - `SYS-REQ-07`（ルビ `<ruby>`・傍点 `<em class="bouten">` のサニタイズ済み組版描画）
  - `SYS-REQ-08`（全画面 `100dvh` での縦書き `vertical-rl` / 横書き `horizontal-tb` 表示）
  - `SYS-REQ-09`（文字サイズ `fontSizePx`・行間 `lineHeight` のカスタマイズと永続化 ※設定画面 `SCR-05` で変更、余白・フォント種別は `v0.4`）
  - `SYS-REQ-10`（4カラーテーマ `light` / `sepia` / `dark` / `black` 切り替え ※設定画面 `SCR-05` で変更）
  - `SYS-REQ-11`（全画面表示でのページ送りモード［自動/ページめくり/スクロール］切替、1ページ組版［行途切れ防止］、横スライドアニメーション、ページインジケーター表示、Kindle様式のリアルタイム指追従スワイプ・30%規定値スナップバック・画面左右約20%タップ送り、画面中央タップオーバーレイ開閉、エピソード端でのシームレス前後話遷移［ラバーバンド離上遷移およびスクロール2段階操作遷移］）
  - `SYS-REQ-12`（しおり話数 `bookmark_chapter_index`・本文進捗率 `bookmark_scroll_progress` の自動保存・復元、ページめくりモードとスクロールモードの進捗連動、OSバックキー・下部タブ遷移時の `flushBookmark` 実行、および既読フラグ `is_read` の自動更新）
  - `SYS-REQ-16`（100dvh 全画面シェル・下部タブバー連携・OSバックキー論理階層復帰）
  - `SYS-REQ-20`（下部4タブバー・リーダーオーバーレイ4タブ化）
- **関連画面遷移**:
  - `TR-01`（下部オーバーレイの4タブ「本棚 `/`」「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」タップによる各画面への遷移）
  - `TR-01b`（下部オーバーレイの「本棚」タブタップによる本棚トップ画面 `SCR-01` `/` へのダイレクト遷移）
  - `TR-03`（本棚画面 `SCR-01` の「続きから読む」から `SCR-03` への直接遷移）
  - `TR-04`（作品詳細・目次画面 `SCR-02` のエピソード選択または読書開始ボタンから `SCR-03` への遷移）
  - `TR-05`（`SCR-03` 内の下部オーバーレイ「前の話へ」「次の話へ」操作による同一作品の前後エピソード `chapterIndex ± 1` への遷移）
  - `TR-06`（OS バックキーまたは下部オーバーレイの4タブ遷移によりスクロール進捗率を保存して `SCR-02` `/novels/:novelId`、または各タブへ遷移）
- **対象外スコープ（後続 Milestone）**:
  - ハードウェア音量キー（`enableVolumeKeyPaging`）による1画面ジャンプ送り（Milestone `v0.4`：`SYS-REQ-11` 拡張、本Issueでは対象外）
  - 3D カール等の過剰な描画エフェクト（2D 横スライドアニメーションを採用）
  - 画面余白（`pageMarginPx`）・フォント種別（`fontFamily`）の UI カスタマイズ（Milestone `v0.4`：`SYS-REQ-09` 拡張）
  - 取得失敗時の内蔵 WebView フォールバック遷移 `TR-10`（Milestone `v0.4`：`SYS-REQ-13`）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/reader/` 配下を以下のモジュール構成とします（`ReaderToolbar` は Issue #50 で廃止され設定画面 `SCR-05` へ移設、`ReaderBottomOverlay` を新設して全画面没入型 UI とします）。

```text
src/features/reader/
├── hooks/
│   ├── useReader.ts                       # エピソード取得・オンデマンド通信・既読/しおり保存・組版設定永続化フック
│   └── useReader.test.ts                  # フック単体テスト（Vitest）
└── components/
    ├── ReaderBottomOverlay.tsx            # 【新設】前後話ナビ＋下部タブを統合したスライドインオーバーレイ（Presentational）
    ├── ReaderBottomOverlay.stories.tsx    # 【新設】Storybookストーリー（表示/非表示/第1話/最終話）
    ├── ReaderBottomOverlay.test.tsx       # 【新設】単体テスト（Portable Stories）
    ├── ReaderChapterNav.tsx               # 前話へ / 現在話数 / 次話へナビゲーションバー（Presentational、オーバーレイ内で再利用）
    ├── ReaderChapterNav.stories.tsx
    ├── ReaderChapterNav.test.tsx
    ├── ReaderView.tsx                     # 【改修】全画面本文組版・ルビ/傍点描画・縦横スクロール進捗率算出/復元（Presentational）
    ├── ReaderView.stories.tsx
    ├── ReaderView.test.tsx
    ├── ReaderPage.tsx                     # 【改修】全画面レイアウト、最下部タッチ検知、オーバーレイ開閉・自動非表示制御（Presentational）
    ├── ReaderPage.stories.tsx
    ├── ReaderPage.test.tsx
    ├── ReaderContainer.tsx                # 【改修】ServiceProvider / Router / useReader を接続し、タブ遷移・OSバックキー時のしおり保存を連携（Container）
    ├── ReaderContainer.stories.tsx
    ├── ReaderContainer.test.tsx
    ├── ReaderToolbar.tsx                  # （Issue #50 で廃止・設定画面 SCR-05 へ移設）
    ├── ReaderToolbar.stories.tsx
    └── ReaderToolbar.test.tsx
```

---

## 3. 各コンポーネント・フックの詳細契約

### 3.1 `ReaderToolbar`（組版設定操作ツールバー：Issue #50 で設定画面へ移設）

> [!NOTE]
> `ReaderToolbar` は Milestone `v0.1` で画面上部に常時表示されていましたが、読書没入感向上のため Milestone `v0.2`（Issue #50）において廃止され、組版設定機能（文字サイズ・行間・テーマ・縦横切替）は設定画面（`SCR-05: /settings`）へ完全移設されました。

---

### 3.2 `ReaderChapterNav`（前後エピソード遷移ナビゲーションバー）

同一作品の「前の話へ」「次の話へ」の連続遷移（`TR-05`）と現在話数インジケーターを提供する Presentational コンポーネントです（`ReaderBottomOverlay` の上段として内包されます）。

#### プロパティ契約（`ReaderChapterNavProps`）

| プロパティ名    | 型           | 必須 | 既定値  | 説明                                   |
| :-------------- | :----------- | :--- | :------ | :------------------------------------- |
| `chapterIndex`  | `number`     | 必須 | -       | 現在表示中のエピソード連番（1始まり）  |
| `totalChapters` | `number`     | 必須 | -       | 作品の全エピソード数                   |
| `isLoading`     | `boolean`    | 任意 | `false` | エピソード取得中フラグ                 |
| `onPrevChapter` | `() => void` | 必須 | -       | 「前の話へ」ボタン押下時のコールバック |
| `onNextChapter` | `() => void` | 必須 | -       | 「次の話へ」ボタン押下時のコールバック |

#### セマンティック属性と境界制御ルール

- **ルート要素**: `data-testid="reader-chapter-nav"`
- **前の話へボタン**: `data-testid="reader-prev-chapter"`（ラベル: `前の話へ`）
  - `chapterIndex <= 1` または `isLoading === true` の場合は `disabled` とする。
  - 活性時のクリックで `onPrevChapter()` を呼び出す。
- **現在話数インジケーター**: `data-testid="reader-chapter-indicator"`
  - `第 {chapterIndex} 話 / 全 {totalChapters} 話` の形式で表示する。
- **次の話へボタン**: `data-testid="reader-next-chapter"`（ラベル: `次の話へ`）
  - `chapterIndex >= totalChapters`（`totalChapters <= 0` を含む）または `isLoading === true` の場合は `disabled` とする。
  - 活性時のクリックで `onNextChapter()` を呼び出す。

---

### 3.3 `ReaderBottomOverlay`（下部スライドインオーバーレイ）

画面最下部タッチにより下からスライドイン表示され、前後話ナビゲーションと下部タブバー（本棚/検索/ランキング/設定の4タブ）を一体化して提供する Presentational コンポーネントです。

#### プロパティ契約（`ReaderBottomOverlayProps`）

| プロパティ名    | 型                         | 必須 | 既定値        | 説明                                                                              |
| :-------------- | :------------------------- | :--- | :------------ | :-------------------------------------------------------------------------------- |
| `isOpen`        | `boolean`                  | 必須 | -             | オーバーレイの表示・展開状態（`true` でスライドイン表示、`false` で画面外へ退避） |
| `chapterIndex`  | `number`                   | 必須 | -             | 現在表示中のエピソード連番（1始まり）                                             |
| `totalChapters` | `number`                   | 必須 | -             | 作品の全エピソード数                                                              |
| `isLoading`     | `boolean`                  | 任意 | `false`       | エピソード通信中フラグ                                                            |
| `activeTab`     | `BottomTab`                | 任意 | `'bookshelf'` | リーダー画面の論理所属タブ（探索元または `'bookshelf'` をアクティブ表示）         |
| `onPrevChapter` | `() => void`               | 必須 | -             | 「前の話へ」ボタン押下時のコールバック                                            |
| `onNextChapter` | `() => void`               | 必須 | -             | 「次の話へ」ボタン押下時のコールバック                                            |
| `onSelectTab`   | `(tab: BottomTab) => void` | 任意 | -             | 下部タブ（本棚 / 検索 / ランキング / 設定）押下時のコールバック                   |

#### セマンティック属性とスタイル仕様

- **ルート要素**: `data-testid="reader-bottom-overlay"`、`aria-hidden={!isOpen}`
- **閉じる操作の一本化**: 旧仕様の閉じるボタン（`reader-bottom-overlay-close`）および `onClose` プロパティは廃止され、本文エリアタップによるオーバーレイ自動非表示に一本化される。
- **配置・アニメーション**: 画面下端固定（`fixed bottom-0 left-0 right-0 z-40`）、背景にはテーマに合わせた半透明または不透明背景（例: `bg-white/95 dark:bg-zinc-900/95 shadow-lg border-t border-zinc-200 dark:border-zinc-800`）、開閉時のなめらかなスライド（`transition-transform duration-200 ease-in-out`、`isOpen ? 'translate-y-0' : 'translate-y-full'`）。
- **上段（エピソードナビ）**: `ReaderChapterNav`（`data-testid="reader-chapter-nav"`）を描画し、前話/次話遷移と話数インジケーターを提供。
- **下段（下部タブバー）**: `data-testid="reader-bottom-tabs"`（`role="tablist"`）を描画し、各タブボタン `data-testid="reader-bottom-tab-bookshelf"`（「本棚」/ activeTab に応じて `aria-selected="true"` 表示）、`data-testid="reader-bottom-tab-search"`（「検索」）、`data-testid="reader-bottom-tab-ranking"`（「ランキング」）、`data-testid="reader-bottom-tab-settings"`（「設定」）を表示。各タブボタンはモバイル（375px等）でのテキスト折り返しを防止するため、上アイコン・下テキスト（縦並び `flex-col sm:flex-row` ＋ `whitespace-nowrap`、`text-xs sm:text-sm`）でスタイリングされる。

---

### 3.4 `ReaderView`（本文組版レンダリング ＆ スクロール進捗制御）

サニタイズ済み本文 HTML の縦書き・横書き組版、ルビ・傍点描画、テーマ・文字サイズ・行間適用、および全画面（`h-full w-full`）での縦横双方のスクロール進捗率（`0.0〜1.0`）算出・復元を担う Presentational コンポーネントです。

#### プロパティ契約（`ReaderViewProps`）

| プロパティ名             | 型                             | 必須 | 既定値          | 説明                                                                                 |
| :----------------------- | :----------------------------- | :--- | :-------------- | :----------------------------------------------------------------------------------- |
| `title`                  | `string`                       | 任意 | -               | 作品タイトル                                                                         |
| `chapterTitle`           | `string`                       | 任意 | -               | 各話サブタイトル                                                                     |
| `bodyHtml`               | `string`                       | 必須 | -               | サニタイズ済み本文 HTML（ルビ `<ruby>`, 傍点 `<em class="bouten">` 含む）            |
| `writingMode`            | `WritingMode`                  | 任意 | `'vertical-rl'` | 組み方向（`'vertical-rl'` または `'horizontal-tb'`）                                 |
| `theme`                  | `ReaderTheme`                  | 任意 | `'light'`       | 背景・文字色テーマ（`'light'`, `'sepia'`, `'dark'`, `'black'`）                      |
| `fontSizePx`             | `number`                       | 任意 | `18`            | 文字サイズ (px)                                                                      |
| `lineHeight`             | `number`                       | 任意 | `1.8`           | 行間倍率                                                                             |
| `initialScrollProgress`  | `number`                       | 任意 | `0`             | 初期復元する進捗率（`0.0 〜 1.0`）                                                   |
| `pagingMode`             | `ReaderPagingMode`             | 任意 | `'auto'`        | ページ送りモード（`'auto'`, `'paged'`, `'scroll'`、v0.4 Issue #122）                 |
| `currentPage`            | `number`                       | 任意 | `1`             | ページめくり表示時の現在ページ番号（1始まり）                                        |
| `totalPages`             | `number`                       | 任意 | `1`             | ページめくり表示時の総ページ数                                                       |
| `slideOffsetPx`          | `number`                       | 任意 | `0`             | スワイプドラッグ中のリアルタイムスライド変位量 (px)                                  |
| `isAnimating`            | `boolean`                      | 任意 | `false`         | ページ遷移アニメーション中フラグ                                                     |
| `onTotalPagesChange`     | `(totalPages: number) => void` | 任意 | -               | DOM寸法・組版計算により総ページ数が確定・変化した際のコールバック                    |
| `onScrollProgressChange` | `(progress: number) => void`   | 任意 | -               | スクロールまたはページ変更時に算出された進捗率（`0.0 〜 1.0`）を通知するコールバック |

#### セマンティック属性と組版・スクロール仕様

- **テスト用・検証用属性**:
  - `data-testid="reader-view"`
  - `data-writing-mode`: 現在の組み方向（`"vertical-rl"` または `"horizontal-tb"`）
  - `data-theme`: 現在のカラーテーマ（`"light"`, `"sepia"`, `"dark"`, `"black"`）
  - `data-font-size`: 現在の文字サイズ数値（`String(fontSizePx)`）
  - `data-line-height`: 現在の行間倍率（`String(lineHeight)`）
  - `data-paging-mode`: 設定されたページ送りモード（`"auto"`, `"paged"`, `"scroll"`）
  - `data-effective-paging-mode`: 実効ページ送りモード（`"paged"` または `"scroll"`）
  - `data-current-page`: ページめくり表示時の現在ページ番号
  - `data-total-pages`: ページめくり表示時の総ページ数
- **実効ページ送りモード（`effectivePagingMode`）の算出**:
  - `pagingMode === 'paged'`: 常に `"paged"`
  - `pagingMode === 'scroll'`: 常に `"scroll"`
  - `pagingMode === 'auto'`: `writingMode === 'vertical-rl' ? "paged" : "scroll"`
- **1ページ単位の組版（実効 `"paged"` 時）**:
  - 画面端で行が縦半分に途切れることを防ぐため、ビューポート寸法に応じた 1 ページ区切りの組版（マルチカラム `column-width` / `column-gap` / `column-fill: auto`、またはコンテナ寸法に基づくページ分割スライド）を適用する。
  - ページ送り時は、横スライドアニメーション（150〜250ms、`transition: transform 200ms ease-out`）でなめらかに遷移する。
  - ドラッグ操作中は `slideOffsetPx` に応じてリアルタイムに表示が水平追従スライドする。
  - 画面隅に控えめなページインジケーター（`data-testid="reader-page-indicator"`、例: `3 / 12`）を表示する。
- **連続スクロール仕様（実効 `"scroll"` 時）**:
  - 縦書き時: CSS `writing-mode: vertical-rl`、`text-orientation: mixed`、水平スクロール（`overflow-x-auto overflow-y-hidden`）。
  - 横書き時: CSS `writing-mode: horizontal-tb`、垂直スクロール（`overflow-y-auto overflow-x-hidden`）。
- **共通スタイル・禁則処理**:
  - フォント: 日本語明朝体（`font-serif`）をベースとし、禁則処理（`line-break: strict; word-break: break-word`）を適用。
  - ルビ・傍点: `<ruby>` はブラウザ標準のルビ表示、`<em class="bouten">` は CSS `text-emphasis: filled sesame`（セサミ傍点）で描画。
  - Storybook / VRT バリエーション: 4カラーテーマ・縦書き/横書き・ページめくり/スクロール双方の検証ストーリーを備える。
- **縦書き・横書き双方のスクロール進捗率（`0.0 〜 1.0`）算出・復元アルゴリズム**:
  1. **横書き（`horizontal-tb`、上→下の垂直スクロール）**:
     - 最大スクロール量: `maxScroll = element.scrollHeight - element.clientHeight`
     - 進捗率算出: `progress = maxScroll > 0 ? Math.min(1, Math.max(0, element.scrollTop / maxScroll)) : 0`
     - 位置復元: `maxScroll > 0` のとき `element.scrollTop = clampedInitialProgress * maxScroll`（`maxScroll <= 0` のときは `0`）
  2. **縦書き（`vertical-rl`、右→左の水平スクロール）**:
     - Chromium 等のモダンブラウザにおける `writing-mode: vertical-rl` では、先頭（右端）が `scrollLeft = 0` であり、左方向へ読み進めるにつれて `scrollLeft` が負の値（`0` 〜 `-maxScroll`）となる。
     - 最大スクロール量: `maxScroll = element.scrollWidth - element.clientWidth`
     - 進捗率算出: `progress = maxScroll > 0 ? Math.min(1, Math.max(0, Math.abs(element.scrollLeft) / maxScroll)) : 0`
     - 位置復元: `maxScroll > 0` のとき `element.scrollLeft = -clampedInitialProgress * maxScroll`（`maxScroll <= 0` のときは `0`）
  3. **ページめくり表示（実効 `"paged"`）時の進捗率（`0.0 〜 1.0`）算出・復元アルゴリズム**:
     - 総ページ数 $P_{total}$、現在ページ $P_{current}$（1始まり）のとき：
       - 進捗率算出: `progress = totalPages > 1 ? (currentPage - 1) / (totalPages - 1) : 0`
       - ページ復元: `targetPage = totalPages > 1 ? Math.round(clampedInitialProgress * (totalPages - 1)) + 1 : 1`
  4. **位置復元の発火トリガー条件**:
     - マウント時、および `initialScrollProgress`・`bodyHtml`（エピソード切替時）・`writingMode`（縦書き/横書き切替時）・`pagingMode`（ページ送りモード切替時）のいずれかが変化したタイミングで、進捗率に基づく位置復元を実行する。

---

### 3.5 `ReaderPage`（リーダー画面 Presentational コンポーネント）

全画面本文（`ReaderView`）と最下部タッチ連動の下部オーバーレイ（`ReaderBottomOverlay`）、Kindle様式のジェスチャー操作、エピソード境界シームレス遷移、および状態別表示（ローディング・エラー・空状態）を統合する画面レイアウトコンポーネントです。

#### プロパティ契約（`ReaderPageProps`）

| プロパティ名             | 型                             | 必須 | 説明                                                  |
| :----------------------- | :----------------------------- | :--- | :---------------------------------------------------- |
| `novel`                  | `NovelRecord \| null`          | 必須 | 現在の作品レコード                                    |
| `chapter`                | `ChapterRecord \| null`        | 必須 | 現在のエピソードレコード                              |
| `chapterIndex`           | `number`                       | 必須 | 現在のエピソード連番（1始まり）                       |
| `totalChapters`          | `number`                       | 必須 | 作品の全エピソード数                                  |
| `writingMode`            | `WritingMode`                  | 必須 | 現在の組み方向                                        |
| `theme`                  | `ReaderTheme`                  | 必須 | 現在のカラーテーマ                                    |
| `fontSizePx`             | `number`                       | 必須 | 現在の文字サイズ (px)                                 |
| `lineHeight`             | `number`                       | 必須 | 現在の行間倍率                                        |
| `initialScrollProgress`  | `number`                       | 必須 | 初期復元する進捗率（`0.0 〜 1.0`）                    |
| `pagingMode`             | `ReaderPagingMode`             | 任意 | ページ送りモード（省略時: `'auto'`、v0.4 Issue #122） |
| `currentPage`            | `number`                       | 任意 | ページめくり表示時の現在ページ番号（省略時: `1`）     |
| `totalPages`             | `number`                       | 任意 | ページめくり表示時の総ページ数（省略時: `1`）         |
| `isLoading`              | `boolean`                      | 必須 | 読み込み・通信中フラグ                                |
| `error`                  | `string \| null`               | 任意 | エラーメッセージ文字列                                |
| `activeTab`              | `BottomTab`                    | 任意 | リーダー画面の論理所属タブ（既定値: `"bookshelf"`）   |
| `onPrevChapter`          | `() => void`                   | 必須 | 「前の話へ」押下時（`TR-05`）                         |
| `onNextChapter`          | `() => void`                   | 必須 | 「次の話へ」押下時（`TR-05`）                         |
| `onPageChange`           | `(targetPage: number) => void` | 任意 | タップ・スワイプによるページ送り確定時のコールバック  |
| `onTotalPagesChange`     | `(totalPages: number) => void` | 任意 | 総ページ数確定・変化時のコールバック                  |
| `onScrollProgressChange` | `(progress: number) => void`   | 必須 | 本文スクロール／ページ進捗変化時                      |
| `onSelectTab`            | `(tab: BottomTab) => void`     | 任意 | 下部タブ押下時                                        |
| `initialOverlayOpen`     | `boolean`                      | 任意 | `false`（エラー/空状態時は `true`）                   |

#### セマンティック属性とレイアウト・ジェスチャー仕様

- **画面ルート**: `data-testid="reader-page"`（外枠パディングなし、`h-dvh w-full overflow-hidden relative`）
- **Kindle様式タッチ・ジェスチャー操作（実効 `"paged"` 時）**:
  - **リアルタイム指追従（Direct Manipulation）**:
    - 水平スワイプ中、指の変位量（`deltaX`）に合わせて本文表示が水平スライド追従する。
  - **規定値判定（30%）とスナップバック（Snap Back）**:
    - 指離し時に移動量が画面幅の 30% 以上（またはフリック速度一定以上）の場合、次／前ページへめくり完了アニメーションを実行。
    - 30% 未満の場合はページめくりを行わず、元のページ位置へ滑らかにスナップバック復帰（キャンセル）する。
  - **縦書き（右開き）のタッチ領域**:
    - 画面左端（幅約 20%）タップ: 次のページ
    - 画面右端（幅約 20%）タップ: 前のページ
    - 画面中央（幅約 60%）タップ: 下部オーバーレイ（`ReaderBottomOverlay`）の開閉
  - **横書き（左開き）のタッチ領域**:
    - 画面右端（幅約 20%）タップ: 次のページ
    - 画面左端（幅約 20%）タップ: 前のページ
    - 画面中央（幅約 60%）タップ: 下部オーバーレイの開閉
  - **タップとドラッグの誤判定防止**: 移動 10px 未満かつ 300ms 未満はタップ判定とする。
- **エピソード境界シームレス遷移（前後話移動）**:
  - **ページめくり時**:
    - 最終ページでさらに「次へ」、第 1 ページで「前へ」引いた際はラバーバンド抵抗感（変位減衰）を付与。
    - 画面幅の 30% 以上引くと案内バッジ（`data-testid="reader-episode-boundary-hint"`、「指を離して次の話へ／前の話へ」）を表示し、指離しで次話先頭（前話末尾）へシームレス遷移。30% 未満で離すとスナップバック。
  - **連続スクロール時**:
    - 一度末尾（または先頭）までスクロールしきった状態から、もう一度同方向へスクロール操作を行った場合に限定して次話（前話）へ遷移（誤遷移防止の 2 段階操作）。
- **最下部タッチゾーン**:
  - 実効 `"scroll"` モード時、画面最下部（下端約 72px）のタップ操作によりオーバーレイ開閉をトグルする。
- **自動非表示（Auto-Hide）**:
  - オーバーレイ表示中に「本文エリアのスクロール／ページ送り操作」「本文エリアの再タップ」「前後話への移動」が行われた場合は、自動的にオーバーレイを閉じる。
- **メイン表示領域の排他描画ルール**:
  1. `error` が非 null の場合: エラー表示要素 `data-testid="reader-error"`（`role="alert"`）を描画し、**下部オーバーレイを最初から開いた状態とする**。
  2. `error === null` かつ `isLoading === true` かつ表示可能な本文（`chapter?.bodyHtml`）が未取得の場合: ローディング表示要素 `data-testid="reader-loading"` を描画する。
  3. `error === null` かつ `isLoading === false` かつ（`novel === null` または `chapter === null` または `chapter.bodyHtml === null`）の場合: 空状態要素 `data-testid="reader-empty"` を描画し、**下部オーバーレイを最初から開いた状態とする**。
  4. 上記以外（`novel !== null` かつ `chapter?.bodyHtml` が存在する場合）: 全画面 `ReaderView` を描画し、オーバーレイは初期非表示（画面中央タップまたは最下部タッチで開閉可能）とする。

---

### 3.6 `ReaderContainer`（リーダー画面 Container コンポーネント）

`useReader` フック、ルーター遷移コールバック、下部タブ遷移時の `flushBookmark` 連携、および OS バックキーによる目次復帰時のしおり保存を統合する Container コンポーネントです。

#### プロパティ契約（`ReaderContainerProps`）

| プロパティ名         | 型                                                | 必須 | 説明                                                                                           |
| :------------------- | :------------------------------------------------ | :--- | :--------------------------------------------------------------------------------------------- |
| `novelId`            | `string`                                          | 任意 | ルート `/novels/:novelId/chapters/:chapterIndex` から渡される対象作品 ID                       |
| `chapterIndex`       | `number`                                          | 任意 | ルートから渡される対象エピソード連番（1始まり、省略時は `1`）                                  |
| `initialWorkUrl`     | `string`                                          | 任意 | 単体検証・手動取得時の対象作品 URL（既定値: 検証用カクヨム作品 URL）                           |
| `activeTab`          | `BottomTab`                                       | 任意 | リーダー画面のアクティブタブ（省略時: `"bookshelf"`）                                          |
| `onBackToBookshelf`  | `() => void`                                      | 任意 | 「本棚へ戻る」（`/`）コールバック（省略時はルーター環境下で `navigateToBookshelf` を使用）     |
| `onNavigateSettings` | `() => void`                                      | 任意 | 「設定へ」（`/settings`）コールバック（省略時はルーター環境下で `navigateToSettings`）         |
| `onNavigateChapter`  | `(novelId: string, chapterIndex: number) => void` | 任意 | 前後話遷移コールバック（省略時はルーター環境下で `navigateToReader` を使用し、内部話数も同期） |

---

## 4. 状態管理・オンデマンド取得・しおり保存パイプライン（`useReader`）

### 4.1 `useReader` フック契約（`UseReaderResult`）

```ts
export interface UseReaderOptions {
  novelId?: string;
  chapterIndex?: number;
  initialWorkUrl?: string;
}

export interface UseReaderResult {
  novel: NovelRecord | null;
  chapter: ChapterRecord | null;
  chapterIndex: number;
  totalChapters: number;
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontSizePx: number;
  lineHeight: number;
  initialScrollProgress: number;
  scrollProgress: number;
  pagingMode: ReaderPagingMode; // 【新設: v0.4 Issue #122】
  effectivePagingMode: "paged" | "scroll"; // 【新設: v0.4 Issue #122】
  currentPage: number; // 【新設: v0.4 Issue #122】
  totalPages: number; // 【新設: v0.4 Issue #122】
  isLoading: boolean;
  error: string | null;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  toggleWritingMode: () => Promise<void>;
  changeTheme: (theme: ReaderTheme) => Promise<void>;
  changeFontSize: (fontSizePx: number) => Promise<void>;
  changeLineHeight: (lineHeight: number) => Promise<void>;
  changePagingMode: (pagingMode: ReaderPagingMode) => Promise<void>; // 【新設: v0.4 Issue #122】
  goToPage: (targetPage: number) => void; // 【新設: v0.4 Issue #122】
  nextPage: () => void; // 【新設: v0.4 Issue #122】
  prevPage: () => void; // 【新設: v0.4 Issue #122】
  setTotalPages: (total: number) => void; // 【新設: v0.4 Issue #122】
  updateScrollProgress: (progress: number) => Promise<void>;
  flushBookmark: () => Promise<void>;
  goToChapter: (targetChapterIndex: number) => Promise<boolean>;
  fetchNovelFromUrl: () => Promise<void>;
}
```

### 4.2 パイプライン仕様

1. **設定の初期読み出しと変更永続化**:
   - マウント時に `settingsRepository.getReaderSettings()` を呼び出し、保存済みの `writingMode`, `theme`, `fontSizePx`（初期値 `18`）, `lineHeight`（初期値 `1.8`）, `pagingMode`（初期値 `'auto'`）を復元する。
   - `toggleWritingMode`, `changeTheme`, `changeFontSize`（`12〜32` にクランプ）, `changeLineHeight`（`1.4〜2.4` にクランプ・小数第1位丸め）, `changePagingMode`（`'auto' | 'paged' | 'scroll'`）実行時は、即座に State を更新するとともに `settingsRepository.updateReaderSettings(patch)` で非同期保存する。
   - 実効モード `effectivePagingMode` は、純粋関数 `resolveEffectivePagingMode(pagingMode, writingMode)` に基づき、`pagingMode === 'auto' ? (writingMode === 'vertical-rl' ? 'paged' : 'scroll') : pagingMode` として動的に算出する。
2. **エピソード読み込みとキャッシュ鮮度・オンデマンド取得（`TR-03`, `TR-04`, `TR-05`）**:
   - `novelId` 指定時は `novelRepository.getNovelById(novelId)`、`novelId` 未指定時は `novelRepository.listNovels()` の先頭作品を取得する（未登録時は空状態 `novel = null, chapter = null`）。
   - 対象エピソード `chapterRepository.getChapter(targetNovel.id, targetChapterIndex)` を取得する。
   - **キャッシュ鮮度と取得分岐**:
     - `chapter.bodyHtml !== null` かつ `now - chapter.downloadedAt < CACHE_TTL_MS`（7日以内）の場合: 有効キャッシュとみなし通信を行わず即座に本文を描画する。
     - `chapter.bodyHtml !== null` かつ `now - chapter.downloadedAt >= CACHE_TTL_MS`（7日経過）の場合: 既存キャッシュを保持したまま、タイムアウト `SHORT_TIMEOUT_MS`（3秒）で `httpClient.getHtml` を試みる。3秒以内に取得成功した場合は新本文で更新保存し表示する。タイムアウトまたは通信エラー時は **即座に既存キャッシュ本文（`bodyHtml`）を表示へフォールバック** させ、エラー画面を表示せずスムーズに読書を継続させる。
     - `chapter.bodyHtml === null`（未キャッシュ状態）の場合: 標準タイムアウト（10秒）で自動的に `parserRegistry.requireParser(chapter.url)` → `httpClient.getHtml({ url: chapter.url, timeoutMs: STANDARD_TIMEOUT_MS })` → `parser.parseChapterContent(res.html, chapter.url)` → `chapterRepository.saveChapterBody(targetNovel.id, targetChapterIndex, parsed, new Date().toISOString())` を実行して DB に保存し、最新の `novel` と `chapter` を再取得する。通信失敗時はフォールバック先がないためエラー画面（`reader-error`）を表示する。
3. **既読フラグ（`is_read = 1`）および本棚「NEW」バッジの自動更新・解除**:
   - エピソード本文（`bodyHtml !== null`）の表示準備が完了した時点で、`chapter.isRead === false` であれば直ちに `chapterRepository.markChapterRead(targetNovel.id, targetChapterIndex, true)` を実行する。
   - 対象作品の `targetNovel.hasNewUpdate === true` の場合、直ちに `novelRepository.clearNewUpdate(targetNovel.id)` を呼び出して `has_new_update = 0` に解除し、本棚（`SCR-01`）復帰時に「NEW」バッジが消去された状態とする。
   - また「次の話へ」遷移（`TR-05`）実行時にも、現在話に対して `chapterRepository.markChapterRead(targetNovel.id, currentChapterIndex, true)` を確実に実行する。
4. **しおり（`bookmark_chapter_index`）と進捗率（`bookmark_scroll_progress`）の復元・自動保存（`SYS-REQ-12`, `TR-06`）**:
   - **エピソード表示開始時**:
     - `targetNovel.bookmarkChapterIndex === targetChapterIndex`（保存済みしおり話と一致する場合）: 保存済みの `targetNovel.bookmarkScrollProgress`（`0.0 〜 1.0`）を `initialScrollProgress` および `scrollProgress` にセットして位置を復元する。実効 `"paged"` モード時は初回 `setTotalPages(validTotal)` 計測時に `targetPage = validTotal > 1 ? Math.round(initialScrollProgress * (validTotal - 1)) + 1 : 1` で現在ページを復元する（初回計測以降の総ページ数変更時は現在ページ位置を維持し範囲外クランプのみ行う）。
     - `targetNovel.bookmarkChapterIndex !== targetChapterIndex`（別話を開いた場合、または前後話遷移 `TR-05` 時）: `initialScrollProgress = 0`, `scrollProgress = 0`, `currentPage = 1` にセットし、直ちに `novelRepository.updateBookmark(targetNovel.id, targetChapterIndex, 0)` を実行してしおりを現在話の先頭へ更新する。
   - **スクロール／ページめくり操作時および画面離脱時**:
     - ユーザースクロール時またはページ遷移時（`goToPage(targetPage)` / `nextPage()` / `prevPage()`）、算出された進捗率 `progress = totalPages > 1 ? (currentPage - 1) / (totalPages - 1) : 0`（`0.0 〜 1.0`）で `scrollProgress` を更新し、`novelRepository.updateBookmark(novel.id, chapterIndex, clampedProgress)` で DB へ自動保存する。
     - OS バックキー（`TR-06`）による目次復帰、または下部オーバーレイの4タブ（本棚 `TR-01b`、検索/ランキング/設定 `TR-01`）遷移時には、`flushBookmark()` により最新の `(chapterIndex, scrollProgress)` を確実に DB 保存してから画面遷移コールバックを呼び出す。
5. **前後エピソード遷移（`goToChapter(targetChapterIndex)`、`TR-05`）**:
   - `novel === null`、または `targetChapterIndex < 1` もしくは `targetChapterIndex > totalChapters`（範囲外）が指定された場合は何もせず `false` を返す。
   - 有効範囲内の場合は、遷移前の現在話（次話遷移時を含む）に対して `chapterRepository.markChapterRead(novel.id, chapterIndex, true)` を実行した上で、`targetChapterIndex` のエピソード読み込み（未キャッシュ時はオンデマンド本文取得・`saveChapterBody` 保存）、表示完了時の `markChapterRead(novel.id, targetChapterIndex, true)`、および新エピソード先頭へのしおり更新（`updateBookmark(novel.id, targetChapterIndex, 0)`、`initialScrollProgress = 0`, `scrollProgress = 0`）を実行し、`true` を返す。
6. **手動作品取得・更新パイプライン（`fetchNovelFromUrl()`）**:
   - 単体検証・手動取得トリガー時、対象 URL を `const targetUrl = novel?.canonicalUrl ?? initialWorkUrl` として解決した上で、**HTTP 通信を行う前に** `parserRegistry.requireParser(targetUrl)` および `parser.normalizeWorkUrl(targetUrl)` を呼び出す（未対応サイトや不正 URL の場合は通信を行わずに直ちに `error` をセットして終了する）。
   - 対応サイトの場合は `httpClient.getHtml({ url: normalizedWorkUrl })` で目次 HTML を取得し、`parser.parseNovelIndex(...)` → `novelRepository.upsertNovelWithToc(...)` で作品および目次を DB 保存する。
   - 対象話（`chapterIndex`）が存在する場合はエピソード本文を取得・サニタイズ解析して `chapterRepository.saveChapterBody(...)` で保存し、`markChapterRead` および `updateBookmark` を反映して表示を更新する。
7. **読書中の自動バックグラウンド先読みパイプライン（`v0.3`）**:
   - 現在話（第 $N$ 話）の本文読み込み完了後、自動的にバックグラウンド先読みを開始する。
   - 先読み対象: $N+1 \sim \min(N+5, \text{totalChapters})$。
   - 対象エピソードについて、SQLite 内のキャッシュが有効（`downloadedAt` から 7日以内）であれば通信をスキップする。
   - 未キャッシュまたは 7日経過エピソードが存在する場合、1話ごとに `PREFETCH_INTERVAL_MS`（1.5秒）のウェイトを空けて順次直列に取得・保存する（7日経過キャッシュは 3秒短タイムアウト、未キャッシュ話は 10秒標準タイムアウト）。
   - `AbortController` による制御:
     - ユーザーが `goToChapter` で別エピソードへ移動した際は、直前の先読み処理を直ちに中断（`abort()`）し、新エピソードを起点とする 5話先読みを再開始する。
     - リーダー画面離脱時（アンマウント、OS バックキー、タブ遷移）は直ちに処理を停止し、不要な通信を防止する。
   - 先読み処理中の通信失敗・例外はコンソール警告等に留め、現在閲覧中の読書画面にはエラーを表示しない。
8. **クラウド同期連携（読書進行時の自動 Push デバウンス: v0.4 Issue #120）**:
   - `goToChapter` による話数移動時、`markChapterRead` による既読状態更新時、およびしおり保存（`flushBookmark`）時に、`SyncEngine.notifyChanged()` を呼び出す。
   - 読書中の連続操作による過剰な API 通信を避けるため、`SyncEngine` 側で 2〜3秒（2500ms）デバウンスした上で Google Drive（`yommy-sync-state.json`）へ非同期 Push する。

---

## 5. ローカルストレージ永続化仕様（Web/Dev環境）

Web ブラウザおよび開発環境では、Capacitor ネイティブ SQLite プラグインが利用できないため、インメモリ SQLite（`sql.js`）と `localStorage` バックアップを組み合わせたハイブリッド永続化を提供します。

- **ストレージキー**: `yommy_sqlite_db_backup`
- **永続化フロー**:
  - DB 書き込み（`runTransaction` または個別 `execute`）完了時、`adapter.exportBinary()` で SQLite の全バイナリ（`Uint8Array`）をエクスポート。
  - バイナリを Base64 文字列へ変換し、`localStorage.setItem(STORAGE_KEY, base64Str)` に保存。
- **復元フロー**:
  - `ServiceProvider` 初期化時に `localStorage.getItem(STORAGE_KEY)` を取得。
  - Base64 デコードして `Uint8Array` に復元し、`createInMemoryDb(binary)` でインメモリ DB へ渡してテーブルおよび全レコードを復元。
- **例外ハンドリングと将来展望**:
  - `localStorage` 容量（約 5MB）超過（`QuotaExceededError`）時は、クラッシュせず `console.warn` で警告を記録しフォールバック。
  - Android 実機環境では `CapacitorSqliteAdapter`（ネイティブ SQLite ファイル）を使用するため、本制約は Web/Dev 環境限定となります。

---

## 6. 受入条件一覧（Acceptance Criteria: `AC-RD-xx`）

| AC ID          | 対象機能                                    | 検証条件                                                                                                                                                                                                                                                                                           | 関連要件 / 遷移                                                    |
| :------------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| **`AC-RD-01`** | 本文表示と未キャッシュ話オンデマンド取得    | キャッシュ済み話は通信なしで即時表示され、未キャッシュ話（`bodyHtml === null`）を開いた場合は自動的に HTML 取得・サニタイズ解析・DB 保存（`saveChapterBody`）が行われて作品名・サブタイトル・本文が表示されること。                                                                                | `SYS-REQ-02` / `TR-03`, `TR-04`, `TR-05`                           |
| **`AC-RD-02`** | ルビ・傍点の正確な描画とサニタイズ          | 本文中の `<ruby>`（`<rt>`, `<rp>`）および傍点 `<em class="bouten">` が XSS サニタイズを維持したまま組版崩れなく描画されること。                                                                                                                                                                    | `SYS-REQ-07`                                                       |
| **`AC-RD-03`** | 縦書き / 横書き切替と永続化                 | 設定画面（`SCR-05`）等での組み方向変更により、`ReaderView` の `vertical-rl`（縦書き）と `horizontal-tb`（横書き）が即座に反映され、`reader_settings` テーブルへ永続化されてリロード後も維持されること。                                                                                            | `SYS-REQ-08`                                                       |
| **`AC-RD-04`** | 4カラーテーマ切替と永続化                   | 設定画面（`SCR-05`）等でのカラーテーマ変更（light/sepia/dark/black）が `ReaderView` に即座に反映され、`reader_settings` テーブルへ永続化されてリロード後も維持されること。                                                                                                                         | `SYS-REQ-10`                                                       |
| **`AC-RD-05`** | 文字サイズ・行間設定と永続化                | 設定画面（`SCR-05`）等での文字サイズ（`12〜32px`）および行間（`1.4〜2.4`）変更が `ReaderView` に即座に反映され、`reader_settings` テーブルへ永続化されてリロード後も維持されること。                                                                                                               | `SYS-REQ-09`                                                       |
| **`AC-RD-06`** | 前後エピソード連続遷移とオーバーレイ連携    | `ReaderBottomOverlay` 内の「前の話へ」「次の話へ」ボタンで同一作品の `chapterIndex ± 1` へ遷移（`TR-05`）でき、第1話では「前の話へ」が `disabled`、最終話では「次の話へ」が `disabled` となること。遷移後はオーバーレイが自動的に隠れ、未キャッシュ話はオンデマンド取得されること。                | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-07`** | 既読フラグ（`is_read`）の自動更新           | エピソード本文の表示完了時および次話遷移時（`TR-05`）に `markChapterRead(novelId, chapterIndex, true)` が実行され、作品詳細・目次画面（`SCR-02`）へ戻った際に閲覧済み話に `既読` バッジ（`episode-read-badge`）が表示されること。                                                                  | `SYS-REQ-12` / `TR-05`, `TR-06`                                    |
| **`AC-RD-08`** | しおり話数・スクロール進捗率の保存復元      | 現在閲覧中の `bookmark_chapter_index` とスクロール進捗率（`0.0〜1.0`）が自動保存され、下部オーバーレイの4タブ（本棚・検索・ランキング・設定）遷移時および OS バックキーによる目次復帰時にも `flushBookmark` が実行され、再開時に同じ話・スクロール位置が復元されること。                           | `SYS-REQ-12, 16, 20` / `TR-01`, `TR-03`, `TR-04`, `TR-05`, `TR-06` |
| **`AC-RD-09`** | 全画面テキスト表示化                        | 外枠パディング（`p-3 md:p-6`）、カード枠線・影（`rounded-lg border shadow-sm`）、および常時表示のバーが撤廃され、画面全体（`100dvh`）に本文が全画面でレンダリングされること。                                                                                                                      | `SYS-REQ-08, 11, 16`                                               |
| **`AC-RD-10`** | 最下部タッチによる下部オーバーレイ開閉      | 画面最下部ゾーン（下端約 72px または 15% 領域）のタップで `ReaderBottomOverlay` がスライドイン表示され、本文スクロール・本文エリア再タップ・前後話遷移で自動的に隠れること。またエラー時（`reader-error`）や空状態時は最初から表示されること。                                                     | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-11`** | リーダー表示による本棚「NEW」バッジ解除     | 本棚で「NEW」バッジが表示されていた作品のリーダー画面（`SCR-03`）を開いた際（「続きから読む」`TR-03` 等）、`clearNewUpdate` が実行されて作品の `has_new_update` が 0 に解除され、本棚へ戻った際（`TR-01b` 等）に対象作品カードの「NEW」バッジが消去されていること。                                | `SYS-REQ-04` / `TR-03`, `TR-01b`                                   |
| **`AC-RD-12`** | 読書中の 5 話自動先読み                     | リーダーで第 $N$ 話を表示完了後、バックグラウンドで $N+1 \sim N+5$ 話が 1.5秒間隔のウェイト制御を挟んで順次キャッシュ取得され、`goToChapter` での移動時やリーダー離脱時に `AbortController` で安全に処理が中断・切り替えられること。また先読み中の通信失敗が現在読書画面にエラーを表示しないこと。 | `SYS-REQ-02, 03` / `TR-05`, `TR-06`                                |
| **`AC-RD-13`** | キャッシュ鮮度管理とフォールバック          | 取得から 7日以内のキャッシュは通信を行わず即座に本文が表示され、7日以上経過したキャッシュは 3秒短タイムアウトで再取得を試行し、通信タイムアウト・オフライン時には即座に既存キャッシュ本文（`bodyHtml`）を表示へフォールバックしてエラー画面を出さないこと。                                        | `SYS-REQ-02` / `TR-03`, `TR-04`, `TR-05`                           |
| **`AC-RD-14`** | 読書進行・既読更新時のクラウド同期自動 Push | 前後話移動時（`goToChapter`）や既読更新時（`markChapterRead`）にクラウド同期エンジンへ変更通知が行われ、2〜3秒デバウンスされた上で最新のしおり話数・既読エピソードリストが Google Drive へ自動 Push されること。                                                                                   | `SYS-REQ-06`                                                       |
| **`AC-RD-15`** | ページ送りモードに応じた組版・表示切替      | ページ送り設定（`auto` / `paged` / `scroll`）に基づき、実効モードが決定されること（`auto` 時は縦書きでページめくり・横書きでスクロール、`paged` で組み方向不問でページめくり、`scroll` で組み方向不問で連続スクロール）。設定変更により即座に組版と操作モードが切り替わること。                    | `SYS-REQ-11`                                                       |
| **`AC-RD-16`** | 1ページ組版・スライド・ページインジケーター | 実効 `paged` モード時、画面端で行が縦半分に途切れない 1 ページ区切りの組版が適用され、ページ送り時は 150〜250ms の横スライドアニメーションで遷移し、画面隅に `reader-page-indicator`（例: `3 / 12`）が表示されること。                                                                             | `SYS-REQ-11`                                                       |
| **`AC-RD-17`** | Kindle様式指追従・スナップバック・タップ    | 左右ドラッグ中に表示がリアルタイムに水平追従し、移動距離 30% 以上または高速フリックでページ送りが確定し、30% 未満で離した場合は元の位置へ滑らかにスナップバック復帰すること。また画面左右端約 20% タップで次/前ページめくり、画面中央タップで下部オーバーレイ開閉が動作すること。                  | `SYS-REQ-11`                                                       |
| **`AC-RD-18`** | ページめくり時のラバーバンドと次話遷移      | 最終ページでさらに次へ、第 1 ページで前へドラッグした際にゴム抵抗感（変位減衰）が付与され、30% 以上引くと案内バッジ（`reader-episode-boundary-hint`）が表示され、指を離すことで次エピソード先頭（または前エピソード末尾）へシームレス遷移すること（30% 未満離上時は留まること）。                  | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-19`** | 連続スクロール時の2段階誤遷移防止遷移       | 連続スクロールモード時、末尾（または先頭）へ到達した勢いでの誤遷移を防ぐため、一度端まで到達した後に再度同方向へスクロール操作を行った場合に限定して次エピソード（または前エピソード）へ遷移すること。                                                                                             | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-20`** | ページめくりモードにおける進捗率保存・復元  | ページめくりモードにおいても現在ページ位置を進捗率（`0.0〜1.0`）として算出して DB 保存（`bookmark_scroll_progress`）され、再開時に該当ページ位置が復元されること。またスクロールモードとページめくりモードの切替時にも進捗位置が維持されること。                                                   | `SYS-REQ-12` / `TR-03`, `TR-04`, `TR-06`                           |

---

## 7. SCN-01 結合シナリオ仕様（Playwright IT）

- **シナリオ ID**: `SCN-01`
- **目的**: 本棚画面（`SCR-01`）での URL 作品登録から、作品詳細・目次画面（`SCR-02`）での目次確認・更新・エピソード選択（`TR-02`, `TR-04`）、リーダー画面（`SCR-03`）での未キャッシュ話オンデマンド取得、全画面（100dvh）テキスト表示、縦書き・ルビ・傍点描画、画面最下部タップによる下部オーバーレイ（`ReaderBottomOverlay`）のスライドイン展開、スクロール操作による自動非表示、縦書き・横書き双方でのスクロール進捗保存と復元（`AC-RD-08`）、下部オーバーレイからの前後エピソード遷移（`TR-05`）、既読・しおり保存と作品詳細・本棚「続きから読む」からの再開復元（`TR-06`, `TR-04`, `TR-03`）、および作品削除（`TR-07`）までの一連のユーザー体験を一気通貫で検証する。
- **検証ステップ**:
  1. 初期表示（`/`）で本棚の空状態（`bookshelf-empty`）が表示されることを確認。
  2. 探索元（検索・ランキング画面またはテスト用サービス連携）より作品を登録し、本棚一覧に作品カード（`novel-card`）が追加され、しおり位置バッジ（`novel-card-bookmark`）に `未読` が表示されることを確認。
  3. 作品カード本体（`novel-card-select`）をクリックして `/novels/:novelId`（`SCR-02` 作品詳細・目次画面）へ遷移（`TR-02`）し、作品ヘッダー情報・章見出し・エピソード一覧（`未取得` バッジ）が表示されること、および「目次を更新」ボタン押下で最新状態が通知されることを確認。
  4. 目次一覧から第1話を選択して `/novels/:novelId/chapters/1`（`SCR-03`）へ遷移（`TR-04`）することを確認。
  5. 第1話本文がオンデマンド取得され、外枠余白・枠線のない全画面（`100dvh`）で `reader-view` が表示され、常時固定バーが表示されていないことを確認（`AC-RD-09`）。
  6. 初期表示が `writing-vertical-rl`（縦書き）であり、デフォルトの `pagingMode="auto"` により実効 `paged`（ページめくりモード）として 1 ページ組版が行われ、本文内の `<ruby>`（ルビ）および `<em class="bouten">`（傍点）が可視状態で正しくレンダリングされ、画面隅にページインジケーター（`reader-page-indicator`）が表示されることを確認（`AC-RD-15`, `AC-RD-16`）。
  7. 画面中央領域をタップして下端から `ReaderBottomOverlay`（`data-testid="reader-bottom-overlay"`）がスライドイン表示され、第1話では「前の話へ」（`reader-prev-chapter`）が `disabled` かつ「次の話へ」（`reader-next-chapter`）が有効であること、および下部タブバーが表示されていることを確認（`AC-RD-10`, `AC-RD-17`）。再度中央タップで非表示になることを確認。
  8. 画面左端領域（幅約 20%）をタップして次ページへめくり遷移し、ページインジケーターが更新されること、および最終ページまでめくってさらに次へドラッグ離上することで次話（第2話）へシームレス遷移（`TR-05`）することを確認（`AC-RD-17`, `AC-RD-18`）。
  9. ブラウザの戻る操作（OS バックキー相当）により現在の進捗率を保存して作品詳細（`SCR-02`）へ戻り、「続きから読む」（`TR-04`）で再開した際に保存された進捗率・ページ位置が復元されることを確認（`AC-RD-08`, `AC-RD-20`）。
  10. 設定画面（`SCR-05`）で「連続スクロール」を選択してリーダーに戻り、連続スクロール表示へ切り替わること、および末尾到達後の 2 段階スクロールで次話へ遷移できることを確認（`AC-RD-15`, `AC-RD-19`）。
  11. 第2話でオーバーレイを表示し、「前の話へ」（`reader-prev-chapter`）をクリックして第1話へ戻る遷移（`TR-05`）を確認した後、再度第2話へ進む。
  12. オーバーレイを表示して下部タブ「本棚」をタップし、しおり進捗率が DB 保存（`flushBookmark`）された上で本棚画面（`/`）へ遷移（`TR-01b`）することを確認。本棚の作品カードに `しおり: 第2話` が表示され、「第2話から読む」（`novel-card-resume`）で第2話の位置が復元されること、および最後に `SCR-02` から作品を削除して本棚が空状態になることを確認（`TR-07`）。
