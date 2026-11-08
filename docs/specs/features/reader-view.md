---
type: spec-feature
title: "小説リーダー画面仕様書（SCR-03: Novel Reader）"
description: "小説本文の全画面（100dvh）縦書き・横書き組版表示、ページめくり（タップ/Kindle様式スワイプ送り）と連続スクロール切替、ハードウェア音量キー操作連携、エピソード端シームレス遷移、上下連動オーバーレイ（ReaderTopOverlay: 作品名・サブタイトル1行固定省略・目次導線 / ReaderBottomOverlay: RTLページシークバー・前後話ナビ・下部タブ）、ルビ・傍点描画、4カラーテーマ・文字サイズ・行間設定の永続化、前後エピソード遷移、未キャッシュ話のオンデマンド取得、既読・しおり・進捗率の自動保存/復元、およびSCN-01統合シナリオの正本仕様。"
status: "Review (#269)"
updated: "2026-11-08"
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
  - top-overlay
  - bottom-overlay
  - seekbar
  - rtl
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
  - pagination
  - touch-action
  - multi-column
  - font-family
  - page-margin
  - animation
  - slide
  - volume-key
  - hardware-key
  - webview-import
  - fallback
  - dom-import
  - ho-23
  - ho-25
  - ho-26
  - ho-27
  - ho-28
  - ho-30
  - ho-35
related_specs:
  - docs/specs/changes/issue-269-webview-fallback-and-dom-import.md
  - docs/specs/features/webview-import.md
  - docs/specs/parsers/narou.md
  - docs/specs/changes/archive/issue-239-narou-parser-and-multi-page-toc.md
  - docs/specs/changes/archive/issue-238-loading-ux-clarification.md
  - docs/specs/changes/archive/issue-203-volume-key-paging.md
  - docs/specs/changes/archive/issue-202-reader-top-overlay-and-seekbar.md
  - docs/specs/changes/archive/issue-201-reader-page-slide-animation.md
  - docs/specs/changes/archive/issue-169-font-and-margin-customization.md
  - docs/specs/changes/archive/issue-168-reader-pagination-and-touch-refinement.md
  - docs/specs/changes/archive/issue-122-reader-page-turning.md
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
  - docs/specs/changes/archive/issue-124-settings-back-button-navigation.md
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
  - src/features/reader/hooks/useReaderGestures.test.ts
  - src/features/reader/components/ReaderTopOverlay.test.tsx
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
  - test/it/scenarios/scn05-cloud-sync.spec.ts
  - test/it/scenarios/scn06-volume-key-paging.spec.ts
---

# 小説リーダー画面仕様書（SCR-03）

本ドキュメントは、Yommy における小説本文閲覧（**`SCR-03`: ルート `/novels/:novelId/chapters/:chapterIndex`**）の全画面テキスト組版描画、上下連動オーバーレイ（上部 `ReaderTopOverlay`: 作品名・サブタイトル1行固定省略表示・目次導線 / 下部 `ReaderBottomOverlay`: RTLページシークバー・前後話ナビ・下部タブ）、しおり・スクロール進捗率・既読状態の自動保存、およびブラウザ環境におけるローカル永続化の仕様を定める正本（Single Source of Truth）です。

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
  - `SYS-REQ-09`（文字サイズ `fontSizePx`・行間 `lineHeight`、フォント種別 `fontFamily`、画面余白 `pageMarginPx` の動的組版反映、v0.5 Issue #169）
  - `SYS-REQ-10`（4カラーテーマ `light` / `sepia` / `dark` / `black` 切り替え ※設定画面 `SCR-05` で変更）
  - `SYS-REQ-11`（全画面表示での縦書きページめくり［CSSマルチカラム1ページ組版・文字途切れ防止・なめらかな2段階水平スライドアニメーション（タップ＆スワイプ離上共通、高速連打即時確定）・ページインジケーター表示・touch-action制御・Kindle様式リアルタイム指追従スワイプ・30%規定値判定スナップバック・画面左右約20%タップ送り・画面中央タップまたは最下部タッチ連動の上下オーバーレイ（ReaderTopOverlay / ReaderBottomOverlay）開閉・縦書き時 RTL ページシークバー・端ラバーバンド離上遷移および端2段階タップ遷移］、横書き連続スクロール固定、連続スクロール時の本文先頭「前の話へ」・末尾「次の話へ」ボタンおよび端2段階スワイプ遷移、さらにハードウェア音量キー［音量［ー］次へ／音量［＋］前へ］によるページめくり・連続スクロール送り・エピソード端2段階遷移・オーバーレイ自動非表示、v0.6 Issue #203）
  - `SYS-REQ-12`（しおり話数 `bookmark_chapter_index`・本文進捗率 `bookmark_scroll_progress` の自動保存・復元、ページめくりモードとスクロールモードの進捗連動、OSバックキー・上部オーバーレイ「← 目次」ボタン・下部タブ遷移時の `flushBookmark` 実行、および既読フラグ `is_read` の自動更新）
  - `SYS-REQ-16`（100dvh 全画面シェル・下部タブバー連携・OSバックキー論理階層復帰）
  - `SYS-REQ-20`（下部4タブバー・リーダーオーバーレイ4タブ化）
- **関連画面遷移**:
  - `TR-01`（下部オーバーレイの4タブ「本棚 `/`」「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」タップによる各画面への遷移）
  - `TR-01b`（下部オーバーレイの「本棚」タブタップによる本棚トップ画面 `SCR-01` `/` へのダイレクト遷移）
  - `TR-03`（本棚画面 `SCR-01` の「続きから読む」から `SCR-03` への直接遷移）
  - `TR-04`（作品詳細・目次画面 `SCR-02` のエピソード選択または読書開始ボタンから `SCR-03` への遷移）
  - `TR-05`（下部オーバーレイの「前の話へ」「次の話へ」操作、エピソード境界でのシームレス遷移［ラバーバンドドラッグ離上 / 端2段階タップ / 本文先頭・末尾ボタン / 2段階スクロール / 音量キー2段階操作］による同一作品の前後エピソード `chapterIndex ± 1` への遷移）
  - `TR-06`（OS バックキーまたは上部オーバーレイ「← 目次」ボタン押下、または下部オーバーレイの4タブ遷移によりスクロール進捗率を保存して `SCR-02` `/novels/:novelId`、または各タブへ遷移）
  - `TR-10`（本文取得エラー画面内の「内蔵ブラウザで開いて取り込む」ボタン押下による `SCR-04` `/browser?url=...&novelId=...&chapterIndex=...` へのフォールバック遷移、`v0.9` Issue #269）
- **対象外スコープ（後続 Milestone）**:
  - 3D カール等の過剰な描画エフェクト（2D 横スライドアニメーションを採用）
  - 汎用 Web ブラウザとしてのマルチタブ・ブックマーク管理（小説フォールバック表示・DOM インポートに特化）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/reader/` 配下を以下のモジュール構成とします（`ReaderToolbar` は Issue #50 で廃止され設定画面 `SCR-05` へ移設、上下連動オーバーレイを導入して全画面没入型 UI とします）。

```text
src/features/reader/
├── hooks/
│   ├── useReader.ts                       # エピソード取得・オンデマンド通信・既読/しおり保存・組版設定永続化フック
│   ├── useReader.test.ts                  # フック単体テスト（Vitest）
│   ├── useReaderGestures.ts               # Kindle様式ジェスチャー・指追従・スナップバック・エピソード境界遷移フック
│   └── useReaderGestures.test.ts          # フック単体テスト（Vitest）
└── components/
    ├── ReaderTopOverlay.tsx               # 【新設】作品名・サブタイトル1行固定省略表示と目次遷移ボタンを持つ上部スライドインオーバーレイ（Presentational、v0.6 Issue #202）
    ├── ReaderTopOverlay.stories.tsx       # 【新設】Storybookストーリー（表示/非表示/長文タイトル）
    ├── ReaderTopOverlay.test.tsx          # 【新設】単体テスト（Portable Stories）
    ├── ReaderBottomOverlay.tsx            # 【改修】RTLページシークバー＋前後話ナビ＋下部タブを統合したスライドインオーバーレイ（Presentational、v0.6 Issue #202）
    ├── ReaderBottomOverlay.stories.tsx    # 【改修】Storybookストーリー（表示/非表示/シークバー/第1話/最終話）
    ├── ReaderBottomOverlay.test.tsx       # 【改修】単体テスト（Portable Stories）
    ├── ReaderChapterNav.tsx               # 前話へ / 現在話数 / 次話へナビゲーションバー（Presentational、オーバーレイ内で再利用）
    ├── ReaderChapterNav.stories.tsx
    ├── ReaderChapterNav.test.tsx
    ├── ReaderView.tsx                     # 全画面本文組版・ルビ/傍点描画・縦横スクロール進捗率算出/復元（Presentational）
    ├── ReaderView.stories.tsx
    ├── ReaderView.test.tsx
    ├── ReaderPage.tsx                     # 【改修】全画面レイアウト、最下部タッチ検知、上下オーバーレイ連動・自動非表示制御（Presentational、v0.6 Issue #202）
    ├── ReaderPage.stories.tsx
    ├── ReaderPage.test.tsx
    ├── ReaderContainer.tsx                # 【改修】ServiceProvider / Router / useReader を接続し、目次遷移・タブ遷移・OSバックキー時のしおり保存を連携（Container、v0.6 Issue #202）
    ├── ReaderContainer.stories.tsx
    └── ReaderContainer.test.tsx
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

### 3.3 `ReaderTopOverlay`（上部スライドインオーバーレイ：v0.6 Issue #202）

下部オーバーレイ（`ReaderBottomOverlay`）の開閉（`isOpen`）と完全同期して画面上端からスライドイン表示され、作品タイトル・エピソードサブタイトルの確認と作品詳細・目次画面（`SCR-02: /novels/:novelId`）への「← 目次」復帰導線を提供する Presentational コンポーネントです。

#### プロパティ契約（`ReaderTopOverlayProps`）

| プロパティ名   | 型           | 必須 | 既定値 | 説明                                                                              |
| :------------- | :----------- | :--- | :----- | :-------------------------------------------------------------------------------- |
| `isOpen`       | `boolean`    | 必須 | -      | オーバーレイの表示・展開状態（`true` でスライドイン表示、`false` で画面外へ退避） |
| `novelTitle`   | `string`     | 必須 | -      | 作品タイトル                                                                      |
| `chapterTitle` | `string`     | 必須 | -      | エピソードサブタイトル                                                            |
| `onBackToToc`  | `() => void` | 必須 | -      | 「← 目次」ボタン押下時のコールバック                                              |

#### セマンティック属性とスタイル仕様

- **ルート要素**: `data-testid="reader-top-overlay"`、`aria-hidden={!isOpen}`
- **配置・アニメーション**:
  - 画面上端固定（`fixed top-0 left-0 right-0 z-40`）、下部オーバーレイと共通の半透明背景（`bg-white/95 dark:bg-zinc-900/95 shadow-md border-b border-zinc-200 dark:border-zinc-800`）。
  - 開閉時のスライド（`transition-transform duration-200 ease-in-out`、`isOpen ? 'translate-y-0' : '-translate-y-full pointer-events-none'`）。非表示時は `-translate-y-full pointer-events-none` により背面の読書タッチ領域を阻害しない。
- **左端（目次遷移導線）**:
  - `data-testid="reader-top-back-to-toc"`（ボタン、`shrink-0`、ラベル: `← 目次`）。
  - クリック時に `onBackToToc()` を呼び出し、しおり保存（`flushBookmark`）および目次復帰（`TR-06`）を発火。
- **右側（タイトル情報・長文保護）**:
  - `min-w-0 flex-1 flex flex-col justify-center`。
  - 上段: `data-testid="reader-top-novel-title"`（作品タイトル、`text-xs text-zinc-500 dark:text-zinc-400 truncate`）。
  - 下段: `data-testid="reader-top-chapter-title"`（エピソードサブタイトル、`text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate`）。
  - 両行ともに `truncate`（`overflow-hidden text-ellipsis whitespace-nowrap`）により最大1行固定・末尾 `...` 省略を保証し、100文字超の長文タイトルであってもバーの高さが一切変化せず、レイアウト崩れを起こさない。

---

### 3.4 `ReaderBottomOverlay`（下部スライドインオーバーレイ＆ページシークバー）

画面最下部タッチや中央タップにより下からスライドイン表示され、ページシークバー（RTL）、前後話ナビゲーション、および下部タブバー（本棚/検索/ランキング/設定の4タブ）を一体化して提供する Presentational コンポーネントです。

#### プロパティ契約（`ReaderBottomOverlayProps`）

| プロパティ名          | 型                             | 必須 | 既定値        | 説明                                                                              |
| :-------------------- | :----------------------------- | :--- | :------------ | :-------------------------------------------------------------------------------- |
| `isOpen`              | `boolean`                      | 必須 | -             | オーバーレイの表示・展開状態（`true` でスライドイン表示、`false` で画面外へ退避） |
| `chapterIndex`        | `number`                       | 必須 | -             | 現在表示中のエピソード連番（1始まり）                                             |
| `totalChapters`       | `number`                       | 必須 | -             | 作品の全エピソード数                                                              |
| `isLoading`           | `boolean`                      | 任意 | `false`       | エピソード通信中フラグ                                                            |
| `activeTab`           | `BottomTab`                    | 任意 | `'bookshelf'` | リーダー画面の論理所属タブ（探索元または `'bookshelf'` をアクティブ表示）         |
| `onPrevChapter`       | `() => void`                   | 必須 | -             | 「前の話へ」ボタン押下時のコールバック                                            |
| `onNextChapter`       | `() => void`                   | 必須 | -             | 「次の話へ」ボタン押下時のコールバック                                            |
| `onSelectTab`         | `(tab: BottomTab) => void`     | 任意 | -             | 下部タブ（本棚 / 検索 / ランキング / 設定）押下時のコールバック                   |
| `effectivePagingMode` | `'paged' \| 'scroll'`          | 任意 | `'scroll'`    | 実効ページ送りモード（`'paged'` 時のみシークバーを表示、v0.6 Issue #202）         |
| `currentPage`         | `number`                       | 任意 | `1`           | ページめくり表示時の現在ページ番号（1始まり、v0.6 Issue #202）                    |
| `totalPages`          | `number`                       | 任意 | `1`           | ページめくり表示時の総ページ数（v0.6 Issue #202）                                 |
| `onPageChange`        | `(targetPage: number) => void` | 任意 | -             | ページシークバー操作時のコールバック（v0.6 Issue #202）                           |

#### セマンティック属性とスタイル仕様

- **ルート要素**: `data-testid="reader-bottom-overlay"`、`aria-hidden={!isOpen}`
- **閉じる操作の一本化**: 旧仕様の閉じるボタン（`reader-bottom-overlay-close`）および `onClose` プロパティは廃止され、本文エリアタップによるオーバーレイ自動非表示に一本化される。
- **配置・アニメーション**: 画面下端固定（`fixed bottom-0 left-0 right-0 z-40`）、背景にはテーマに合わせた半透明または不透明背景（例: `bg-white/95 dark:bg-zinc-900/95 shadow-lg border-t border-zinc-200 dark:border-zinc-800`）、開閉時のなめらかなスライド（`transition-transform duration-200 ease-in-out`、`isOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'`）。
- **最上段（ページシークバー領域：v0.6 Issue #202）**:
  - `effectivePagingMode === 'paged'` のときのみ、前後話ナビゲーションの上段に `data-testid="reader-page-seekbar-section"` を描画（連続スクロール `scroll` モード時は非表示）。
  - 右→左（RTL）スライダー: `data-testid="reader-page-seekbar"`（`<input type="range" dir="rtl" min={1} max={totalPages} value={currentPage} />`）。縦書き右綴じの読書進行に合わせ、右端が 1 ページ目、左へ動かすほどページが進み、左端が最終ページ（`totalPages`）となる。`totalPages <= 1` または `isLoading === true` のときは `disabled`。
  - ページ表示ラベル: `data-testid="reader-page-seekbar-label"`（`{currentPage} / {totalPages} ページ`）。
  - 操作時挙動: スライダー操作（`onPageChange`）により任意ページへジャンプしても、オーバーレイは自動非表示にならず展開状態を維持し、連続した微調整を可能とする。
- **中段（エピソードナビ）**: `ReaderChapterNav`（`data-testid="reader-chapter-nav"`）を描画し、前話/次話遷移と話数インジケーターを提供。
- **下段（下部タブバー）**: `data-testid="reader-bottom-tabs"`（`role="tablist"`）を描画し、各タブボタン `data-testid="reader-bottom-tab-bookshelf"`（「本棚」/ activeTab に応じて `aria-selected="true"` 表示）、`data-testid="reader-bottom-tab-search"`（「検索」）、`data-testid="reader-bottom-tab-ranking"`（「ランキング」）、`data-testid="reader-bottom-tab-settings"`（「設定」）を表示。各タブボタンはモバイル（375px等）でのテキスト折り返しを防止するため、上アイコン・下テキスト（縦並び `flex-col sm:flex-row` ＋ `whitespace-nowrap`、`text-xs sm:text-sm`）でスタイリングされる。

---

### 3.5 `ReaderView`（本文組版レンダリング ＆ スクロール進捗制御）

サニタイズ済み本文 HTML の縦書き・横書き組版、ルビ・傍点描画、テーマ・文字サイズ・行間適用、および全画面（`h-full w-full`）での縦横双方のスクロール進捗率（`0.0〜1.0`）算出・復元を担う Presentational コンポーネントです。

#### プロパティ契約（`ReaderViewProps`）

| プロパティ名             | 型                             | 必須 | 既定値            | 説明                                                                                 |
| :----------------------- | :----------------------------- | :--- | :---------------- | :----------------------------------------------------------------------------------- |
| `title`                  | `string`                       | 任意 | -                 | 作品タイトル                                                                         |
| `chapterTitle`           | `string`                       | 任意 | -                 | 各話サブタイトル                                                                     |
| `bodyHtml`               | `string`                       | 必須 | -                 | サニタイズ済み本文 HTML（ルビ `<ruby>`, 傍点 `<em class="bouten">` 含む）            |
| `writingMode`            | `WritingMode`                  | 任意 | `'vertical-rl'`   | 組み方向（`'vertical-rl'` または `'horizontal-tb'`）                                 |
| `theme`                  | `ReaderTheme`                  | 任意 | `'light'`         | 背景・文字色テーマ（`'light'`, `'sepia'`, `'dark'`, `'black'`）                      |
| `fontSizePx`             | `number`                       | 任意 | `18`              | 文字サイズ (px)                                                                      |
| `lineHeight`             | `number`                       | 任意 | `1.8`             | 行間倍率                                                                             |
| `fontFamily`             | `ReaderFontFamily`             | 任意 | `'biz-ud-mincho'` | フォント種別（5種、v0.5 Issue #169）                                                 |
| `pageMarginPx`           | `number`                       | 任意 | `20`              | 画面余白 px（8〜48px、v0.5 Issue #169）                                              |
| `initialScrollProgress`  | `number`                       | 任意 | `0`               | 初期復元する進捗率（`0.0 〜 1.0`）                                                   |
| `pagingMode`             | `ReaderPagingMode`             | 任意 | `'auto'`          | ページ送りモード（`'auto'`, `'paged'`, `'scroll'`、v0.4 Issue #122）                 |
| `currentPage`            | `number`                       | 任意 | `1`               | ページめくり表示時の現在ページ番号（1始まり）                                        |
| `totalPages`             | `number`                       | 任意 | `1`               | ページめくり表示時の総ページ数                                                       |
| `slideOffsetPx`          | `number`                       | 任意 | `0`               | スワイプドラッグ中のリアルタイムスライド変位量 (px)                                  |
| `isAnimating`            | `boolean`                      | 任意 | `false`           | ページ遷移アニメーション中フラグ                                                     |
| `onTotalPagesChange`     | `(totalPages: number) => void` | 任意 | -                 | DOM寸法・組版計算により総ページ数が確定・変化した際のコールバック                    |
| `onScrollProgressChange` | `(progress: number) => void`   | 任意 | -                 | スクロールまたはページ変更時に算出された進捗率（`0.0 〜 1.0`）を通知するコールバック |
| `onPrevChapter`          | `() => void`                   | 任意 | -                 | 連続スクロール時本文先頭「前の話へ」ボタン押下時コールバック（v0.5 Issue #168）      |
| `onNextChapter`          | `() => void`                   | 任意 | -                 | 連続スクロール時本文末尾「次の話へ」ボタン押下時コールバック（v0.5 Issue #168）      |
| `chapterIndex`           | `number`                       | 任意 | `1`               | 現在のエピソード番号（1始まり、v0.5 Issue #168）                                     |
| `totalChapters`          | `number`                       | 任意 | `1`               | 作品の総エピソード数（v0.5 Issue #168）                                              |

#### セマンティック属性と組版・スクロール仕様

- **テスト用・検証用属性**:
  - `data-testid="reader-view"`
  - `data-writing-mode`: 現在の組み方向（`"vertical-rl"` または `"horizontal-tb"`）
  - `data-theme`: 現在のカラーテーマ（`"light"`, `"sepia"`, `"dark"`, `"black"`）
  - `data-font-size`: 現在の文字サイズ数値（`String(fontSizePx)`）
  - `data-line-height`: 現在の行間倍率（`String(lineHeight)`）
  - `data-font-family`: 現在のフォント種別文字列（`fontFamily`、v0.5 Issue #169）
  - `data-page-margin`: 現在の画面余白数値（`String(pageMarginPx)`、v0.5 Issue #169）
  - `data-paging-mode`: 設定されたページ送りモード（`"auto"`, `"paged"`, `"scroll"`）
  - `data-effective-paging-mode`: 実効ページ送りモード（`"paged"` または `"scroll"`）
  - `data-current-page`: ページめくり表示時の現在ページ番号
  - `data-total-pages`: ページめくり表示時の総ページ数
- **実効ページ送りモード（`effectivePagingMode`）の算出**:
  - 横書き（`writingMode === 'horizontal-tb'`）時: 設定値に関わらず常に `"scroll"`（連続スクロール固定）。
  - 縦書き（`writingMode === 'vertical-rl'`）時:
    - `pagingMode === 'scroll'`: `"scroll"`
    - `pagingMode === 'auto'` または `pagingMode === 'paged'`: `"paged"`
- **1ページ単位の組版（実効 `"paged"` 時）**:
  - 縦書き（`vertical-rl`）時:
    - 画面端で行や文字が途切れることを完全に防ぐため、各ページスロット内の本文要素（`reader-content`）にブラウザ標準の縦書き CSS マルチカラム組版（`writing-mode: vertical-rl`、`columns: 1`、`column-gap: (pageMarginPx * 2)px`、`column-fill: auto`、段幅 `pageWidth - pageMarginPx * 2`、段高 `pageHeight - pageMarginPx * 2`）を適用する。
    - 縦書きマルチカラム組版では、1段の高さ（`pageHeight - pageMarginPx * 2`）と段間ギャップ（`pageMarginPx * 2`）の和がちょうど画面高 `pageHeight` と一致し、行や文字が途中で切れることなく次段へ送られる。各スロット内は静的 `transform: translateY(-(slotPage - 1) * pageHeight)`（`transition: none`）により該当ページ位置を静的に描画し、縦アニメーション（せり上がり）を完全に排除する。
    - 右綴じ書籍のメンタルモデル（1ページ目は右端、左側に次ページが存在）に即して、3つのスロット `[次ページ(左: currentPage + 1), 現在ページ(中央: currentPage), 前ページ(右: currentPage - 1)]`（各幅 `pageWidth`、余白 `padding: ${pageMarginPx}px`、`boxSizing: "border-box"`）を水平スワイプラック（`data-testid="reader-swipe-track"`、`position: absolute; top: 0; left: -pageWidth + slideOffsetPx; width: pageWidth * 3; height: 100%; display: flex; flex-direction: row; writing-mode: horizontal-tb;`）に水平配置する。
    - 紙の本と同じように **左から右へのスワイプ（`dx > 0`, `slideOffsetPx > 0`）または画面左端約 20% タップで左側の次ページが画面内に水平スライドイン** する。スライドアニメーション中（`isAnimating === true`）は `transition: left 200ms ease-out` で滑らかに遷移し、ドラッグ中およびアニメーション完了時のリセット時（`isAnimating === false`）は `transition: none` とすることで、逆戻りアニメーションや視覚的ジャンプを排除して滑らかに中央スロットへ引き継ぐ（R1-28, R1-29, v0.6 Issue #201）。
    - 画面隅に控えめなページインジケーター（`data-testid="reader-page-indicator"`、例: `3 / 12`）を表示する。組み方向に関わらず常に水平表記とするため `writing-mode: horizontal-tb` を固定適用し、縦書き時における画面外クリップ・テキスト途切れを防止する。
    - 総ページ数 `totalPages` は、マルチカラム要素の `scrollHeight`（`Math.max(1, Math.round((scrollHeight + pageMarginPx * 2) / pageHeight))`）から算出し、話数遷移直後・しおり復元時・2ページ目以降のリサイズ時にも総ページ数が縮小しないことを保証する（R1-28, R1-29）。
    - 画面回転やウィンドウリサイズ発生時は、`window.addEventListener("resize", ...)` に連動して総ページ数（`totalPages`）の再計測（`onTotalPagesChange`）を自動実行し、レイアウト変更に即座に追従する。また、初回マウント時（`containerRef` 接続直後の初回計測時）には実 DOM の `clientWidth` / `clientHeight` からスロット本文の幅・高さ（`width: Math.max(1, currentWidth - pageMarginPx * 2)px`, `height: Math.max(1, currentHeight - pageMarginPx * 2)px`）を即座に適用した上で `scrollHeight` を計測して 0px 幅レイアウトによる過大ページ数算出を防ぎ、さらに `bodyHtml`・`chapterTitle`・`initialScrollProgress`・`writingMode`・`fontSizePx`・`lineHeight`・`fontFamily`・`pageMarginPx`・`containerWidth`・`containerHeight` の変化時にも総ページ数を再評価し、エピソード遷移や別画面からのリーダー再遷移直後のページ位置復元を確実に発火させる（R2-04, R1-23, R1-26）。
    - 実効 `paged` モードで再開・ページ遷移した際は、スクロール位置（`scrollLeft` / `scrollTop`）を `0` にリセットし、`restoreScrollPosition` は実効 `!isPaged`（連続スクロールモード）のみに限定して実行することで、`scrollLeft` とスライドによる二重変位バグを防止する。
- **連続スクロール仕様（実効 `"scroll"` 時）**:
  - 縦書き時: CSS `writing-mode: vertical-rl`、`text-orientation: mixed`、水平スクロール（`overflow-x-auto overflow-y-hidden`）。
  - 横書き時: CSS `writing-mode: horizontal-tb`、垂直スクロール（`overflow-y-auto overflow-x-hidden`）。
  - **本文先頭・末尾の前後話移動ボタン**:
    - 本文の先頭に「前の話へ」ボタン（`data-testid="reader-scroll-prev-chapter"`）を描画（`chapterIndex <= 1` の場合は `disabled`、クリックで `onPrevChapter()` 呼び出し）。
    - 本文の末尾に「次の話へ」ボタン（`data-testid="reader-scroll-next-chapter"`）を描画（`chapterIndex >= totalChapters` の場合は `disabled`、クリックで `onNextChapter()` 呼び出し）。
- **共通スタイル・禁則処理**:
  - フォント: 設定されたフォント種別（`fontFamily: ReaderFontFamily`）に対応する CSS フォントスタック（初期値: BIZ UD明朝）を適用し、禁則処理（`line-break: strict; word-break: break-word`）を適用。
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
  4. **位置復元の発火トリガー条件（`R1-18`）**:
     - マウント時、および `initialScrollProgress`・`bodyHtml`（エピソード切替時）・`writingMode`（縦書き/横書き切替時）・`pagingMode`（ページ送りモード切替時）のいずれかが変化したタイミングで、進捗率に基づく位置復元を実行する。
     - なお、連続スクロールモード（`!isPaged`）で初期表示直後（`scroll` イベント未発火時）や 1 画面内に全文が収まる短文（`maxScroll <= 0`）の場合でも端での 2 段階遷移が確実に動作するよう、`useReaderGestures` 側の `syncScrollBoundaryState()` により各操作開始時（ポインター・タッチ・ホイール・音量キー）に実 DOM のスクロール位置および `maxScroll <= 0` から先頭・末尾到達フラグ（`reachedStartRef` / `reachedEndRef`）を同期評価する。

---

### 3.6 `ReaderPage`（リーダー画面 Presentational コンポーネント）

全画面本文（`ReaderView`）と上下連動オーバーレイ（上部 `ReaderTopOverlay`、下部 `ReaderBottomOverlay`）、Kindle様式のジェスチャー操作、エピソード境界シームレス遷移、および状態別表示（ローディング・エラー・空状態）を統合する画面レイアウトコンポーネントです。

#### プロパティ契約（`ReaderPageProps`）

| プロパティ名             | 型                             | 必須 | 説明                                                                                                              |
| :----------------------- | :----------------------------- | :--- | :---------------------------------------------------------------------------------------------------------------- |
| `novel`                  | `NovelRecord \| null`          | 必須 | 現在の作品レコード                                                                                                |
| `chapter`                | `ChapterRecord \| null`        | 必須 | 現在のエピソードレコード                                                                                          |
| `chapterIndex`           | `number`                       | 必須 | 現在のエピソード連番（1始まり）                                                                                   |
| `totalChapters`          | `number`                       | 必須 | 作品の全エピソード数                                                                                              |
| `writingMode`            | `WritingMode`                  | 必須 | 現在の組み方向                                                                                                    |
| `theme`                  | `ReaderTheme`                  | 必須 | 現在のカラーテーマ                                                                                                |
| `fontSizePx`             | `number`                       | 必須 | 現在の文字サイズ (px)                                                                                             |
| `lineHeight`             | `number`                       | 必須 | 現在の行間倍率                                                                                                    |
| `fontFamily`             | `ReaderFontFamily`             | 任意 | 現在のフォント種別（省略時: `'biz-ud-mincho'`、v0.5 Issue #169）                                                  |
| `pageMarginPx`           | `number`                       | 任意 | 現在の画面余白 px（省略時: `20`、v0.5 Issue #169）                                                                |
| `initialScrollProgress`  | `number`                       | 必須 | 初期復元する進捗率（`0.0 〜 1.0`）                                                                                |
| `pagingMode`             | `ReaderPagingMode`             | 任意 | ページ送りモード（省略時: `'auto'`、v0.4 Issue #122）                                                             |
| `enableVolumeKeyPaging`  | `boolean`                      | 任意 | ハードウェア音量キー送り有効フラグ（省略時: `false`、v0.6 Issue #203）                                            |
| `volumeKeyBridge`        | `VolumeKeyBridge`              | 任意 | ハードウェア音量キーブリッジ（省略時は `ServiceContext` または `defaultVolumeKeyBridge` を使用、v0.6 Issue #203） |
| `currentPage`            | `number`                       | 任意 | ページめくり表示時の現在ページ番号（省略時: `1`）                                                                 |
| `totalPages`             | `number`                       | 任意 | ページめくり表示時の総ページ数（省略時: `1`）                                                                     |
| `isLoading`              | `boolean`                      | 必須 | 読み込み・通信中フラグ                                                                                            |
| `error`                  | `string \| null`               | 任意 | エラーメッセージ文字列                                                                                            |
| `activeTab`              | `BottomTab`                    | 任意 | リーダー画面の論理所属タブ（既定値: `"bookshelf"`）                                                               |
| `onPrevChapter`          | `() => void`                   | 必須 | 「前の話へ」押下時（`TR-05`）                                                                                     |
| `onNextChapter`          | `() => void`                   | 必須 | 「次の話へ」押下時（`TR-05`）                                                                                     |
| `onPageChange`           | `(targetPage: number) => void` | 任意 | タップ・スワイプ・シークバーによるページ送り確定時のコールバック                                                  |
| `onTotalPagesChange`     | `(totalPages: number) => void` | 任意 | 総ページ数確定・変化時のコールバック                                                                              |
| `onScrollProgressChange` | `(progress: number) => void`   | 必須 | 本文スクロール／ページ進捗変化時                                                                                  |
| `onSelectTab`            | `(tab: BottomTab) => void`     | 任意 | 下部タブ押下時                                                                                                    |
| `onBackToToc`            | `() => void`                   | 任意 | 上部オーバーレイ「← 目次」ボタン押下時コールバック（`TR-06`、v0.6 Issue #202）                                    |
| `onOpenWebView`          | `() => void`                   | 任意 | エラー画面内「内蔵ブラウザで開いて取り込む」押下時コールバック（`TR-10`、`v0.9` Issue #269）                      |
| `initialOverlayOpen`     | `boolean`                      | 任意 | `false`（エラー/空状態時は `true`）                                                                               |
| `initialSlideOffsetPx`   | `number`                       | 任意 | 初期スライド変位量（px、Storybook/VRT/テスト用）                                                                  |
| `initialBoundaryHint`    | `string \| null`               | 任意 | 初期境界案内ヒントメッセージ（Storybook/VRT/テスト用）                                                            |

#### セマンティック属性とレイアウト・ジェスチャー仕様

- **画面ルート**: `data-testid="reader-page"`（外枠パディングなし、`h-dvh w-full overflow-hidden relative`。なお連続スクロール時のネイティブスクロールを妨げないよう、ルート要素には `touch-none` を付与せず、`effectivePagingMode === 'paged'` のときのみ `<main>` 要素に条件付きで `touch-none` を適用する）
- **上下オーバーレイ連動（v0.6 Issue #202）**:
  - 画面中央タップまたは最下部タッチにより、上部オーバーレイ（`ReaderTopOverlay`）と下部オーバーレイ（`ReaderBottomOverlay`）が完全に同期してスライドイン展開・スライドアウト退避する。
  - シークバー操作（`onPageChange`）によるページ移動時は、オーバーレイを自動で閉じずに開いたまま維持し、ユーザーが目標ページを確認しながら連続して調整できるようにする。
- **Kindle様式タッチ・ジェスチャー操作（実効 `"paged"` 時）**:
  - **`touch-action: none`（`touch-none`）制御**:
    - 実効 `"paged"` モード時のジェスチャー捕捉領域（`<main>` 要素）にのみ CSS `touch-action: none`（Tailwind `touch-none`）を適用し、Android WebView 上でのブラウザネイティブスクロールによる `pointercancel` 割り込みを防止（連続スクロールモード時は適用しない）。
  - **リアルタイム指追従（Direct Manipulation）**:
    - 水平スワイプ中、指の変位量（`deltaX`）に合わせて本文表示が水平スライド追従する。
  - **2段階水平スライドアニメーション（タップ＆スワイプ離上共通: v0.6 Issue #201）**:
    - **次ページ（左端約 20% タップ ／ 左→右スワイプ離上確定 `dx > 0`）**:
      - `slideOffsetPx = +pageWidth`（`left: 0px`）へ向け、`200ms ease-out` で水平スライドアニメーションさせ、左スロットの次ページを画面中央へ滑り込ませる。完了時（200ms 後）に `onPageChange(currentPage + 1)` を確定し、同時にトランジションなし（`transition: none`）で `slideOffsetPx = 0` へ瞬間リセットする。
    - **前ページ（右端約 20% タップ ／ 右→左スワイプ離上確定 `dx < 0`）**:
      - `slideOffsetPx = -pageWidth`（`left: -2 * pageWidth`）へ向け、`200ms ease-out` で水平スライドアニメーションさせ、右スロットの前ページを画面中央へ滑り込ませる。完了時（200ms 後）に `onPageChange(currentPage - 1)` を確定し、同時にトランジションなしで `slideOffsetPx = 0` へ瞬間リセットする。
    - **スナップバック（Snap Back）**:
      - スワイプ移動量が画面幅の 30% 未満かつ低速フリック時は、元のページ位置（`slideOffsetPx = 0`）へ `200ms ease-out` で滑らかにスナップバック復帰（キャンセル）する。
    - **高速連打・連続操作の即時確定**:
      - スライドアニメーション中（`isAnimating === true`）に次のタップやドラッグ開始が行われた場合、直前の保留中ページ移動（`pendingTargetPage`）を即座に確定させた上で、次の操作（新アニメーション開始またはドラッグ追従）を遅滞なく開始し、操作の取りこぼしを完全に防ぐ。
    - **ハードウェア音量キー連携（v0.6 Issue #203）**:
      - `enableVolumeKeyPaging === true` のとき、ハードウェア音量キー（Volume Down / Up）によるページ送り・スクロール送りが有効化される。
      - **音量［ー］（Volume Down）**: 次へ進む。
        - 縦書きページめくりモード: 次ページへ 2段階水平スライドアニメーション付きで移動（タップ・スワイプ確定時と同一）。
        - 連続スクロールモード: 約1画面分（コンテナ幅／高さの 85% 分）順方向スクロール。
      - **音量［＋］（Volume Up）**: 前へ戻る。
        - 縦書きページめくりモード: 前ページへ 2段階水平スライドアニメーション付きで移動。
        - 連続スクロールモード: 約1画面分（コンテナ幅／高さの 85% 分）逆方向スクロール。
      - **エピソード境界での 2 段階操作（誤遷移防止）**:
        - 最終ページ（またはスクロール末尾到達時）での音量［ー］押下 1 回目で案内ヒント「もう一度操作で次の話へ」を表示し、2.5 秒以内の再押下で次エピソードへ遷移する（第1ページでの音量［＋］も同様）。
      - **オーバーレイ展開中の自動非表示**:
        - 上下オーバーレイ展開中に音量キー操作を行った場合、通常のページ送り同様にオーバーレイを自動で閉じる。
      - **ネイティブ音量キーインターセプト制御（購読順序・Promise例外保護：`R1-04`, `R1-08`）**:
        - リーダー画面表示中かつ `enableVolumeKeyPaging === true` の間のみ、Android ネイティブ側で `KEYCODE_VOLUME_DOWN` / `KEYCODE_VOLUME_UP` を捕捉（OSのシステム音量バー表示を抑止）し、Web 側へイベントを通知する。
        - 有効化時はイベント取りこぼしを防ぐため、**必ず `volumeKeyBridge.addVolumeKeyListener(...)` でリスナーを先行登録した後に** `volumeKeyBridge.setVolumeKeyPagingEnabled(true).catch(() => {})` を呼び出す。
        - リーダー離脱（アンマウント）時や設定 OFF 時はリスナーを解除するとともに `volumeKeyBridge.setVolumeKeyPagingEnabled(false).catch(() => {})` を呼び出してインターセプトを解除し、OS 標準の音量調整に戻す（Promise rejection 発生時も `.catch(() => {})` で安全に吸収し Unhandled Rejection を防止する）。
  - **縦書き（右開き）のタッチ領域**:
    - 画面左端（幅約 20%）タップ: 次のページ（2段階水平スライドアニメーション）
    - 画面右端（幅約 20%）タップ: 前のページ（2段階水平スライドアニメーション）
    - 画面中央（幅約 60%）タップ: 上下オーバーレイ（`ReaderTopOverlay` / `ReaderBottomOverlay`）の開閉
  - **横書き（左開き）のタッチ領域**:
    - 横書き時は常に実効 `"scroll"`（連続スクロール）に固定されるため、縦書き時のみページめくりタップ領域が有効となる。
  - **タップとドラッグの誤判定防止**: 移動 10px 未満かつ 300ms 未満はタップ判定とする。
- **エピソード境界シームレス遷移（前後話移動）**:
  - **ページめくり時**:
    - 最終ページでさらに「次へ」、第 1 ページで「前へ」引いた際はラバーバンド抵抗感（変位減衰）を付与。
    - 画面幅の 30% 以上引くと案内バッジ（`data-testid="reader-episode-boundary-hint"`、「指を離して次の話へ／前の話へ」）を表示し、指離しで次話先頭（前話末尾）へシームレス遷移。30% 未満で離すとスナップバック。
    - **端ページでの 2 段階タップ（誤遷移防止）**: 最終ページで次ページタップ領域（左 20%）を押下した 1 回目（または第 1 ページで前ページタップ領域［右 20%］を押下した 1 回目）において、即座に遷移せず案内ヒント「もう一度タップで次の話へ／前の話へ」（`data-testid="reader-episode-boundary-hint"`）を画面中央に表示。案内ヒント表示中（2.5 秒以内）に同方向タップが再入力された 2 回目で直ちに前後話へ遷移する（2.5 秒無操作で自動消去・リセット）。
  - **連続スクロール時**:
    - 本文先頭の「前の話へ」ボタン（`reader-scroll-prev-chapter`）および本文末尾の「次の話へ」ボタン（`reader-scroll-next-chapter`）による前後話移動。
    - 端での 2 段階スワイプ実機対応（ネイティブスクロールの `pointercancel` に阻害されないよう Touch Event / スクロール端検知）＋案内ヒント表示（2.5 秒無操作で自動消去・リセット）。
- **最下部タッチゾーン**:
  - 実効 `"scroll"` モード時: 画面最下部（下端約 72px、全幅 `left-0 right-0`）のタップ操作によりオーバーレイ開閉をトグルする。
  - 実効 `"paged"` モード時: 左右端 20%（`left-0 w-[20%]` / `right-0 w-[20%]`）の次/前ページめくりタップ領域とのイベント競合・誤動作を解消するため、最下部タッチゾーンを画面中央 60%（`left-[20%] right-[20%]`）に制限して配置する。
- **ジェスチャータイマークリーンアップおよび話数・モード切替時の状態リセット・スクロール境界同期（`useReaderGestures`：`R1-18`, `R1-19`）**:
  - ページ送りアニメーション完了タイマー（`animationTimerRef`）、境界ヒント自動消去タイマー（`boundaryTapTimerRef`, `scrollBoundaryTimerRef`）を保持し、再操作時およびコンポーネントアンマウント時に `clearTimeout` による確実な破棄を行う。
  - エピソード切替（`chapterIndex` 変化）または実効ページ送りモード切替（`isPaged` 変化）が発生した際は、進行中の `animationTimerRef` や境界タイマーを即座にクリアし、`pendingTargetPageRef`、`lastTargetPageRef`、`isAnimating`、`slideOffsetPx`、`boundaryHint`、およびスクロール端到達フラグ（`reachedStartRef` / `reachedEndRef` / `wasAtStartOnDownRef` / `wasAtEndOnDownRef`）をすべて初期状態（`false`）へリセットすることで、旧エピソードの遅延タイマー発火によるページ位置上書き競合（`R1-19`）や境界状態の持ち越し（`R1-18`）を防止する。
  - 連続スクロールモード（`!isPaged`）においては、`syncScrollBoundaryState()` により各操作開始時（`handlePointerDown`, `handleTouchStart`, `handleWheel`, `handleVolumeKey`）に `getScrollElement()` の実 DOM 座標（および 1 画面短文 `maxScroll <= 0` の両端到達判定）から `reachedStartRef` / `reachedEndRef` を同期し、`scroll` イベント発火前の初期状態でも端での 2 段階遷移が確実に発動するようにする。また `triggerVolumeKeyBoundary` により 2 回目押下で前後話遷移が確定した際にも、境界タイマーおよび端到達フラグ（`reachedStartRef` / `reachedEndRef`）を即座に `false` へリセットする。
- **自動非表示（Auto-Hide）**:
  - オーバーレイ表示中に「本文エリアのスクロール／ページ送り操作」「本文エリアの再タップ」「前後話への移動」が行われた場合は、自動的にオーバーレイを閉じる（※シークバー操作時は除く）。
- **メイン表示領域の排他描画ルール**:
  1. `error` が非 null の場合: エラー表示要素 `data-testid="reader-error"`（`role="alert"`）を描画し、**上下オーバーレイを最初から開いた状態とする**。また、エラー要素内に「内蔵ブラウザで開いて取り込む」ボタン（`data-testid="reader-open-webview-button"`）を配置し、タップ時に `onOpenWebView` を呼び出して内蔵ブラウザ画面（`SCR-04`: `/browser?url=...&novelId=...&chapterIndex=...`）へフォールバック遷移（`TR-10`）できること。
  2. `error === null` かつ `isLoading === true` かつ表示可能な本文（`chapter?.bodyHtml`）が未取得の場合: ローディング表示要素 `data-testid="reader-loading"` を描画する。
  3. `error === null` かつ `isLoading === false` かつ（`novel === null` または `chapter === null` または `chapter.bodyHtml === null`）の場合: 空状態要素 `data-testid="reader-empty"` を描画し、**上下オーバーレイを最初から開いた状態とする**。
  4. 上記以外（`novel !== null` かつ `chapter?.bodyHtml` が存在する場合）: 全画面 `ReaderView` を描画し、オーバーレイは初期非表示（画面中央タップまたは最下部タッチで開閉可能）とする。

---

### 3.7 `ReaderContainer`（リーダー画面 Container コンポーネント）

`useReader` フック、ルーター遷移コールバック、下部タブ遷移時の `flushBookmark` 連携、および OS バックキー・上部オーバーレイ「← 目次」ボタンによる目次復帰時のしおり保存を統合する Container コンポーネントです。

#### プロパティ契約（`ReaderContainerProps`）

| プロパティ名         | 型                                                | 必須 | 説明                                                                                                                             |
| :------------------- | :------------------------------------------------ | :--- | :------------------------------------------------------------------------------------------------------------------------------- |
| `novelId`            | `string`                                          | 任意 | ルート `/novels/:novelId/chapters/:chapterIndex` から渡される対象作品 ID                                                         |
| `chapterIndex`       | `number`                                          | 任意 | ルートから渡される対象エピソード連番（1始まり、省略時は `1`）                                                                    |
| `initialWorkUrl`     | `string`                                          | 任意 | 単体検証・手動取得時の対象作品 URL（既定値: 検証用カクヨム作品 URL）                                                             |
| `activeTab`          | `BottomTab`                                       | 任意 | リーダー画面のアクティブタブ（省略時: `"bookshelf"`）                                                                            |
| `onBackToBookshelf`  | `() => void`                                      | 任意 | 「本棚へ戻る」（`/`）コールバック（省略時はルーター環境下で `navigateToBookshelf` を使用）                                       |
| `onNavigateSettings` | `() => void`                                      | 任意 | 「設定へ」（`/settings`）コールバック（省略時はルーター環境下で `navigateToSettings`）                                           |
| `onNavigateChapter`  | `(novelId: string, chapterIndex: number) => void` | 任意 | 前後話遷移コールバック（省略時はルーター環境下で `navigateToReader` を使用し、内部話数も同期）                                   |
| `onBackToToc`        | `() => void`                                      | 任意 | 「← 目次」押下時のコールバック（省略時は `flushBookmark` 実行後に `navigateToNovelDetail` を呼び出す、TR-06）                    |
| `onOpenWebView`      | `(url: string) => void`                           | 任意 | エラー画面等からの内蔵ブラウザ遷移コールバック（省略時は `useRouter().navigateToBrowser(url)` を使用、TR-10、`v0.9` Issue #269） |

---

## 4. 状態管理・オンデマンド取得・しおり保存パイプライン（`useReader`）

### 4.1 `useReader` フック契約（`UseReaderResult`）

```ts
export interface UseReaderOptions {
  novelId?: string;
  chapterIndex?: number;
  initialWorkUrl?: string;
}

export interface GoToChapterOptions {
  startAt?: "start" | "end";
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
  fontFamily: ReaderFontFamily; // 【新設: v0.5 Issue #169】
  pageMarginPx: number; // 【新設: v0.5 Issue #169】
  initialScrollProgress: number;
  scrollProgress: number;
  pagingMode: ReaderPagingMode; // 【新設: v0.4 Issue #122】
  effectivePagingMode: "paged" | "scroll"; // 【新設: v0.4 Issue #122】
  enableVolumeKeyPaging: boolean; // 【新設: v0.6 Issue #203】
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
  goToChapter: (
    targetChapterIndex: number,
    options?: GoToChapterOptions,
  ) => Promise<boolean>;
  fetchNovelFromUrl: () => Promise<void>;
}
```

### 4.2 パイプライン仕様

1. **設定の初期読み出しと変更永続化**:
   - マウント時に `settingsRepository.getReaderSettings()` を呼び出し、保存済みの `writingMode`, `theme`, `fontSizePx`（初期値 `18`）, `lineHeight`（初期値 `1.8`）, `fontFamily`（初期値 `'biz-ud-mincho'`）, `pageMarginPx`（初期値 `20`）, `pagingMode`（初期値 `'auto'`）, `enableVolumeKeyPaging`（初期値 `false`、v0.6 Issue #203）を復元する。
   - `toggleWritingMode`, `changeTheme`, `changeFontSize`（`12〜32` にクランプ）, `changeLineHeight`（`1.4〜2.4` にクランプ・小数第1位丸め）, `changePagingMode`（`'auto' | 'paged' | 'scroll'`）実行時は、即座に State を更新するとともに `settingsRepository.updateReaderSettings(patch)` で非同期保存する。
   - 実効モード `effectivePagingMode` は、純粋関数 `resolveEffectivePagingMode(pagingMode, writingMode)` に基づき、`writingMode === 'horizontal-tb'` の場合は常に `'scroll'`、`writingMode === 'vertical-rl'` の場合は `pagingMode === 'scroll' ? 'scroll' : 'paged'` として動的に算出する（v0.5 Issue #168: 横書き時は連続スクロール固定）。
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
     - `targetNovel.bookmarkChapterIndex === targetChapterIndex`（保存済みしおり話と一致する場合）: 保存済みの `targetNovel.bookmarkScrollProgress`（`0.0 〜 1.0`）を `initialScrollProgress` および `scrollProgress` にセットして位置を復元する。実効 `"paged"` モード時は、**ユーザーがページ移動操作（`goToPage` / `nextPage` / `prevPage`）を行うまでの初期レイアウト・フォント計測期間中（`!hasUserChangedPageRef.current`）に呼び出されるすべての `setTotalPages(validTotal)` において**、`targetPage = validTotal > 1 ? Math.round(initialScrollProgress * (validTotal - 1)) + 1 : 1` で現在ページを再算出し復元する（これにより初回仮計測後の `requestAnimationFrame` や `document.fonts.ready` 等による確定総ページ数通知時にも、中間ページが最終ページや先頭ページへ化けることなく正確に復元される：`R1-26`, `AC-RD-20`）。ユーザーが一度でもページ移動操作を行った後（`hasUserChangedPageRef.current === true`）の総ページ数変更時（ウィンドウリサイズ等）は、初期進捗率への巻き戻しを行わず現在ページ位置を維持し範囲外クランプのみ行う。
     - `targetNovel.bookmarkChapterIndex !== targetChapterIndex`（別話を開いた場合、または前後話遷移 `TR-05` 時）: `initialScrollProgress = 0`, `scrollProgress = 0`, `currentPage = 1` にセットし、直ちに `novelRepository.updateBookmark(targetNovel.id, targetChapterIndex, 0)` を実行してしおりを現在話の先頭へ更新する。
   - **スクロール／ページめくり操作時および画面離脱時**:
     - ユーザースクロール時またはページ遷移時（`goToPage(targetPage)` / `nextPage()` / `prevPage()`）、算出された進捗率 `progress = totalPages > 1 ? (currentPage - 1) / (totalPages - 1) : 0`（`0.0 〜 1.0`）で `scrollProgress` を更新し、`novelRepository.updateBookmark(novel.id, chapterIndex, clampedProgress)` で DB へ自動保存する。
     - OS バックキー（`TR-06`）による目次復帰、または下部オーバーレイの4タブ（本棚 `TR-01b`、検索/ランキング/設定 `TR-01`）遷移時には、`flushBookmark()` により最新の `(chapterIndex, scrollProgress)` を確実に DB 保存してから画面遷移コールバックを呼び出す。
5. **前後エピソード遷移（`goToChapter(targetChapterIndex, options?: GoToChapterOptions)`、`TR-05`）**:
   - `novel === null`、または `targetChapterIndex < 1` もしくは `targetChapterIndex > totalChapters`（範囲外）が指定された場合は何もせず `false` を返す。
   - 有効範囲内の場合は、遷移前の現在話（次話遷移時を含む）に対して `chapterRepository.markChapterRead(novel.id, chapterIndex, true)` を実行した上で、`targetChapterIndex` のエピソード読み込み（未キャッシュ時はオンデマンド本文取得・`saveChapterBody` 保存）、表示完了時の `markChapterRead(novel.id, targetChapterIndex, true)`、および新エピソードへのしおり更新を実行し、`true` を返す。
   - **前話末尾復元（`startAt: "end"`）とルーター同期時の重複初期化抑止（R1-07, R2-04）**: 前話遷移時など `options?.startAt === "end"` が指定された場合、新エピソードのしおり進捗率を `1.0`（`initialScrollProgress = 1.0, scrollProgress = 1.0`）として保存・初期化し、実効 `paged` 時は初回 `setTotalPages` 時に自動的に最終ページへ復元する（`AC-RD-18`）。デフォルト（`startAt === "start"`）は先頭 `0.0`。また、`goToChapter` 完了直後に親ルーターの `chapterIndex` プロパティが追従更新された際は、`lastGoToChapterIndexRef` により `loadInitialData` の二重実行を抑止し、復元済みのページ位置（`currentPage`）が `1` にリセットされるのを防止する。
6. **手動作品取得・更新パイプライン（`fetchNovelFromUrl()`）**:
   - 単体検証・手動取得トリガー時、対象 URL を `const targetUrl = novel?.canonicalUrl ?? initialWorkUrl` として解決した上で、**HTTP 通信を行う前に** `parserRegistry.requireParser(targetUrl)` および `parser.normalizeWorkUrl(targetUrl)` を呼び出す（未対応サイトや不正 URL の場合は通信を行わずに直ちに `error` をセットして終了する）。
   - 対応サイトの場合は `httpClient.getHtml({ url: normalizedWorkUrl })` で目次 HTML を取得し、`parser.parseNovelIndex(...)` → `novelRepository.upsertNovelWithToc(...)` で作品および目次を DB 保存する。
   - 対象話（`chapterIndex`）が存在する場合はエピソード本文を取得・サニタイズ解析して `chapterRepository.saveChapterBody(...)` で保存し、`markChapterRead` および `updateBookmark` を反映して表示を更新する。
7. **読書中の自動バックグラウンド先読みパイプライン（`v0.3`）**:
   - 現在話（第 $N$ 話）の本文読み込み完了後、自動的にバックグラウンド先読みを開始する。
   - 先読み対象: $N+1 \sim \min(N+5, \text{totalChapters})$。
   - 対象エピソードについて、SQLite 内のキャッシュが有効（`downloadedAt` から 7日以内）であれば通信をスキップする。
   - 未キャッシュまたは 7日経過エピソードが存在する場合、1話ごとに `PREFETCH_INTERVAL_MS`（1.5秒）のウェイトを空けて順次直列に取得・保存する（7日経過キャッシュは 3秒短タイムアウト、未キャッシュ話は 10秒標準タイムアウト）。
   - **先読み直列化とアンマウント・Abort 保護（R1-29, R2-13）**:
     - 先読みタスクの多重並行走行を防止するため、先行する先読みタスク（進行中の HTTP 通信含む）の完了を待機（直列化保証）してから新エピソードの先読み（初期 1.5秒ウェイト）を開始し、小説サイトへのリクエスト間隔が 1.5秒（`PREFETCH_INTERVAL_MS`）を下回る競合状態を防止する。
     - 初期データ読み込み（`loadInitialData`）の通信完了直後にマウント状態（`isMounted`）を検証し、先読みタスク（`startPrefetch`）では `AbortSignal` を `fetchAndSaveChapterBody` へ伝播させ、`httpClient.getHtml` 完了直後かつ `chapterRepository.saveChapterBody` 実行直前に `if (signal?.aborted) return null` ガードを行うことで、画面離脱・アンマウント後の DB 更新（本文・しおり・既読保存）および同期通知（`syncEngine.notifyChanged`）を確実にスキップする。
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

| AC ID          | 対象機能                                                                                 | 検証条件                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 関連要件 / 遷移                                                    |
| :------------- | :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------- |
| **`AC-RD-01`** | 本文表示と未キャッシュ話オンデマンド取得                                                 | キャッシュ済み話は通信なしで即時表示され、未キャッシュ話（`bodyHtml === null`）を開いた場合は自動的に HTML 取得・サニタイズ解析・DB 保存（`saveChapterBody`）が行われて作品名・サブタイトル・本文が表示されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `SYS-REQ-02` / `TR-03`, `TR-04`, `TR-05`                           |
| **`AC-RD-02`** | ルビ・傍点の正確な描画とサニタイズ                                                       | 本文中の `<ruby>`（`<rt>`, `<rp>`）および傍点 `<em class="bouten">` が XSS サニタイズを維持したまま組版崩れなく描画されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `SYS-REQ-07`                                                       |
| **`AC-RD-03`** | 縦書き / 横書き切替と永続化                                                              | 設定画面（`SCR-05`）等での組み方向変更により、`ReaderView` の `vertical-rl`（縦書き）と `horizontal-tb`（横書き）が即座に反映され、`reader_settings` テーブルへ永続化されてリロード後も維持されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `SYS-REQ-08`                                                       |
| **`AC-RD-04`** | 4カラーテーマ切替と永続化                                                                | 設定画面（`SCR-05`）等でのカラーテーマ変更（light/sepia/dark/black）が `ReaderView` に即座に反映され、`reader_settings` テーブルへ永続化されてリロード後も維持されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `SYS-REQ-10`                                                       |
| **`AC-RD-05`** | 文字サイズ・行間設定と永続化                                                             | 設定画面（`SCR-05`）等での文字サイズ（`12〜32px`）および行間（`1.4〜2.4`）変更が `ReaderView` に即座に反映され、`reader_settings` テーブルへ永続化されてリロード後も維持されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `SYS-REQ-09`                                                       |
| **`AC-RD-06`** | 前後エピソード連続遷移とオーバーレイ連携                                                 | `ReaderBottomOverlay` 内の「前の話へ」「次の話へ」ボタンで同一作品の `chapterIndex ± 1` へ遷移（`TR-05`）でき、第1話では「前の話へ」が `disabled`、最終話では「次の話へ」が `disabled` となること。遷移後はオーバーレイが自動的に隠れ、キャッシュ済みの話への遷移時はスピナーを挟まず即座に新エピソード本文が描画される一方、未キャッシュ話への遷移時（オンデマンド Web 通信発生時）は直前の本文を非表示にして `reader-loading` が明示され、取得完了後に新本文が描画されること（v0.7 Issue #238）。                                                                                                                                                                                                                                                                                                     | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-07`** | 既読フラグ（`is_read`）の自動更新                                                        | エピソード本文の表示完了時および次話遷移時（`TR-05`）に `markChapterRead(novelId, chapterIndex, true)` が実行され、作品詳細・目次画面（`SCR-02`）へ戻った際に閲覧済み話に `既読` バッジ（`episode-read-badge`）が表示されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `SYS-REQ-12` / `TR-05`, `TR-06`                                    |
| **`AC-RD-08`** | しおり話数・スクロール進捗率の保存復元                                                   | 現在閲覧中の `bookmark_chapter_index` とスクロール進捗率（`0.0〜1.0`）が自動保存され、下部オーバーレイの4タブ（本棚・検索・ランキング・設定）遷移時および OS バックキーによる目次復帰時にも `flushBookmark` が実行され、再開時に同じ話・スクロール位置が復元されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `SYS-REQ-12, 16, 20` / `TR-01`, `TR-03`, `TR-04`, `TR-05`, `TR-06` |
| **`AC-RD-09`** | 全画面テキスト表示化                                                                     | 外枠パディング（`p-3 md:p-6`）、カード枠線・影（`rounded-lg border shadow-sm`）、および常時表示のバーが撤廃され、画面全体（`100dvh`）に本文が全画面でレンダリングされること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `SYS-REQ-08, 11, 16`                                               |
| **`AC-RD-10`** | 最下部タッチによる下部オーバーレイ開閉                                                   | 画面最下部ゾーン（下端約 72px または 15% 領域）のタップで `ReaderBottomOverlay` がスライドイン表示され、本文スクロール・本文エリア再タップ・前後話遷移で自動的に隠れること。またエラー時（`reader-error`）や空状態時は最初から表示されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-11`** | リーダー表示による本棚「NEW」バッジ解除                                                  | 本棚で「NEW」バッジが表示されていた作品のリーダー画面（`SCR-03`）を開いた際（「続きから読む」`TR-03` 等）、`clearNewUpdate` が実行されて作品の `has_new_update` が 0 に解除され、本棚へ戻った際（`TR-01b` 等）に対象作品カードの「NEW」バッジが消去されていること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `SYS-REQ-04` / `TR-03`, `TR-01b`                                   |
| **`AC-RD-12`** | 読書中の 5 話自動先読み                                                                  | リーダーで第 $N$ 話を表示完了後、バックグラウンドで $N+1 \sim N+5$ 話が 1.5秒間隔のウェイト制御を挟んで順次キャッシュ取得され、`goToChapter` での移動時やリーダー離脱時に `AbortController` で安全に処理が中断・切り替えられること。また先読み中の通信失敗が現在読書画面にエラーを表示しないこと。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `SYS-REQ-02, 03` / `TR-05`, `TR-06`                                |
| **`AC-RD-13`** | キャッシュ鮮度管理とフォールバック                                                       | 取得から 7日以内のキャッシュは通信を行わず即座に本文が表示され、7日以上経過したキャッシュは 3秒短タイムアウトで再取得を試行し、通信タイムアウト・オフライン時には即座に既存キャッシュ本文（`bodyHtml`）を表示へフォールバックしてエラー画面を出さないこと。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `SYS-REQ-02` / `TR-03`, `TR-04`, `TR-05`                           |
| **`AC-RD-14`** | 読書進行・既読更新時のクラウド同期自動 Push                                              | 前後話移動時（`goToChapter`）や既読更新時（`markChapterRead`）にクラウド同期エンジンへ変更通知が行われ、2〜3秒デバウンスされた上で最新のしおり話数・既読エピソードリストが Google Drive へ自動 Push されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `SYS-REQ-06`                                                       |
| **`AC-RD-15`** | ページ送りモードに応じた組版・表示切替                                                   | 横書き（`horizontal-tb`）時は設定値に関わらず常に連続スクロール（`scroll`）に固定されること。縦書き（`vertical-rl`）時は設定値（`paged` または `auto` でページめくり、`scroll` で連続スクロール）に基づき即座に組版・操作モードが切り替わること（v0.5 Issue #168）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `SYS-REQ-11`                                                       |
| **`AC-RD-16`** | 縦書き水平ページめくり組版・総ページ数安定化                                             | 実効 `paged` モード時、縦書き（`writing-mode: vertical-rl`）の本文に CSS マルチカラム組版（`columns: 1`, `column-gap: (pageMarginPx * 2)px`）が適用されて文字・ルビの途中切断が根絶され、各スロット内は静的 `translateY(-(slotPage - 1) * pageHeight)` により縦アニメーションなしで表示され、右綴じ書籍に即した 3 スロット水平スワイプラック（`writing-mode: horizontal-tb; left: -pageWidth + slideOffsetPx`）により左側の次ページが画面内に水平スライド遷移し、画面隅に `reader-page-indicator`（例: `3 / 12`）が表示されること。総ページ数 `totalPages` はマルチカラム要素の `scrollHeight`（`Math.round((scrollHeight + pageMarginPx * 2) / pageHeight)`）から計測され、エピソード遷移直後・しおり復元時・2ページ目以降のリサイズ時にも縮小しないこと（v0.5 Issue #168, #169, #171 R1-28, R1-29）。 | `SYS-REQ-11`                                                       |
| **`AC-RD-17`** | touch-action制御・指追従・左右端タップ・2段階水平スライドアニメーション                  | ジェスチャー領域に `touch-action: none` が適用され、Android WebView 上での `pointercancel` 発生を防ぎ、左右ドラッグ中に表示がリアルタイムに水平追従すること。移動距離 30% 以上でページ送りが確定した際（または左右端 20% タップ時）にドラッグ位置（または初期位置）から `±pageWidth` まで 200ms ease-out の水平スライドアニメーションを経て次/前ページへ進み、完了時に `slideOffsetPx = 0` へ瞬間リセットされること。30% 未満で離した場合は滑らかにスナップバック復帰すること。スライドアニメーション中の連続タップ（高速連打）時は直前のページ遷移が即座に確定して次の操作が開始され、取りこぼしが発生しないこと。また画面中央タップで下部オーバーレイ開閉が動作すること（v0.5 Issue #168, #171 R1-28, v0.6 Issue #201）。                                                                             | `SYS-REQ-11`                                                       |
| **`AC-RD-18`** | ページめくり時の前後話遷移（スワイプ/2段階タップ）                                       | 最終ページでさらに次へ（左から右ドラッグ `dx > 0`）、第 1 ページで前へ（右から左ドラッグ `dx < 0`）した際にゴム抵抗感（変位減衰）が付与され、30% 以上引くと案内バッジ（`reader-episode-boundary-hint`）が表示され、指を離すことで次エピソード先頭（または前エピソード末尾）へシームレス遷移すること。また端ページでの左右 20% タップにおいて、1 回目で案内ヒント「もう一度タップで次の話へ／前の話へ」が表示され、2.5 秒以内の 2 回目タップで次話（前話）へ遷移すること（2.5 秒無操作で自動消去・リセット、v0.5 Issue #168, #171 R1-28）。                                                                                                                                                                                                                                                              | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-19`** | 連続スクロール時の前後話移動（ボタン/2段階スワイプ）                                     | 連続スクロールモード時、本文先頭に「前の話へ」ボタン（`reader-scroll-prev-chapter`、第1話で disabled）、本文末尾に「次の話へ」ボタン（`reader-scroll-next-chapter`、最終話で disabled）が配置され、クリックで前後話へ移動できること。また末尾（または先頭）到達後のスワイプ操作においても、1 回目で案内ヒントが表示され、2.5 秒以内の 2 回目操作で次話（前話）へ遷移すること（v0.5 Issue #168）。                                                                                                                                                                                                                                                                                                                                                                                                       | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-20`** | ページめくりモードにおける進捗率保存・復元                                               | ページめくりモードにおいても現在ページ位置を進捗率（`0.0〜1.0`）として算出して DB 保存（`bookmark_scroll_progress`）され、再開時に該当ページ位置が復元されること。またスクロールモードとページめくりモードの切替時にも進捗位置が維持されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `SYS-REQ-12` / `TR-03`, `TR-04`, `TR-06`                           |
| **`AC-RD-21`** | フォント種別・画面余白のリーダー組版動的反映（v0.5 Issue #169）                          | 設定画面（`SCR-05`）で選択されたフォント種別（5種）および画面余白（`8〜48px`）が `ReaderView` に動的に適用されること。ハードコードされていた `font-serif` および `p-6` が廃止され、選択フォントの CSS スタックおよび動的余白（`columnGap: (pageMarginPx * 2)px`、段幅 `pageWidth - pageMarginPx * 2`、段高 `pageHeight - pageMarginPx * 2`）が反映され、文字・ルビ途切れや総ページ数欠損が起きないこと。                                                                                                                                                                                                                                                                                                                                                                                                | `SYS-REQ-09, 11`                                                   |
| **`AC-RD-22`** | 上部オーバーレイ新設と下部オーバーレイ連動（v0.6 Issue #202）                            | リーダー画面においてオーバーレイ展開時（`isOpen === true`）に上部オーバーレイ（`ReaderTopOverlay`）と下部オーバーレイ（`ReaderBottomOverlay`）が同時に画面端からスライドインし、本文中央タップ等の閉じる操作で同時に画面外へ退避（非表示時は `pointer-events-none`）すること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `SYS-REQ-11`                                                       |
| **`AC-RD-23`** | 長文タイトル・サブタイトルの1行固定省略保護（v0.6 Issue #202）                           | 上部オーバーレイに作品タイトル（`reader-top-novel-title`）とエピソードサブタイトル（`reader-top-chapter-title`）が上下2段で表示され、100文字超の長文であっても各1行固定で末尾 `...` 省略（`truncate`）され、上部オーバーレイの高さ変化やレイアウト崩れが一切発生しないこと。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `SYS-REQ-11`                                                       |
| **`AC-RD-24`** | 上部オーバーレイ「← 目次」ボタンによる目次復帰（v0.6 Issue #202）                        | 上部オーバーレイ左端の「← 目次」ボタン（`reader-top-back-to-toc`）を押下した際、現在のしおり進捗率が即座に SQLite へ保存（`flushBookmark`）された上で、作品詳細・目次画面（`SCR-02: /novels/:novelId`）へ遷移すること（`TR-06`）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `SYS-REQ-12` / `TR-06`                                             |
| **`AC-RD-25`** | 縦書きページめくり時の RTL ページシークバー（v0.6 Issue #202）                           | 縦書きページめくりモード（実効 `paged`）時のみ、下部オーバーレイの前後話ナビ上段に右→左（RTL: 右端1ページ、左端最終ページ）のレンジスライダー（`reader-page-seekbar`）が表示され、スライダー操作でオーバーレイを開いたまま任意ページへ即座に移動・しおり進捗更新ができること（連続スクロール時は非表示）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-26`** | 音量キーによるページ送り・スクロール送り連携（v0.6 Issue #203）                          | `enableVolumeKeyPaging === true` のとき、リーダー画面（`SCR-03`）で音量［ー］（Volume Down）押下により次ページ（または約85%順方向スクロール）、音量［＋］（Volume Up）押下により前ページ（または約85%逆方向スクロール）へ移動すること。縦書きページめくり時は2段階水平スライドアニメーションが適用されること。設定が OFF のときは音量キー操作でページ送り・スクロールが行われないこと。                                                                                                                                                                                                                                                                                                                                                                                                                 | `SYS-REQ-11` / `SCR-03`                                            |
| **`AC-RD-27`** | 音量キー操作におけるエピソード端2段階遷移およびオーバーレイ自動非表示（v0.6 Issue #203） | 最終ページ（またはスクロール末尾）で音量［ー］を押した際、1回目で案内ヒント（`reader-episode-boundary-hint`）が表示され、2.5秒以内の2回目押下で次エピソードへ遷移すること（第1ページでの音量［＋］も同様）。また上下オーバーレイ展開中に音量キー操作を行った際、自動的にオーバーレイが閉じること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `SYS-REQ-11` / `SCR-03`, `TR-05`                                   |
| **`AC-RD-28`** | 未キャッシュ話遷移時のローディング明示（新規）                                           | 前後エピソード遷移において、対象エピソードがローカル未キャッシュ（`bodyHtml === null`）で Web アクセスが発生する際、直前のエピソード本文を画面上に残留させず `data-testid="reader-loading"` を明示的に表示すること。通信完了時に新エピソード本文へ切り替わり、通信失敗時は `reader-error` が表示されること。すでに本文がキャッシュ済みのエピソードへの遷移ではローディングスピナーを描画せず即座に表示を切り替えること（v0.7 Issue #238）。                                                                                                                                                                                                                                                                                                                                                             | `SYS-REQ-02, 11` / `TR-05`                                         |
| **`AC-RD-29`** | 未キャッシュ話本文取得失敗時の内蔵ブラウザフォールバック導線（v0.9 Issue #269）          | 未キャッシュ話への遷移やリーダー読み込み時に本文取得エラーが発生した際、エラー表示要素（`data-testid="reader-error"`）内に「内蔵ブラウザで開いて取り込む」ボタン（`data-testid="reader-open-webview-button"`）が表示され、タップ時に該当話 URL と `novelId`, `chapterIndex` をパラメータとして内蔵ブラウザ画面（`SCR-04`: `/browser?url=...&novelId=...&chapterIndex=...`）へフォールバック遷移（`TR-10`）できること。                                                                                                                                                                                                                                                                                                                                                                                  | `SYS-REQ-13` / `TR-10`                                             |

---

## 7. Playwright システム結合テストシナリオ仕様（`SCN-01` / `SCN-06` / `SCN-07`）

### 7.1 `SCN-01` 結合シナリオ仕様（`test/it/scenarios/scn01-poc-vertical-reader.spec.ts`）

- **シナリオ ID**: `SCN-01`
- **目的**: 本棚画面（`SCR-01`）での URL 作品登録から、作品詳細・目次画面（`SCR-02`）での目次確認・更新・エピソード選択（`TR-02`, `TR-04`）、リーダー画面（`SCR-03`）での未キャッシュ話オンデマンド取得、全画面（100dvh）テキスト表示、縦書き・ルビ・傍点描画、画面中央タップによる上下連動オーバーレイ（`ReaderTopOverlay` / `ReaderBottomOverlay`）のスライドイン展開、RTLシークバー操作、目次復帰（`TR-06`）、スクロール操作による自動非表示、縦書き・横書き双方でのスクロール進捗保存と復元（`AC-RD-08`）、下部オーバーレイからの前後エピソード遷移（`TR-05`）、既読・しおり保存と作品詳細・本棚「続きから読む」からの再開復元（`TR-06`, `TR-04`, `TR-03`）、および作品削除（`TR-07`）までの一連のユーザー体験を一気通貫で検証する。
- **検証ステップ**:
  1. 初期表示（`/`）で本棚の空状態（`bookshelf-empty`）が表示されることを確認。
  2. 探索元（検索・ランキング画面またはテスト用サービス連携）より作品を登録し、本棚一覧に作品カード（`novel-card`）が追加され、しおり位置バッジ（`novel-card-bookmark`）に `未読` が表示されることを確認。
  3. 作品カード本体（`novel-card-select`）をクリックして `/novels/:novelId`（`SCR-02` 作品詳細・目次画面）へ遷移（`TR-02`）し、作品ヘッダー情報・章見出し・エピソード一覧（`未取得` バッジ）が表示されること、および「目次を更新」ボタン押下で最新状態が通知されることを確認。
  4. 目次一覧から第1話を選択して `/novels/:novelId/chapters/1`（`SCR-03`）へ遷移（`TR-04`）することを確認。
  5. 第1話本文がオンデマンド取得され、外枠余白・枠線のない全画面（`100dvh`）で `reader-view` が表示され、常時固定バーが表示されていないことを確認（`AC-RD-09`）。
  6. 初期表示が `writing-vertical-rl`（縦書き）であり、デフォルトの `pagingMode="auto"` により実効 `paged`（ページめくりモード）として各ページにブラウザ標準の縦書き CSS マルチカラム組版（`columns: 1`, `column-gap: 40px`［既定余白 20px 時］）が行われ、文字・ルビ・傍点の縦切断がなく正しくレンダリングされ、水平スライドにより画面隅にページインジケーター（`reader-page-indicator`）が表示されることを確認（`AC-RD-15`, `AC-RD-16`, `AC-RD-21`）。
  7. 画面中央領域をタップして上端から `ReaderTopOverlay`（`data-testid="reader-top-overlay"`）および下端から `ReaderBottomOverlay`（`data-testid="reader-bottom-overlay"`）が上下連動してスライドイン表示され、上部オーバーレイに作品タイトル（`reader-top-novel-title`）とエピソードサブタイトル（`reader-top-chapter-title`）が表示されること、下部オーバーレイに RTL ページシークバー（`reader-page-seekbar`）が表示され、第1話では「前の話へ」（`reader-prev-chapter`）が `disabled` かつ「次の話へ」（`reader-next-chapter`）が有効であること、および下部タブバーが表示されていることを確認（`AC-RD-10`, `AC-RD-17`, `AC-RD-22`, `AC-RD-25`）。シークバー操作で任意ページへ移動してもオーバーレイが開いたまま維持されることを確認。再度中央タップで両オーバーレイが非表示になることを確認。
  8. 画面左端領域（幅約 20%）をタップまたは 30% 以上水平ドラッグ離上して次ページへ2段階水平スライド遷移（30% 未満ドラッグ時はスナップバック維持）し、ページインジケーターが更新されること、および最終ページまでめくって端 2 段階タップ（1回目で案内ヒント表示、2回目で遷移）またはドラッグ離上することで次話（第2話）へシームレス遷移（`TR-05`）することを確認（`AC-RD-17`, `AC-RD-18`）。
  9. 上部オーバーレイの「← 目次」ボタン（`reader-top-back-to-toc`）押下、またはブラウザの戻る操作（OS バックキー相当）により現在の進捗率を保存して作品詳細（`SCR-02`）へ戻り（`TR-06`）、「続きから読む」（`TR-04`）で再開した際に保存された進捗率・ページ位置が復元されることを確認（`AC-RD-08`, `AC-RD-20`, `AC-RD-24`）。
  10. 設定画面（`SCR-05`）で「連続スクロール」を選択してリーダーに戻り、連続スクロール表示へ切り替わること、オーバーレイ展開時にページシークバー領域が表示されないこと、本文末尾の「次の話へ」ボタン（`reader-scroll-next-chapter`）または末尾到達後の 2 段階スワイプ・ホイール操作（1回目ヒント表示、2回目遷移）で次話へ遷移できることを確認（`AC-RD-15`, `AC-RD-19`, `AC-RD-25`）。
  11. 第2話でオーバーレイを表示し、「前の話へ」（`reader-prev-chapter`）をクリックして第1話へ戻る遷移（`TR-05`）を確認した後、再度第2話へ進む。
  12. オーバーレイを表示して下部タブ「本棚」をタップし、しおり進捗率が DB 保存（`flushBookmark`）された上で本棚画面（`/`）へ遷移（`TR-01b`）することを確認。本棚の作品カードに `しおり: 第2話` が表示され、「第2話から読む」（`novel-card-resume`）で第2話の位置が復元されること、および最後に `SCR-02` から作品を削除して本棚が空状態になることを確認（`TR-07`）。

### 7.2 `SCN-06` 結合シナリオ仕様（`test/it/scenarios/scn06-volume-key-paging.spec.ts`）

- **シナリオ ID**: `SCN-06`
- **目的**: 設定画面（`SCR-05`）での「音量キーでページ送り」ON/OFF トグル切替と永続化（`AC-ST-19`）、およびリーダー画面（`SCR-03`）でのハードウェア音量キー（音量［ー］/［＋］）による縦書きページめくり（2段階水平スライド）・連続スクロール送り（`AC-RD-26`）、エピソード境界での2段階前後話遷移とオーバーレイ展開中の自動非表示（`AC-RD-27`）を一気通貫で検証する。
- **検証ステップ**:
  1. 設定画面（`/settings`）で「音量キーでページ送り」トグル（`toggle-volume-key-paging`）の初期値が OFF（`aria-pressed="false"`）であることを確認し、タップして ON（`aria-pressed="true"`）に切り替え、リロード後も ON が永続化されていることを確認（`AC-ST-19`）。
  2. リーダー画面（`SCR-03`）を開き、縦書きページめくりモードにおいて音量［ー］操作で次ページ、音量［＋］操作で前ページへ2段階水平スライド遷移することを確認（`AC-RD-26`）。
  3. 画面中央タップで上下オーバーレイを展開した状態で音量［ー］操作を行い、オーバーレイが自動的に閉じることを確認（`AC-RD-27`）。
  4. 第1話の最終ページで音量［ー］を1回押下すると境界ヒント（`reader-episode-boundary-hint`: `もう一度操作で次の話へ`）が表示され、2.5秒以内の2回目押下で第2話へ遷移すること、および第2話の第1ページで音量［＋］を2回押下すると第1話末尾ページへ戻ることを確認（`AC-RD-27`）。
  5. 設定画面で「連続スクロール」に切り替えてリーダー画面へ戻り、音量［ー］/［＋］で約85%スクロール移動すること、およびスクロール末尾到達後の音量［ー］2段階操作で第2話へ遷移することを確認（`AC-RD-26`, `AC-RD-27`）。
  6. 設定画面で「音量キーでページ送り」トグルを OFF に戻し、リーダー画面で音量キー操作を行ってもページ移動やスクロールが発生しないことを確認（`AC-RD-26`）。

### 7.3 `SCN-07` 結合シナリオ仕様（`test/it/scenarios/scn07-webview-import-fallback.spec.ts`）

- **シナリオ ID**: `SCN-07`
- **目的**: 未キャッシュ話への遷移時やリーダー読み込み時に本文通信エラーが発生した際、エラー表示画面（`reader-error`）内の「内蔵ブラウザで開いて取り込む」ボタン（`reader-open-webview-button`, `TR-10`）から内蔵ブラウザ画面（`SCR-04`）へフォールバック遷移し、DOM インポート完了後にリーダー画面（`SCR-03`）へ直接復帰（`TR-11`）して縦書き本文・ルビが即座に描画され読書を再開できることを検証する（`AC-RD-29`, `AC-WV-06`）。
- **検証ステップ**:
  1. リーダー画面で未キャッシュエピソードを開き、HTTP 取得エラー（403/500/ネットワーク切断）を発生させて `reader-error` および「内蔵ブラウザで開いて取り込む」ボタンが表示されることを確認。
  2. ボタンを押下して `SCR-04: /browser?url=...&novelId=...&chapterIndex=...` へ遷移（`TR-10`）することを確認。
  3. 内蔵ブラウザ画面で DOM インポートを実行し、本文保存完了後に自動で `SCR-03: /novels/:novelId/chapters/:chapterIndex` へ遷移（`TR-11`）することを確認。
  4. ローディングスピナーを経て保存された本文が縦書きで描画され、読書が再開できることを確認。
