---
type: spec-feature
title: 小説リーダー画面仕様書（SCR-03: Novel Reader）
description: 小説本文の縦書き・横書き組版表示、ルビ・傍点描画、設定画面（SCR-05）連動の組版設定、前後エピソード遷移、未キャッシュ話のオンデマンド取得、既読・しおり・スクロール進捗率の自動保存/復元、OSバックキー階層遷移、およびSCN-01統合シナリオの正本仕様。
status: "Review (#50)"
updated: "2026-10-27"
tags: [reader, scr-03, vertical-writing, ruby, bouten, theme, typography, bookmark, scn01, back-button]
related_specs:
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/specs/db-schema.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/settings.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/issue-50-fullscreen-shell-and-settings.md
  - docs/specs/changes/archive/issue-12-bookshelf-and-routing.md
  - docs/specs/changes/archive/issue-13-novel-detail-and-toc.md
  - docs/specs/changes/archive/issue-14-reader-navigation-bookmark-settings.md
related_tests:
  - src/App.test.tsx
  - src/features/reader/hooks/useReader.test.ts
  - src/features/reader/components/ReaderToolbar.test.tsx
  - src/features/reader/components/ReaderChapterNav.test.tsx
  - src/features/reader/components/ReaderView.test.tsx
  - src/features/reader/components/ReaderPage.test.tsx
  - src/features/reader/components/ReaderContainer.test.tsx
  - test/vrt/vrt.spec.ts
  - test/it/smoke.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 小説リーダー画面仕様書（SCR-03）

本ドキュメントは、Yommy における小説本文閲覧（**`SCR-03`: ルート `/novels/:novelId/chapters/:chapterIndex`**）の全画面組版描画、前後エピソード遷移ナビゲーション、設定画面（`SCR-05`）連動の組版反映、しおり・スクロール進捗率・既読状態の自動保存、OS バックキー論理階層復帰、およびブラウザ環境におけるローカル永続化の仕様を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 小説リーダー画面（`SCR-03`、ルートパス `/novels/:novelId/chapters/:chapterIndex`）
- **対応要件**:
  - `SYS-REQ-02`（本文取得・オフライン閲覧・未キャッシュ話オンデマンド取得）
  - `SYS-REQ-07`（ルビ `<ruby>`・傍点 `<em class="bouten">` のサニタイズ済み組版描画）
  - `SYS-REQ-08`（設定画面 `SCR-05` で設定された縦書き `vertical-rl` / 横書き `horizontal-tb` の自動適用）
  - `SYS-REQ-09`（設定画面 `SCR-05` で設定された文字サイズ `fontSizePx`・行間 `lineHeight` の自動適用）
  - `SYS-REQ-10`（設定画面 `SCR-05` で設定された 4カラーテーマ `light` / `sepia` / `dark` / `black` の自動適用）
  - `SYS-REQ-11`（連続スクロールおよび前話・次話への連続遷移 ※1画面タップ/音量キー送りは `v0.3`）
  - `SYS-REQ-12`（しおり話数 `bookmark_chapter_index`・本文スクロール進捗率 `bookmark_scroll_progress` の自動保存・復元、および既読フラグ `is_read` の自動更新）
  - `SYS-REQ-16`（全画面シェル・論理階層遷移：100dvh 全画面表示、`ReaderToolbar` 廃止、OS バックキーによる目次復帰としおり自動フラッシュ保存）
- **関連画面遷移**:
  - `TR-03`（本棚画面 `SCR-01` の「続きから読む」から `SCR-03` への直接遷移 ※目次を履歴スタックに介在）
  - `TR-04`（作品詳細・目次画面 `SCR-02` のエピソード選択または読書開始ボタンから `SCR-03` への遷移）
  - `TR-05`（`SCR-03` 内の「前の話へ」「次の話へ」操作による同一作品の前後エピソード `chapterIndex ± 1` への遷移 ※`replaceState` 適用）
  - `TR-06`（OS バックキーまたはブラウザ戻る操作により、最新のスクロール進捗率を自動保存して作品詳細・目次画面 `SCR-02` `/novels/:novelId` へ戻る論理階層遷移）
- **対象外スコープ（後続 Milestone）**:
  - 本文全画面化および画面最下部タッチによるオーバーレイ（前後話ナビ＋下部タブ）表示制御（Issue #52 スコープ）
  - 画面余白（`pageMarginPx`）・フォント種別（`fontFamily`）の UI カスタマイズ（Milestone `v0.3`：`SYS-REQ-09` 拡張）
  - 画面左右タップ（`enableTapPaging`）およびハードウェア音量キー（`enableVolumeKeyPaging`）による1画面ジャンプ送り（Milestone `v0.3`：`SYS-REQ-11` 拡張）
  - 取得失敗時の内蔵 WebView フォールバック遷移 `TR-10`（Milestone `v0.4`：`SYS-REQ-13`）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/reader/` 配下を以下のモジュール構成とします（`ReaderToolbar` は組版設定の設定画面 `SCR-05` への移設に伴い廃止します）。

```text
src/features/reader/
├── hooks/
│   ├── useReader.ts                       # エピソード取得・オンデマンド通信・既読/しおり保存・組版設定読み出しフック
│   └── useReader.test.ts                  # フック単体テスト（Vitest）
└── components/
    ├── ReaderChapterNav.tsx               # 前話へ / 現在話数 / 次話へナビゲーションバー（Presentational）
    ├── ReaderChapterNav.stories.tsx
    ├── ReaderChapterNav.test.tsx
    ├── ReaderView.tsx                     # 本文組版・ルビ/傍点描画・縦横スクロール進捗率算出/復元（Presentational）
    ├── ReaderView.stories.tsx
    ├── ReaderView.test.tsx
    ├── ReaderPage.tsx                     # リーダー画面全体の全画面レイアウト統合・状態別排他描画（Presentational）
    ├── ReaderPage.stories.tsx
    ├── ReaderPage.test.tsx
    ├── ReaderContainer.tsx                # ServiceProvider / Router / useReader を接続する Container
    ├── ReaderContainer.stories.tsx
    └── ReaderContainer.test.tsx
```

---

## 3. 各コンポーネント・フックの詳細契約

### 3.1 `ReaderToolbar`（廃止・設定画面へ移設）

> [!NOTE]
> `ReaderToolbar` は、小説本文表示領域の圧迫解消および全画面化のため、Issue #50 にて廃止されました。組版設定 4 項目（組み方向、カラーテーマ、文字サイズ、行間）は設定画面（`SCR-05`: `/settings`、正本: [docs/specs/features/settings.md](settings.md)）へ完全移設され、目次への復帰は OS バックキー（ブラウザ戻る、`TR-06`）により行われます。

---

### 3.2 `ReaderChapterNav`（前後エピソード遷移ナビゲーションバー）

同一作品の「前の話へ」「次の話へ」の連続遷移（`TR-05`）と現在話数インジケーターを常時表示する Presentational コンポーネントです。

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

### 3.3 `ReaderView`（本文組版レンダリング ＆ スクロール進捗制御）

サニタイズ済み本文 HTML の縦書き・横書き組版、ルビ・傍点描画、テーマ・文字サイズ・行間適用、および縦横双方のスクロール進捗率（`0.0〜1.0`）算出・復元を担う Presentational コンポーネントです。

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
- **日本語組版スタイル**:
  - 縦書き時: CSS `writing-mode: vertical-rl`、`text-orientation: mixed`、水平スクロール（`overflow-x-auto overflow-y-hidden`）。親要素（`horizontal-tb`）との直交フロー（Orthogonal Flow）においてブロック軸（横幅）がコンテンツ全文の幅まで膨張しないよう、ルート要素に `w-full max-w-full`（および親 `ReaderPage` の `<main>` に `w-full min-w-0`）を指定して親コンテナ幅（100%）に制約する。
  - 横書き時: CSS `writing-mode: horizontal-tb`、垂直スクロール（`overflow-y-auto overflow-x-hidden`）
  - フォント: 日本語明朝体（`font-serif`）をベースとし、禁則処理（`line-break: strict; word-break: break-word`）を適用
  - ルビ・傍点: `<ruby>` はブラウザ標準のルビ表示、`<em class="bouten">` は CSS `text-emphasis: filled sesame`（セサミ傍点）で描画
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
     - マウント時、および `initialScrollProgress`・`bodyHtml`（エピソード切替時）・`writingMode`（縦書き/横書き切替時）のいずれかが変化したタイミングで、`clampedInitialProgress = Math.min(1, Math.max(0, initialScrollProgress))` に基づくスクロール位置復元を実行する（これにより、`initialScrollProgress` が `0 → 0` のまま別エピソードへ遷移した場合でも確実に先頭位置へリセットされ、組み方向切替時にも進捗位置が同期される）。

---

### 3.4 `ReaderPage`（リーダー画面 Presentational コンポーネント）

`ReaderChapterNav` および状態別のメイン表示領域（ローディング・エラー・空状態・`ReaderView`）を統合する全画面レイアウトコンポーネントです（`ReaderToolbar` は非描画）。

#### プロパティ契約（`ReaderPageProps`）

| プロパティ名             | 型                             | 必須 | 説明                                          |
| :----------------------- | :----------------------------- | :--- | :-------------------------------------------- |
| `novel`                  | `NovelRecord \| null`          | 必須 | 現在の作品レコード                            |
| `chapter`                | `ChapterRecord \| null`        | 必須 | 現在のエピソードレコード                      |
| `chapterIndex`           | `number`                       | 必須 | 現在のエピソード連番（1始まり）               |
| `totalChapters`          | `number`                       | 必須 | 作品の全エピソード数                          |
| `writingMode`            | `WritingMode`                  | 必須 | 現在の組み方向                                |
| `theme`                  | `ReaderTheme`                  | 必須 | 現在のカラーテーマ                            |
| `fontSizePx`             | `number`                       | 必須 | 現在の文字サイズ (px)                         |
| `lineHeight`             | `number`                       | 必須 | 現在の行間倍率                                |
| `initialScrollProgress`  | `number`                       | 必須 | 初期復元するスクロール進捗率（`0.0 〜 1.0`）  |
| `isLoading`              | `boolean`                      | 必須 | 読み込み・通信中フラグ                        |
| `error`                  | `string \| null`               | 任意 | エラーメッセージ文字列                        |
| `onPrevChapter`          | `() => void`                   | 必須 | 「前の話へ」押下時（`TR-05`）                 |
| `onNextChapter`          | `() => void`                   | 必須 | 「次の話へ」押下時（`TR-05`）                 |
| `onScrollProgressChange` | `(progress: number) => void`   | 必須 | 本文スクロール進捗変化時                      |
| `onToggleWritingMode`    | `() => void`                   | 任意 | 組み方向切替時（互換用）                      |
| `onChangeTheme`          | `(theme: ReaderTheme) => void` | 任意 | テーマ変更時（互換用）                        |
| `onChangeFontSize`       | `(sizePx: number) => void`     | 任意 | 文字サイズ変更時（互換用）                    |
| `onChangeLineHeight`     | `(height: number) => void`     | 任意 | 行間変更時（互換用）                          |
| `onBackToDetail`         | `() => void`                   | 任意 | 「作品詳細へ（目次へ戻る）」押下時（`TR-06`） |
| `onBackToBookshelf`      | `() => void`                   | 任意 | 「本棚へ戻る」押下時                          |
| `onFetchNovel`           | `() => void`                   | 任意 | 手動作品取得・更新トリガー時                  |

#### セマンティック属性と排他描画ルール

- **画面ルート**: `data-testid="reader-page"`、全画面シェルの内部で `h-full flex flex-col overflow-hidden` とし、ウィンドウ全体のスクロールを抑止する。
- **前後話ナビゲーション**: `novel !== null` かつ `totalChapters > 0` の場合、画面下部に `ReaderChapterNav` を描画する（Issue #52 で最下部タッチオーバーレイへ統合予定）。
- **メイン本文領域の排他描画ルール**:
  1. `error` が非 null の場合: エラー表示要素 `data-testid="reader-error"`（`role="alert"`）を描画する。
  2. `error === null` かつ `isLoading === true` かつ表示可能な本文（`chapter?.bodyHtml`）が未取得の場合: ローディング表示要素 `data-testid="reader-loading"` を描画する。
  3. `error === null` かつ `isLoading === false` かつ（`novel === null` または `chapter === null` または `chapter.bodyHtml === null`）の場合: 空状態要素 `data-testid="reader-empty"` を描画する。
  4. 上記以外（`novel !== null` かつ `chapter?.bodyHtml` が存在する場合）: `ReaderView` を `flex-1 min-h-0` に描画する。

---

### 3.5 `ReaderContainer`（リーダー画面 Container コンポーネント）

`useReader` フックおよびルーター遷移コールバック（または Props で注入されたコールバック）を接続し、`ReaderPage` を描画する Container コンポーネントです。

#### プロパティ契約（`ReaderContainerProps`）

| プロパティ名        | 型                                                | 必須 | 説明                                                                                                 |
| :------------------ | :------------------------------------------------ | :--- | :--------------------------------------------------------------------------------------------------- |
| `novelId`           | `string`                                          | 任意 | ルート `/novels/:novelId/chapters/:chapterIndex` から渡される対象作品 ID                             |
| `chapterIndex`      | `number`                                          | 任意 | ルートから渡される対象エピソード連番（1始まり、省略時は `1`）                                        |
| `initialWorkUrl`    | `string`                                          | 任意 | 単体検証・手動取得時の対象作品 URL（既定値: 検証用カクヨム作品 URL）                                 |
| `onBackToBookshelf` | `() => void`                                      | 任意 | 「本棚へ戻る」（`/`）コールバック（省略時はルーター環境下で `navigateToBookshelf` を使用）           |
| `onBackToDetail`    | `(novelId: string) => void`                       | 任意 | 「作品詳細へ」（`/novels/:novelId`）コールバック（省略時はルーター環境下で `navigateToNovelDetail`） |
| `onNavigateChapter` | `(novelId: string, chapterIndex: number) => void` | 任意 | 前後話遷移コールバック（省略時はルーター環境下で `navigateToReader` を使用し、内部話数も同期）       |

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
     - 「作品詳細へ（目次へ戻る）」（`TR-06`）または「本棚へ戻る」押下時には、`flushBookmark()` により最新の `(chapterIndex, scrollProgress)` を確実に DB 保存してから画面遷移コールバックを呼び出す。
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

| AC ID          | 対象機能                                 | 検証条件                                                                                                                                                                                                                                                                        | 関連要件 / 遷移                                       |
| :------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------- |
| **`AC-RD-01`** | 本文表示と未キャッシュ話オンデマンド取得 | キャッシュ済み話は通信なしで即時表示され、未キャッシュ話（`bodyHtml === null`）を開いた場合は自動的に HTML 取得・サニタイズ解析・DB 保存（`saveChapterBody`）が行われて作品名・サブタイトル・本文が表示されること。                                                             | `SYS-REQ-02` / `TR-03`, `TR-04`, `TR-05`              |
| **`AC-RD-02`** | ルビ・傍点の正確な描画とサニタイズ       | 本文中の `<ruby>`（`<rt>`, `<rp>`）および傍点 `<em class="bouten">` が XSS サニタイズを維持したまま組版崩れなく描画されること。                                                                                                                                                 | `SYS-REQ-07`                                          |
| **`AC-RD-03`** | 縦書き / 横書き組版と設定連動            | 設定画面（`SCR-05`）で設定された組み方向（`vertical-rl` / `horizontal-tb`）がリーダー画面へ即座に適用され、`reader_settings` テーブルの値に基づいてリロード後も維持されること。                                                                                                 | `SYS-REQ-08`                                          |
| **`AC-RD-04`** | 4カラーテーマ表示と設定連動              | 設定画面（`SCR-05`）で設定された4種類のカラーテーマ（`light` / `sepia` / `dark` / `black`）がリーダー画面へ即座に適用され、`reader_settings` テーブルの値に基づいてリロード後も維持されること。                                                                                 | `SYS-REQ-10`                                          |
| **`AC-RD-05`** | 文字サイズ・行間スタイルと設定連動       | 設定画面（`SCR-05`）で設定された文字サイズ（`12〜32px`）および行間（`1.4〜2.4`）が `ReaderView` のスタイルに適用され、`reader_settings` テーブルの値に基づいてリロード後も維持されること。                                                                                      | `SYS-REQ-09`                                          |
| **`AC-RD-06`** | 前後エピソード連続遷移と境界制御         | `ReaderChapterNav` の「前の話へ」「次の話へ」ボタンで同一作品の `chapterIndex ± 1` へ遷移（`TR-05`、`replaceState` 適用）でき、第1話では「前の話へ」が `disabled`、最終話では「次の話へ」が `disabled` となること。また遷移先が未キャッシュの場合はオンデマンド取得されること。 | `SYS-REQ-11` / `TR-05`                                |
| **`AC-RD-07`** | 既読フラグ（`is_read`）の自動更新        | エピソード本文の表示完了時および次話遷移時（`TR-05`）に `markChapterRead(novelId, chapterIndex, true)` が実行され、作品詳細・目次画面（`SCR-02`）へ戻った際に閲覧済み話に `既読` バッジ（`episode-read-badge`）が表示されること。                                               | `SYS-REQ-12` / `TR-05`, `TR-06`                       |
| **`AC-RD-08`** | しおり話数・スクロール進捗率の保存復元   | 現在閲覧中の `bookmark_chapter_index` と、縦書き（水平スクロール）・横書き（垂直スクロール）双方のスクロール進捗率（`0.0〜1.0`）が自動保存され、OS バックキーでの目次復帰（`TR-06`）や「続きから読む（`TR-03`, `TR-04`）」で同じ話・スクロール位置が復元されること。            | `SYS-REQ-12, 16` / `TR-03`, `TR-04`, `TR-05`, `TR-06` |

---

## 7. SCN-01 結合シナリオ仕様（Playwright IT）

- **シナリオ ID**: `SCN-01`
- **目的**: 100dvh 全画面シェル環境下で、本棚画面（`SCR-01`）での URL 作品登録、下部タブバー（`BottomTabBar`）からの設定画面（`SCR-05`）遷移と組版設定変更・サンプル文章プレビュー、OS バックキー（`TR-12`）での本棚復帰、作品詳細・目次画面（`SCR-02`）での目次確認、リーダー画面（`SCR-03`）での未キャッシュ話オンデマンド取得・変更後組版設定（横書き・テーマ・文字サイズ・行間）の自動適用、縦書き・横書き双方でのスクロール進捗保存と復元（`AC-RD-08`）、前後エピソード連続遷移（`TR-05`、`replaceState`）、OS バックキーによる目次復帰（`TR-06`、しおり自動保存）、作品詳細・本棚「続きから読む」からの再開復元（`TR-04`, `TR-03`）、下部タブ「本棚」タップ（`TR-01b`）による本棚トップ直行、および作品削除（`TR-07`）までの一連のユーザー体験を一気通貫で検証する。
- **検証ステップ**:
  1. 初期表示（`/`）で 100dvh 全画面シェルの本棚空状態（`bookshelf-empty`）および画面最下部タブバー（`bottom-tab-bar`）の「本棚」タブがアクティブであることを確認。
  2. 「設定」タブをクリックして `/settings`（`SCR-05`）へ遷移（`TR-01`）し、設定画面ヘッダー、「設定」タブのアクティブ表示、およびサンプル文章プレビュー枠（`sample-text-preview`、ルビ・傍点含む）を確認。
  3. 設定画面で組み方向を「横書き」、テーマを「セピア」、文字サイズを拡大（`20px`）、行間を拡大（`2.0`）に変更し、プレビュー枠のスタイルに即時反映されることを確認。
  4. ブラウザ戻る（`page.goBack()`）を実行して本棚画面（`/`）へ復帰（`TR-12`）し、「本棚」タブがアクティブであることを確認。
  5. 「URLから作品を追加」ダイアログを開き、カクヨム作品 URL を入力して登録を実行し、本棚一覧に作品カード（`novel-card`）が追加され、しおり位置バッジ（`novel-card-bookmark`）に `未読` が表示されることを確認。
  6. 作品カード本体（`novel-card-select`）をクリックして `/novels/:novelId`（`SCR-02` 作品詳細・目次画面）へ遷移（`TR-02`）し、作品ヘッダー情報・章見出し・エピソード一覧（`未取得` バッジ）が表示されること、および「目次を更新」ボタン押下で最新状態が通知されることを確認（下部タブバーは「本棚」アクティブ維持）。
  7. 目次一覧から第1話を選択して `/novels/:novelId/chapters/1`（`SCR-03`）へ遷移（`TR-04`）することを確認。
  8. 第1話本文がオンデマンド取得され、設定画面で変更した組版設定（横書き・セピア・`20px`・`2.0`）がリーダー本文へ適用されていること、`ReaderToolbar` が非描画であること、第1話では「前の話へ」（`reader-prev-chapter`）が `disabled` かつ「次の話へ」（`reader-next-chapter`）が有効であることを確認。
  9. 本文内の `<ruby>`（ルビ）および `<em class="bouten">`（傍点）が可視状態で正しくレンダリングされていることを確認。
  10. 「次の話へ」（`reader-next-chapter`）をクリックして `/novels/:novelId/chapters/2` へ遷移（`TR-05`）し、第2話本文がオンデマンド取得されて `reader-chapter-indicator`（`第 2 話 / 全 4 話`）が更新されることを確認した後、スクロール操作により進捗率が更新されることを確認。
  11. ブラウザ戻る（`page.goBack()`）を 1 回実行した際、第1話へ戻るのではなく **作品詳細・目次画面（`SCR-02`）へ論理階層復帰（`TR-06`）すること**、および第1話・第2話が `取得済み`（`episode-cached-badge`）かつ `既読`（`episode-read-badge`）に、第2話に `しおり`（`episode-bookmark-badge`）が表示され、ヘッダーに「続きから読む（第2話）」（`detail-resume-button`）が表示されることを確認。
  12. 作品詳細画面でブラウザ戻る（`page.goBack()`）を実行して本棚画面（`/`）へ復帰（`TR-07`）することを確認し、作品カードの「第2話から読む」（`novel-card-resume`）をクリックして `/novels/:novelId/chapters/2` へ直行（`TR-03`）してスクロール位置が復元されること、および下部タブ「本棚」タップ（`TR-01b`）でいつでも本棚トップへ戻れることを確認。最後に `SCR-02` から作品削除を実行して本棚（`/`）へ戻り空状態（`bookshelf-empty`）となることを確認。
