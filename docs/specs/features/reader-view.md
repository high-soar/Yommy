---
type: spec-feature
title: "小説リーダー画面仕様書（SCR-03: Novel Reader）"
description: "小説本文の全画面（100dvh）縦書き・横書き組版表示、最下部タッチによる下部オーバーレイ（ReaderBottomOverlay: 前後話ナビ＋下部タブ）、ルビ・傍点描画、4カラーテーマ・文字サイズ・行間設定の永続化、前後エピソード遷移、未キャッシュ話のオンデマンド取得、既読・しおり・スクロール進捗率の自動保存/復元、およびSCN-01統合シナリオの正本仕様。"
status: "Review (#79)"
updated: "2026-10-29"
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
related_specs:
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
  - docs/specs/changes/issue-79-four-tabs-search-ranking.md
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
---

# 小説リーダー画面仕様書（SCR-03）

本ドキュメントは、Yommy における小説本文閲覧（**`SCR-03`: ルート `/novels/:novelId/chapters/:chapterIndex`**）の全画面テキスト組版描画、最下部タッチによる下部オーバーレイ（前後話ナビ＋下部タブ）、しおり・スクロール進捗率・既読状態の自動保存、およびブラウザ環境におけるローカル永続化の仕様を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 小説リーダー画面（`SCR-03`、ルートパス `/novels/:novelId/chapters/:chapterIndex`）
- **対応要件**:
  - `SYS-REQ-02`（本文取得・オフライン閲覧・未キャッシュ話オンデマンド取得）
  - `SYS-REQ-07`（ルビ `<ruby>`・傍点 `<em class="bouten">` のサニタイズ済み組版描画）
  - `SYS-REQ-08`（全画面 `100dvh` での縦書き `vertical-rl` / 横書き `horizontal-tb` 表示）
  - `SYS-REQ-09`（文字サイズ `fontSizePx`・行間 `lineHeight` のカスタマイズと永続化 ※設定画面 `SCR-05` で変更、余白・フォント種別は `v0.4`）
  - `SYS-REQ-10`（4カラーテーマ `light` / `sepia` / `dark` / `black` 切り替え ※設定画面 `SCR-05` で変更）
  - `SYS-REQ-11`（全画面連続スクロール、最下部タッチによる `ReaderBottomOverlay` 開閉、および前後話ナビゲーションによる前話・次話への連続遷移 ※1画面タップ/音量キー送りは `v0.4`）
  - `SYS-REQ-12`（しおり話数 `bookmark_chapter_index`・本文スクロール進捗率 `bookmark_scroll_progress` の自動保存・復元、OSバックキー・下部タブ遷移時の `flushBookmark` 実行、および既読フラグ `is_read` の自動更新）
  - `SYS-REQ-20`（下部4タブバー・リーダーオーバーレイ4タブ化）
- **関連画面遷移**:
  - `TR-01`（下部オーバーレイの4タブ「本棚 `/`」「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」タップによる各画面への遷移）
  - `TR-03`（本棚画面 `SCR-01` の「続きから読む」から `SCR-03` への直接遷移）
  - `TR-04`（作品詳細・目次画面 `SCR-02` のエピソード選択または読書開始ボタンから `SCR-03` への遷移）
  - `TR-05`（`SCR-03` 内の下部オーバーレイ「前の話へ」「次の話へ」操作による同一作品の前後エピソード `chapterIndex ± 1` への遷移）
  - `TR-06`（OS バックキーまたは下部オーバーレイの4タブ遷移によりスクロール進捗率を保存して `SCR-02` `/novels/:novelId`、または各タブへ遷移）
- **対象外スコープ（後続 Milestone）**:
  - 読書中のバックグラウンド5話先読みおよびキャッシュ TTL 7日間制御（Milestone `v0.3` Issue #81：`SYS-REQ-02, 03`）
  - 画面左右タップ（`enableTapPaging`）およびハードウェア音量キー（`enableVolumeKeyPaging`）による1画面ジャンプ送り（Milestone `v0.4`：`SYS-REQ-11` 拡張）
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

画面最下部タッチにより下からスライドイン表示され、前後話ナビゲーションと下部タブバー（本棚/設定）を一体化して提供する Presentational コンポーネントです。

#### プロパティ契約（`ReaderBottomOverlayProps`）

| プロパティ名    | 型                                                                  | 必須 | 既定値        | 説明                                                                              |
| :-------------- | :------------------------------------------------------------------ | :--- | :------------ | :-------------------------------------------------------------------------------- |
| `isOpen`        | `boolean`                                                           | 必須 | -             | オーバーレイの表示・展開状態（`true` でスライドイン表示、`false` で画面外へ退避） |
| `chapterIndex`  | `number`                                                            | 必須 | -             | 現在表示中のエピソード連番（1始まり）                                             |
| `totalChapters` | `number`                                                            | 必須 | -             | 作品の全エピソード数                                                              |
| `isLoading`     | `boolean`                                                           | 任意 | `false`       | エピソード通信中フラグ                                                            |
| `activeTab`     | `'bookshelf' \| 'search' \| 'ranking' \| 'settings'`                | 任意 | `'bookshelf'` | リーダー画面の論理所属タブ（常に `'bookshelf'` をアクティブ表示）                 |
| `onPrevChapter` | `() => void`                                                        | 必須 | -             | 「前の話へ」ボタン押下時のコールバック                                            |
| `onNextChapter` | `() => void`                                                        | 必須 | -             | 「次の話へ」ボタン押下時のコールバック                                            |
| `onSelectTab`   | `(tab: 'bookshelf' \| 'search' \| 'ranking' \| 'settings') => void` | 任意 | -             | 下部タブ（本棚 / 検索 / ランキング / 設定）押下時のコールバック                   |
| `onClose`       | `() => void`                                                        | 任意 | -             | オーバーレイを閉じる要求コールバック                                              |

#### セマンティック属性とスタイル仕様

- **ルート要素**: `data-testid="reader-bottom-overlay"`、`aria-hidden={!isOpen}`
- **閉じるボタン**: `data-testid="reader-bottom-overlay-close"`（`onClose` 提供時に描画、`aria-label="オーバーレイを閉じる"`）
- **配置・アニメーション**: 画面下端固定（`fixed bottom-0 left-0 right-0 z-40`）、背景にはテーマに合わせた半透明または不透明背景（例: `bg-white/95 dark:bg-zinc-900/95 shadow-lg border-t border-zinc-200 dark:border-zinc-800`）、開閉時のなめらかなスライド（`transition-transform duration-200 ease-in-out`、`isOpen ? 'translate-y-0' : 'translate-y-full'`）。
- **上段（エピソードナビ）**: `ReaderChapterNav`（`data-testid="reader-chapter-nav"`）を描画し、前話/次話遷移と話数インジケーターを提供。
- **下段（下部タブバー）**: `data-testid="reader-bottom-tabs"`（`role="tablist"`）を描画し、各タブボタン `data-testid="reader-bottom-tab-bookshelf"`（「本棚」/ 常にアクティブ `aria-selected="true"` 表示）、`data-testid="reader-bottom-tab-search"`（「検索」）、`data-testid="reader-bottom-tab-ranking"`（「ランキング」）、`data-testid="reader-bottom-tab-settings"`（「設定」）を表示。

---

### 3.4 `ReaderView`（本文組版レンダリング ＆ スクロール進捗制御）

サニタイズ済み本文 HTML の縦書き・横書き組版、ルビ・傍点描画、テーマ・文字サイズ・行間適用、および全画面（`h-full w-full`）での縦横双方のスクロール進捗率（`0.0〜1.0`）算出・復元を担う Presentational コンポーネントです。

#### プロパティ契約（`ReaderViewProps`）

| プロパティ名             | 型                           | 必須 | 既定値          | 説明                                                                         |
| :----------------------- | :--------------------------- | :--- | :-------------- | :--------------------------------------------------------------------------- |
| `title`                  | `string`                     | 任意 | -               | 作品タイトル                                                                 |
| `chapterTitle`           | `string`                     | 任意 | -               | 各話サブタイトル                                                             |
| `bodyHtml`               | `string`                     | 必須 | -               | サニタイズ済み本文 HTML（ルビ `<ruby>`, 傍点 `<em class="bouten">` 含む）    |
| `writingMode`            | `WritingMode`                | 任意 | `'vertical-rl'` | 組み方向（`'vertical-rl'` または `'horizontal-tb'`）                         |
| `theme`                  | `ReaderTheme`                | 任意 | `'light'`       | 背景・文字色テーマ（`'light'`, `'sepia'`, `'dark'`, `'black'`）              |
| `fontSizePx`             | `number`                     | 任意 | `18`            | 文字サイズ (px)                                                              |
| `lineHeight`             | `number`                     | 任意 | `1.8`           | 行間倍率                                                                     |
| `initialScrollProgress`  | `number`                     | 任意 | `0`             | 初期復元するスクロール進捗率（`0.0 〜 1.0`）                                 |
| `onScrollProgressChange` | `(progress: number) => void` | 任意 | -               | ユーザースクロール時に算出された進捗率（`0.0 〜 1.0`）を通知するコールバック |

#### セマンティック属性と組版・スクロール仕様

- **テスト用・検証用属性**:
  - `data-testid="reader-view"`
  - `data-writing-mode`: 現在の組み方向（`"vertical-rl"` または `"horizontal-tb"`）
  - `data-theme`: 現在のカラーテーマ（`"light"`, `"sepia"`, `"dark"`, `"black"`）
  - `data-font-size`: 現在の文字サイズ数値（`String(fontSizePx)`）
  - `data-line-height`: 現在の行間倍率（`String(lineHeight)`）
- **全画面レイアウト ＆ スタイル**:
  - カード装飾（`rounded-lg border shadow-sm`）および高さ制限（`h-[70vh] / max-h-[70vh]`）を撤廃し、画面全体（`h-full w-full`）をフルに使って本文を表示する。
  - 縦書き時: CSS `writing-mode: vertical-rl`、`text-orientation: mixed`、水平スクロール（`overflow-x-auto overflow-y-hidden`）。直交フロー（Orthogonal Flow）での横幅膨張を防ぐため `w-full max-w-full` を指定。
  - 横書き時: CSS `writing-mode: horizontal-tb`、垂直スクロール（`overflow-y-auto overflow-x-hidden`）。
  - フォント: 日本語明朝体（`font-serif`）をベースとし、禁則処理（`line-break: strict; word-break: break-word`）を適用。
  - ルビ・傍点: `<ruby>` はブラウザ標準のルビ表示、`<em class="bouten">` は CSS `text-emphasis: filled sesame`（セサミ傍点）で描画。
  - Storybook / VRT バリエーション: 4カラーテーマ・縦書き/横書き・カスタム組版・初期スクロール位置に加え、1280px / 375px の双方で画面幅を超える長文データを用いた水平スクロール（Overflow）検証ストーリー（`VerticalLongContent`）を備える。
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
  3. **スクロール位置復元の発火トリガー条件**:
     - マウント時、および `initialScrollProgress`・`bodyHtml`（エピソード切替時）・`writingMode`（縦書き/横書き切替時）のいずれかが変化したタイミングで、`clampedInitialProgress = Math.min(1, Math.max(0, initialScrollProgress))` に基づくスクロール位置復元を実行する。

---

### 3.5 `ReaderPage`（リーダー画面 Presentational コンポーネント）

全画面本文（`ReaderView`）と最下部タッチ連動の下部オーバーレイ（`ReaderBottomOverlay`）、および状態別表示（ローディング・エラー・空状態）を統合する画面レイアウトコンポーネントです。

#### プロパティ契約（`ReaderPageProps`）

| プロパティ名             | 型                                         | 必須 | 説明                                         |
| :----------------------- | :----------------------------------------- | :--- | :------------------------------------------- |
| `novel`                  | `NovelRecord \| null`                      | 必須 | 現在の作品レコード                           |
| `chapter`                | `ChapterRecord \| null`                    | 必須 | 現在のエピソードレコード                     |
| `chapterIndex`           | `number`                                   | 必須 | 現在のエピソード連番（1始まり）              |
| `totalChapters`          | `number`                                   | 必須 | 作品の全エピソード数                         |
| `writingMode`            | `WritingMode`                              | 必須 | 現在の組み方向                               |
| `theme`                  | `ReaderTheme`                              | 必須 | 現在のカラーテーマ                           |
| `fontSizePx`             | `number`                                   | 必須 | 現在の文字サイズ (px)                        |
| `lineHeight`             | `number`                                   | 必須 | 現在の行間倍率                               |
| `initialScrollProgress`  | `number`                                   | 必須 | 初期復元するスクロール進捗率（`0.0 〜 1.0`） |
| `isLoading`              | `boolean`                                  | 必須 | 読み込み・通信中フラグ                       |
| `error`                  | `string \| null`                           | 任意 | エラーメッセージ文字列                       |
| `onPrevChapter`          | `() => void`                               | 必須 | 「前の話へ」押下時（`TR-05`）                |
| `onNextChapter`          | `() => void`                               | 必須 | 「次の話へ」押下時（`TR-05`）                |
| `onScrollProgressChange` | `(progress: number) => void`               | 必須 | 本文スクロール進捗変化時                     |
| `onSelectTab`            | `(tab: 'bookshelf' \| 'settings') => void` | 任意 | 下部タブ押下時                               |
| `initialOverlayOpen`     | `boolean`                                  | 任意 | `false`（エラー/空状態時は `true`）          | オーバーレイ初期展開状態制御用 |

#### セマンティック属性とレイアウト・排他描画ルール

- **画面ルート**: `data-testid="reader-page"`（外枠パディングなし、`h-dvh w-full overflow-hidden relative`）
- **最下部タッチゾーン**:
  - 画面最下部（下端約 72px または画面高さ 15% の領域）へのタップ操作を検知。
  - **スワイプ誤検知防止**: タッチ開始（`pointerdown`）から終了（`pointerup`）までの移動距離が 10px 未満かつ 500ms 未満のタップ操作時のみオーバーレイ開閉をトグルする（スクロール操作では開閉しない）。
- **自動非表示（Auto-Hide）**:
  - オーバーレイ表示中に「本文エリアのスクロール操作」「オーバーレイ外（本文エリア）の再タップ」「前後話への移動」が行われた場合は、自動的にオーバーレイを閉じる。
- **メイン表示領域の排他描画ルール**:
  1. `error` が非 null の場合: エラー表示要素 `data-testid="reader-error"`（`role="alert"`）を描画し、**下部オーバーレイを最初から開いた状態とする**。
  2. `error === null` かつ `isLoading === true` かつ表示可能な本文（`chapter?.bodyHtml`）が未取得の場合: ローディング表示要素 `data-testid="reader-loading"` を描画する。
  3. `error === null` かつ `isLoading === false` かつ（`novel === null` または `chapter === null` または `chapter.bodyHtml === null`）の場合: 空状態要素 `data-testid="reader-empty"` を描画し、**下部オーバーレイを最初から開いた状態とする**。
  4. 上記以外（`novel !== null` かつ `chapter?.bodyHtml` が存在する場合）: 全画面 `ReaderView` を描画し、オーバーレイは初期非表示（最下部タッチで開閉可能）とする。

---

### 3.6 `ReaderContainer`（リーダー画面 Container コンポーネント）

`useReader` フック、ルーター遷移コールバック、下部タブ遷移時の `flushBookmark` 連携、および OS バックキーによる目次復帰時のしおり保存を統合する Container コンポーネントです。

#### プロパティ契約（`ReaderContainerProps`）

| プロパティ名         | 型                                                | 必須 | 説明                                                                                           |
| :------------------- | :------------------------------------------------ | :--- | :--------------------------------------------------------------------------------------------- |
| `novelId`            | `string`                                          | 任意 | ルート `/novels/:novelId/chapters/:chapterIndex` から渡される対象作品 ID                       |
| `chapterIndex`       | `number`                                          | 任意 | ルートから渡される対象エピソード連番（1始まり、省略時は `1`）                                  |
| `initialWorkUrl`     | `string`                                          | 任意 | 単体検証・手動取得時の対象作品 URL（既定値: 検証用カクヨム作品 URL）                           |
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
  isLoading: boolean;
  error: string | null;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  toggleWritingMode: () => Promise<void>;
  changeTheme: (theme: ReaderTheme) => Promise<void>;
  changeFontSize: (fontSizePx: number) => Promise<void>;
  changeLineHeight: (lineHeight: number) => Promise<void>;
  updateScrollProgress: (progress: number) => Promise<void>;
  flushBookmark: () => Promise<void>;
  goToChapter: (targetChapterIndex: number) => Promise<boolean>;
  fetchNovelFromUrl: () => Promise<void>;
}
```

### 4.2 パイプライン仕様

1. **設定の初期読み出しと変更永続化**:
   - マウント時に `settingsRepository.getReaderSettings()` を呼び出し、保存済みの `writingMode`, `theme`, `fontSizePx`（初期値 `18`）, `lineHeight`（初期値 `1.8`）を復元する。
   - `toggleWritingMode`, `changeTheme`, `changeFontSize`（`12〜32` にクランプ）, `changeLineHeight`（`1.4〜2.4` にクランプ・小数第1位丸め）実行時は、即座に State を更新するとともに `settingsRepository.updateReaderSettings(patch)` で非同期保存する。
2. **エピソード読み込みと未キャッシュ話オンデマンド取得（`TR-03`, `TR-04`, `TR-05`）**:
   - `novelId` 指定時は `novelRepository.getNovelById(novelId)`、` novelId` 未指定時は `novelRepository.listNovels()` の先頭作品を取得する（未登録時は空状態 `novel = null, chapter = null`）。
   - 対象エピソード `chapterRepository.getChapter(targetNovel.id, targetChapterIndex)` を取得する。
   - `chapter.bodyHtml === null`（未キャッシュ状態）の場合、自動的に `parserRegistry.requireParser(chapter.url)` → `httpClient.getHtml({ url: chapter.url })` → `parser.parseChapterContent(res.html, chapter.url)` → `chapterRepository.saveChapterBody(targetNovel.id, targetChapterIndex, parsed, new Date().toISOString())` を実行して DB に保存し、最新の `novel` と `chapter` を再取得する。
3. **既読フラグ（`is_read = 1`）の自動更新**:
   - エピソード本文（`bodyHtml !== null`）の表示準備が完了した時点で、`chapter.isRead === false` であれば直ちに `chapterRepository.markChapterRead(targetNovel.id, targetChapterIndex, true)` を実行する。
   - また「次の話へ」遷移（`TR-05`）実行時にも、現在話に対して `chapterRepository.markChapterRead(targetNovel.id, currentChapterIndex, true)` を確実に実行する。
4. **しおり（`bookmark_chapter_index`）とスクロール進捗率（`bookmark_scroll_progress`）の復元・自動保存（`SYS-REQ-12`, `TR-06`）**:
   - **エピソード表示開始時**:
     - `targetNovel.bookmarkChapterIndex === targetChapterIndex`（保存済みしおり話と一致する場合）: 保存済みの `targetNovel.bookmarkScrollProgress`（`0.0 〜 1.0`）を `initialScrollProgress` および `scrollProgress` にセットしてスクロール位置を復元する。
     - `targetNovel.bookmarkChapterIndex !== targetChapterIndex`（別話を開いた場合、または前後話遷移 `TR-05` 時）: `initialScrollProgress = 0`, `scrollProgress = 0` にセットし、直ちに `novelRepository.updateBookmark(targetNovel.id, targetChapterIndex, 0)` を実行してしおりを現在話の先頭へ更新する。
   - **スクロール操作時および画面離脱時**:
     - `updateScrollProgress(progress)` 呼び出し時、`0.0 〜 1.0` にクランプした進捗率で `scrollProgress` を更新し、`novelRepository.updateBookmark(novel.id, chapterIndex, clampedProgress)` で DB へ自動保存する。
     - OS バックキー（`TR-06`）による目次復帰、または下部オーバーレイ「本棚」タブ（`TR-01b`）・「設定」タブ（`TR-01`）遷移時には、`flushBookmark()` により最新の `(chapterIndex, scrollProgress)` を確実に DB 保存してから画面遷移コールバックを呼び出す。
5. **前後エピソード遷移（`goToChapter(targetChapterIndex)`、`TR-05`）**:
   - `novel === null`、または `targetChapterIndex < 1` もしくは `targetChapterIndex > totalChapters`（範囲外）が指定された場合は何もせず `false` を返す。
   - 有効範囲内の場合は、遷移前の現在話（次話遷移時を含む）に対して `chapterRepository.markChapterRead(novel.id, chapterIndex, true)` を実行した上で、`targetChapterIndex` のエピソード読み込み（未キャッシュ時はオンデマンド本文取得・`saveChapterBody` 保存）、表示完了時の `markChapterRead(novel.id, targetChapterIndex, true)`、および新エピソード先頭へのしおり更新（`updateBookmark(novel.id, targetChapterIndex, 0)`、`initialScrollProgress = 0`, `scrollProgress = 0`）を実行し、`true` を返す。
6. **手動作品取得・更新パイプライン（`fetchNovelFromUrl()`）**:
   - 単体検証・手動取得トリガー時、対象 URL を `const targetUrl = novel?.canonicalUrl ?? initialWorkUrl` として解決した上で、**HTTP 通信を行う前に** `parserRegistry.requireParser(targetUrl)` および `parser.normalizeWorkUrl(targetUrl)` を呼び出す（未対応サイトや不正 URL の場合は通信を行わずに直ちに `error` をセットして終了する）。
   - 対応サイトの場合は `httpClient.getHtml({ url: normalizedWorkUrl })` で目次 HTML を取得し、`parser.parseNovelIndex(...)` → `novelRepository.upsertNovelWithToc(...)` で作品および目次を DB 保存する。
   - 対象話（`chapterIndex`）が存在する場合はエピソード本文を取得・サニタイズ解析して `chapterRepository.saveChapterBody(...)` で保存し、`markChapterRead` および `updateBookmark` を反映して表示を更新する。

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

| AC ID          | 対象機能                                 | 検証条件                                                                                                                                                                                                                                                                            | 関連要件 / 遷移                                                    |
| :------------- | :--------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| **`AC-RD-01`** | 本文表示と未キャッシュ話オンデマンド取得 | キャッシュ済み話は通信なしで即時表示され、未キャッシュ話（`bodyHtml === null`）を開いた場合は自動的に HTML 取得・サニタイズ解析・DB 保存（`saveChapterBody`）が行われて作品名・サブタイトル・本文が表示されること。                                                                 | `SYS-REQ-02` / `TR-03`, `TR-04`, `TR-05`                           |
| **`AC-RD-02`** | ルビ・傍点の正確な描画とサニタイズ       | 本文中の `<ruby>`（`<rt>`, `<rp>`）および傍点 `<em class="bouten">` が XSS サニタイズを維持したまま組版崩れなく描画されること。                                                                                                                                                     | `SYS-REQ-07`                                                       |
| **`AC-RD-03`** | 縦書き / 横書き切替と永続化              | 設定画面（`SCR-05`）等での組み方向変更により、`ReaderView` の `vertical-rl`（縦書き）と `horizontal-tb`（横書き）が即座に反映され、`reader_settings` テーブルへ永続化されてリロード後も維持されること。                                                                             | `SYS-REQ-08`                                                       |
| **`AC-RD-04`** | 4カラーテーマ切替と永続化                | 設定画面（`SCR-05`）等でのカラーテーマ変更（light/sepia/dark/black）が `ReaderView` に即座に反映され、`reader_settings` テーブルへ永続化されてリロード後も維持されること。                                                                                                          | `SYS-REQ-10`                                                       |
| **`AC-RD-05`** | 文字サイズ・行間設定と永続化             | 設定画面（`SCR-05`）等での文字サイズ（`12〜32px`）および行間（`1.4〜2.4`）変更が `ReaderView` に即座に反映され、`reader_settings` テーブルへ永続化されてリロード後も維持されること。                                                                                                | `SYS-REQ-09`                                                       |
| **`AC-RD-06`** | 前後エピソード連続遷移とオーバーレイ連携 | `ReaderBottomOverlay` 内の「前の話へ」「次の話へ」ボタンで同一作品の `chapterIndex ± 1` へ遷移（`TR-05`）でき、第1話では「前の話へ」が `disabled`、最終話では「次の話へ」が `disabled` となること。遷移後はオーバーレイが自動的に隠れ、未キャッシュ話はオンデマンド取得されること。 | `SYS-REQ-11` / `TR-05`                                             |
| **`AC-RD-07`** | 既読フラグ（`is_read`）の自動更新        | エピソード本文の表示完了時および次話遷移時（`TR-05`）に `markChapterRead(novelId, chapterIndex, true)` が実行され、作品詳細・目次画面（`SCR-02`）へ戻った際に閲覧済み話に `既読` バッジ（`episode-read-badge`）が表示されること。                                                   | `SYS-REQ-12` / `TR-05`, `TR-06`                                    |
| **`AC-RD-08`** | しおり話数・スクロール進捗率の保存復元   | 現在閲覧中の `bookmark_chapter_index` とスクロール進捗率（`0.0〜1.0`）が自動保存され、下部オーバーレイの4タブ（本棚・検索・ランキング・設定）遷移時および OS バックキーによる目次復帰時にも `flushBookmark` が実行され、再開時に同じ話・スクロール位置が復元されること。            | `SYS-REQ-12, 16, 20` / `TR-01`, `TR-03`, `TR-04`, `TR-05`, `TR-06` |
| **`AC-RD-09`** | 全画面テキスト表示化                     | 外枠パディング（`p-3 md:p-6`）、カード枠線・影（`rounded-lg border shadow-sm`）、および常時表示のバーが撤廃され、画面全体（`100dvh`）に本文が全画面でレンダリングされること。                                                                                                       | `SYS-REQ-08, 11, 16`                                               |
| **`AC-RD-10`** | 最下部タッチによる下部オーバーレイ開閉   | 画面最下部ゾーン（下端約 72px または 15% 領域）のタップで `ReaderBottomOverlay` がスライドイン表示され、本文スクロール・本文エリア再タップ・前後話遷移で自動的に隠れること。またエラー時（`reader-error`）や空状態時は最初から表示されること。                                      | `SYS-REQ-11` / `TR-05`                                             |

---

## 7. SCN-01 結合シナリオ仕様（Playwright IT）

- **シナリオ ID**: `SCN-01`
- **目的**: 本棚画面（`SCR-01`）での URL 作品登録から、作品詳細・目次画面（`SCR-02`）での目次確認・更新・エピソード選択（`TR-02`, `TR-04`）、リーダー画面（`SCR-03`）での未キャッシュ話オンデマンド取得、全画面（100dvh）テキスト表示、縦書き・ルビ・傍点描画、画面最下部タップによる下部オーバーレイ（`ReaderBottomOverlay`）のスライドイン展開、スクロール操作による自動非表示、縦書き・横書き双方でのスクロール進捗保存と復元（`AC-RD-08`）、下部オーバーレイからの前後エピソード遷移（`TR-05`）、既読・しおり保存と作品詳細・本棚「続きから読む」からの再開復元（`TR-06`, `TR-04`, `TR-03`）、および作品削除（`TR-07`）までの一連のユーザー体験を一気通貫で検証する。
- **検証ステップ**:
  1. 初期表示（`/`）で本棚の空状態（`bookshelf-empty`）が表示されることを確認。
  2. 「URLから作品を追加」ダイアログを開き、カクヨム作品 URL を入力して登録を実行し、本棚一覧に作品カード（`novel-card`）が追加され、しおり位置バッジ（`novel-card-bookmark`）に `未読` が表示されることを確認。
  3. 作品カード本体（`novel-card-select`）をクリックして `/novels/:novelId`（`SCR-02` 作品詳細・目次画面）へ遷移（`TR-02`）し、作品ヘッダー情報・章見出し・エピソード一覧（`未取得` バッジ）が表示されること、および「目次を更新」ボタン押下で最新状態が通知されることを確認。
  4. 目次一覧から第1話を選択して `/novels/:novelId/chapters/1`（`SCR-03`）へ遷移（`TR-04`）することを確認。
  5. 第1話本文がオンデマンド取得され、外枠余白・枠線のない全画面（`100dvh`）で `reader-view` が表示され、常時固定バーが表示されていないことを確認（`AC-RD-09`）。
  6. 初期表示が `writing-vertical-rl`（縦書き）であり、本文内の `<ruby>`（ルビ）および `<em class="bouten">`（傍点）が可視状態で正しくレンダリングされていることを確認。
  7. 画面最下部ゾーンをタップし、下端から `ReaderBottomOverlay`（`data-testid="reader-bottom-overlay"`）がスライドイン表示され、第1話では「前の話へ」（`reader-prev-chapter`）が `disabled` かつ「次の話へ」（`reader-next-chapter`）が有効であること、および下部タブバーが表示されていることを確認（`AC-RD-10`）。
  8. 縦書き（`writing-vertical-rl`）状態で左方向（負の `scrollLeft`）へ水平スクロール操作を行い、スクロール開始に伴いオーバーレイが自動的に隠れること、および進捗率が自動保存されることを確認。
  9. ブラウザの戻る操作（OS バックキー相当）により現在のスクロール進捗率を保存して作品詳細（`SCR-02`）へ戻り、「続きから読む（第1話）」（`TR-04`）で再開した際に負の `scrollLeft` 位置が復元されることを確認（`AC-RD-08`）。
  10. 再度画面最下部ゾーンをタップしてオーバーレイを表示し、「次の話へ」（`reader-next-chapter`）をクリックして `/novels/:novelId/chapters/2` へ遷移（`TR-05`）することを確認。遷移後に第2話本文がオンデマンド取得され、オーバーレイが自動的に隠れることを確認。
  11. 第2話で最下部タップによりオーバーレイを表示し、「前の話へ」（`reader-prev-chapter`）をクリックして第1話へ戻る遷移（`TR-05`）を確認した後、再度第2話へ進んでスクロール操作を行う。
  12. オーバーレイを表示して下部タブ「本棚」をタップし、しおり進捗率が DB 保存（`flushBookmark`）された上で本棚画面（`/`）へ遷移（`TR-01b`）することを確認。本棚の作品カードに `しおり: 第2話` が表示され、「第2話から読む」（`novel-card-resume`）で第2話のスクロール位置が復元されること、および最後に `SCR-02` から作品を削除して本棚が空状態になることを確認（`TR-07`）。
