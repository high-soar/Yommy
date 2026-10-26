---
type: spec-delta
title: 小説リーダー画面（SCR-03）の前後話遷移・しおり保存・組版設定（文字サイズ/行間）拡張
description: Issue #14 に対する差分仕様、小説リーダー画面（SCR-03: /novels/:novelId/chapters/:chapterIndex）の正式コンポーネント・useReaderフック設計、文字サイズ・行間設定、前後話遷移、既読・しおりスクロール進捗保存、テスト計画、およびSub-issue分割計画。
issue: "#14"
status: "Review (#14)"
updated: "2026-10-26"
tags: [delta, reader, scr-03, typography, bookmark, scroll-progress, navigation]
related_specs:
  - docs/specs/features/reader-view.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/bookshelf.md
  - docs/specs/screen-transitions.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/db-schema.md
related_tests:
  - src/features/reader/components/ReaderView.test.tsx
  - src/features/reader/components/ReaderToolbar.test.tsx
  - test/vrt/vrt.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：小説リーダー画面（SCR-03）の前後話遷移・しおり保存・組版設定（文字サイズ/行間）拡張（Issue #14）

## 1. 変更の背景・目的（Why）

- Phase 3 PoC で構築した最小リーダー画面（`PocReaderContainer` / `ReaderToolbar` / `ReaderView`）は、単一話の縦横切替・4テーマ・ルビ/傍点描画の実証を目的としており、連続読書に必要な「前後エピソードへの移動（`TR-05`）」「既読フラグ（`is_read`）およびしおり・スクロール進捗率（`bookmark_chapter_index`, `bookmark_scroll_progress`）の自動保存・復元（`SYS-REQ-12`, `TR-06`）」「文字サイズ・行間のカスタマイズ永続化（`SYS-REQ-09`）」が未実装であった（申し送り事項 `HO-05`）。
- 本 Issue #14 では、先行する本棚画面（`SCR-01`, Issue #12）および作品詳細・目次画面（`SCR-02`, Issue #13）と同じ `Application Hook + Presentational Components + Container` アーキテクチャへ正式移行（`PocReaderContainer` からの脱却）し、Milestone `v0.1` の 3 画面読書サイクル（本棚 ⇄ 作品詳細・目次 ⇄ リーダー）を完成させる。

---

## 2. 仕様・設計の差分（What Changes）

### 2.1 小説リーダー画面（`SCR-03`）正本仕様書の正式化（`docs/specs/features/reader-view.md`）

[docs/specs/features/reader-view.md](../features/reader-view.md) を PoC コンテナ仕様から正式な `SCR-03` 仕様へ全面更新し、以下のモジュール構成と受入条件（`AC-RD-01`〜`AC-RD-08`）を定義する：

1. **状態管理フック（`useReader`: `src/features/reader/hooks/useReader.ts`）の新設**:
   - **エピソード取得と未キャッシュ話オンデマンド取得（`SYS-REQ-02`, `TR-03`, `TR-04`, `TR-05`）**:
     - `novelId`・`chapterIndex`（省略時は `novelRepository.listNovels()` 先頭作品の第1話）に基づき、`novelRepository.getNovelById(novelId)` と `chapterRepository.getChapter(novelId, chapterIndex)` を取得する。
     - `chapter.bodyHtml === null`（未キャッシュ状態）の場合は、`parserRegistry.requireParser(chapter.url)` → `httpClient.getHtml({ url: chapter.url })` → `parser.parseChapterContent(...)` → `chapterRepository.saveChapterBody(...)` を実行して本文をオンデマンド取得・DB保存し、最新の `novel` と `chapter` を反映する。
   - **既読フラグ（`is_read = 1`）の自動更新（`SYS-REQ-12`, `TR-05`）**:
     - エピソード本文の表示準備が完了した時点（キャッシュ済み話のロード完了時、および未キャッシュ話のオンデマンド取得完了時）で即座に `chapterRepository.markChapterRead(novelId, chapterIndex, true)` を実行する。また「次の話へ」遷移時（`TR-05`）にも現在話の既読更新を確実に行う（これにより最終話閲覧時や1話閲覧後の目次復帰 `TR-06` でも確実に `既読` バッジが反映される）。
   - **しおり（`bookmark_chapter_index`）とスクロール進捗率（`bookmark_scroll_progress`）の復元・自動保存（`SYS-REQ-12`, `TR-03`, `TR-04`, `TR-05`, `TR-06`）**:
     - 開いた `chapterIndex` が保存済みの `novel.bookmarkChapterIndex` と **一致する場合**（「続きから読む」やリロード時）は、保存済みの `novel.bookmarkScrollProgress`（`0.0〜1.0`）を初期スクロール位置 `scrollProgress` として復元する。
     - 開いた `chapterIndex` が `novel.bookmarkChapterIndex` と **異なる場合**（前後話遷移 `TR-05` や別話選択時）は、先頭（`scrollProgress = 0`）から表示し、直ちに `novelRepository.updateBookmark(novelId, chapterIndex, 0)` を呼び出してしおり話数を現在話へ更新する。
     - 本文スクロール操作時（`updateScrollProgress(progress)`）および「作品詳細へ戻る（`TR-06`）」「本棚へ戻る」実行時に、`0.0〜1.0` にクランプした進捗率で `novelRepository.updateBookmark(novelId, chapterIndex, progress)` を保存する。
   - **組版設定の読み出し・変更・永続化（`SYS-REQ-08`, `SYS-REQ-09`, `SYS-REQ-10`）**:
     - `settingsRepository.getReaderSettings()` で初期設定を読み出し、以下の変更アクションと `settingsRepository.updateReaderSettings(patch)` 永続化を提供する：
       - `toggleWritingMode()`: `'vertical-rl'` ⇄ `'horizontal-tb'`
       - `changeTheme(theme)`: `'light' | 'sepia' | 'dark' | 'black'`
       - `changeFontSize(nextFontSizePx)`: `12〜32` (px) の範囲にクランプして更新（UI ステッパーは `±2px` 刻み、初期値 `18px`）
       - `changeLineHeight(nextLineHeight)`: `1.4〜2.4` の範囲にクランプ（小数第1位丸め）して更新（UI ステッパーは `±0.2` 刻み、初期値 `1.8`）
       - ※画面余白（`pageMarginPx`）・フォント種別（`fontFamily`）およびタップ1画面送り（`enableTapPaging`）はロードマップ通り Milestone `v0.2` スコープとする。

2. **操作ツールバー（`ReaderToolbar`）の拡張**:
   - 常時表示型のヘッダーツールバーとして、以下の要素を配置する：
     - 戻る導線: `onBackToDetail` 指定時は `data-testid="reader-back-to-detail"`（ラベル: `目次へ戻る` または `作品詳細へ`）、`onBackToBookshelf` 指定時は `data-testid="reader-back-to-bookshelf"`（ラベル: `本棚へ戻る`）を表示。
     - 組み方向切替ボタン（`data-testid="toggle-orientation"`）および 4 カラーテーマ切替ボタン（`data-testid="theme-{light|sepia|dark|black}"`）。
     - **文字サイズステッパー**:
       - 縮小ボタン `data-testid="font-size-decrease"`（`fontSizePx <= 12` で `disabled`、押下時 `fontSizePx - 2`）
       - 現在値表示 `data-testid="font-size-value"`（表示例: `18px`）
       - 拡大ボタン `data-testid="font-size-increase"`（`fontSizePx >= 32` で `disabled`、押下時 `fontSizePx + 2`）
     - **行間ステッパー**:
       - 縮小ボタン `data-testid="line-height-decrease"`（`lineHeight <= 1.4` で `disabled`、押下時 `round(lineHeight - 0.2, 1)`）
       - 現在値表示 `data-testid="line-height-value"`（表示例: `1.8`）
       - 拡大ボタン `data-testid="line-height-increase"`（`lineHeight >= 2.4` で `disabled`、押下時 `round(lineHeight + 0.2, 1)`）

3. **前後エピソード遷移ナビゲーションバー（`ReaderChapterNav`）の新設**:
   - 常時表示型のエピソード移動バー（`data-testid="reader-chapter-nav"`）を新設する：
     - **前の話へボタン**: `data-testid="reader-prev-chapter"`（`chapterIndex <= 1` または `isLoading === true` のとき `disabled`、押下時に `chapterIndex - 1` へ遷移 `TR-05`）。
     - **現在話数インジケーター**: `data-testid="reader-chapter-indicator"`（`第 {chapterIndex} 話 / 全 {totalChapters} 話`）。
     - **次の話へボタン**: `data-testid="reader-next-chapter"`（`chapterIndex >= totalChapters` または `isLoading === true` のとき `disabled`、押下時に `chapterIndex + 1` へ遷移 `TR-05`）。

4. **本文組版・スクロール進捗計算コンポーネント（`ReaderView`）の拡張**:
   - `ReaderViewProps` に `initialScrollProgress?: number`（既定値 `0`）と `onScrollProgressChange?: (progress: number) => void` を追加する。
   - **縦書き（`vertical-rl`）・横書き（`horizontal-tb`）双方のスクロール進捗率（`0.0〜1.0`）算出・復元**:
     - **横書き（`horizontal-tb`、垂直スクロール）**:
       - 最大スクロール量 `maxScroll = scrollHeight - clientHeight`
       - 算出: `progress = maxScroll > 0 ? clamp(scrollTop / maxScroll, 0, 1) : 0`
       - 復元: `element.scrollTop = initialScrollProgress * maxScroll`
     - **縦書き（`vertical-rl`、右→左の水平スクロール）**:
       - Chromium 標準の `vertical-rl` では右端（先頭）が `scrollLeft = 0`、左方向へのスクロールで `scrollLeft <= 0`（負値）となるため、`Math.abs(scrollLeft)` で正規化する。
       - 最大スクロール量 `maxScroll = scrollWidth - clientWidth`
       - 算出: `progress = maxScroll > 0 ? clamp(Math.abs(scrollLeft) / maxScroll, 0, 1) : 0`
       - 復元: `element.scrollLeft = -initialScrollProgress * maxScroll`

5. **画面レイアウト統合（`ReaderPage`）と Container（`ReaderContainer`）への再編**:
   - `ReaderPage`（Presentational）を新設し、`ReaderToolbar`・`ReaderChapterNav`・ローディング（`reader-loading`）・エラー（`reader-error`）・空状態（`reader-empty`）・通常本文（`ReaderView`）の排他描画を管理する。
   - `ReaderContainer`（Container）を新設して `useReader` とルーター遷移（`navigateToBookshelf`, `navigateToNovelDetail`, `navigateToReader`）を接続し、旧 `PocReaderContainer.*` を置換・廃止する。

### 2.2 関連する App 全体正本の同期更新

- [docs/index.md](../../index.md): `docs/specs/features/reader-view.md` の説明を正式コンポーネント構成に更新。
- [docs/specs/requirements.md](../requirements.md): `SYS-REQ-02`, `SYS-REQ-07`〜`SYS-REQ-12` の受入条件 ID 列に `AC-RD-01`〜`AC-RD-08` を追記し、`related_specs` / `related_tests` を最新化。
- [docs/specs/screen-transitions.md](../screen-transitions.md): `SCR-03`, `TR-05`, `TR-06` の記述を常時表示型ツールバー・前後話ナビゲーション・既読/しおり保存仕様に合わせて明確化。
- [docs/specs/architecture.md](../architecture.md), [docs/specs/features/novel-detail.md](../features/novel-detail.md): `PocReaderContainer` の記述を `ReaderContainer` / `useReader` に更新し、`related_specs` に本差分仕様を追加。
- [docs/quality/bug-and-handover-log.md](../../quality/bug-and-handover-log.md): `HO-05` の解決先 Sub-issue（`#34`）を明記し、実ブラウザ結合テスト検証項目 `HO-09` を登録。

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Vitest UT: C0/C1/Functions 100%）

- **リーダー状態管理フック（`src/features/reader/hooks/useReader.test.ts`）**:
  - キャッシュ済み話の初期取得、および未キャッシュ話（`bodyHtml === null`）のオンデマンド通信・サニタイズ解析・`saveChapterBody` 保存
  - 本文表示完了時における `chapterRepository.markChapterRead(novelId, chapterIndex, true)` の自動実行
  - `novel.bookmarkChapterIndex === chapterIndex` 一致時の保存済み `bookmarkScrollProgress` 復元と、不一致時（別話・前後話遷移時）の先頭（`0`）リセット＆ `updateBookmark(novelId, chapterIndex, 0)` 更新
  - `updateScrollProgress(progress)` 呼び出し時のクランプ処理（`0.0〜1.0`）と `novelRepository.updateBookmark` 永続化
  - `toggleWritingMode`, `changeTheme`, `changeFontSize`（12〜32px クランプ）, `changeLineHeight`（1.4〜2.4 クランプ・丸め）による State 即時更新と `settingsRepository.updateReaderSettings` 永続化
  - 前後話存在判定（`hasPrevChapter: chapterIndex > 1`, `hasNextChapter: chapterIndex < totalChapters`）および未登録作品・通信失敗時のエラー状態遷移
- **UI コンポーネント単体テスト（Portable Stories `composeStories`、1対1 `*.stories.tsx` / `*.test.tsx`）**:
  - `ReaderToolbar.test.tsx`: 戻るボタン（目次へ・本棚へ）の表示と発火、縦横切替・4テーマ切替、文字サイズ（`12px` 下限 disabled / `32px` 上限 disabled / `±2px` 増減発火）、行間（`1.4` 下限 disabled / `2.4` 上限 disabled / `±0.2` 増減発火）
  - `ReaderChapterNav.test.tsx`: 現在話数表示（`第 N 話 / 全 M 話`）、第1話での「前の話へ」disabled、最終話での「次の話へ」disabled、中間話での前後話ボタン発火、ローディング中の両方 disabled
  - `ReaderView.test.tsx`: 縦書き/横書き・4テーマ・`fontSizePx`・`lineHeight`・`<ruby>`・傍点の描画、横書き（`scrollTop`）および縦書き（負の `scrollLeft`）双方でのスクロール進捗率（`0.0〜1.0`）算出・`onScrollProgressChange` 通知、および `initialScrollProgress` による初期スクロール位置復元（`maxScroll === 0` のゼロ除算ガード含む）
  - `ReaderPage.test.tsx` / `ReaderContainer.test.tsx`: 親子分離原則に基づくローディング・エラー・空状態・通常表示の排他描画と、前後話遷移（`TR-05`）・目次復帰（`TR-06`）・本棚復帰のルーター連携

### 3.2 視覚的回帰テスト（Storybook VRT: 1280px / 375px）

- `ReaderToolbar`（標準設定 / 最小・最大文字サイズ・行間 / 戻るボタン付き）、`ReaderChapterNav`（第1話 / 中間話 / 最終話）、`ReaderView`（縦書き・横書き・4テーマ・大文字サイズ24px・広行間2.2）、`ReaderPage`（ローディング / エラー / 空状態 / 縦書き通常表示）、`ReaderContainer` の各 Story について、Desktop（1280×800）および Mobile（375×667）の VRT スナップショットを更新・検証する。

### 3.3 実ブラウザ結合テスト（Playwright IT: `SCN-01` 拡張）

- `test/it/scenarios/scn01-poc-vertical-reader.spec.ts` を拡張し、以下の一連のフローを実ブラウザ（Chromium）で検証する：
  1. 本棚（`SCR-01`）で作品登録 → 作品詳細（`SCR-02`）から第1話を開き（`TR-04`）、未キャッシュ第1話のオンデマンド取得と縦書き・`<ruby>`・傍点描画を確認する。
  2. `ReaderToolbar` でテーマ（セピア）・組み方向（横書き）に加え、文字サイズ拡大（`18px` → `20px`）および行間拡大（`1.8` → `2.0`）を操作し、`ReaderView` のスタイル反映とリロード（F5）後の設定永続化を確認する。
  3. `ReaderChapterNav` で第1話の「前の話へ」が `disabled` であることを確認した上で、「次の話へ」（`reader-next-chapter`）を押下して第2話（`/novels/:novelId/chapters/2`）へ遷移（`TR-05`）し、第2話のオンデマンド取得と表示を確認する。
  4. 第2話の本文をスクロールして進捗率を更新した後、「作品詳細へ」（`reader-back-to-detail`）で `SCR-02` へ戻り（`TR-06`）、第1話・第2話の `既読` バッジ（`episode-read-badge`）、第2話の `しおり` バッジ（`episode-bookmark-badge`）、およびヘッダーの「続きから読む（第2話）」（`detail-resume-button`）表示を確認する。
  5. 「続きから読む（第2話）」を押下してリーダーへ再開遷移（`TR-04`）し、保存されたスクロール進捗位置が復元されることを確認する。

---

## 4. 実装 Sub-issue 分割計画

1 PR あたり 200〜400 行目安の規律に従い、以下の 3 つの Sub-issue に分割して直列（逐次）実装する。

| Sub-issue                        | タイトル                                                                            | 主な作業範囲・成果物                                                                                                                                                                                                                                                                                                                                                          |
| :------------------------------- | :---------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sub-issue ① (#32: MK-1)**      | `[v0.1] 小説リーダー状態管理フック（useReader）の実装 (#14-1)`                      | ・`src/features/reader/hooks/useReader.ts` の実装（作品・各話取得、未キャッシュ話オンデマンド取得、表示完了時・次話遷移時の `markChapterRead`、しおり・スクロール進捗率 `0.0〜1.0` の保存・復元、文字サイズ・行間・テーマ・組み方向の永続化）<br>・`src/features/reader/hooks/useReader.test.ts` の単体テスト実装（C0/C1/Functions 100%）                                     |
| **Sub-issue ② (#33: MK-2)**      | `[v0.1] 小説リーダー画面（SCR-03）UIコンポーネント群とStorybook・VRTの実装 (#14-2)` | ・`ReaderToolbar`（戻る導線＋文字サイズ/行間ステッパー追加）、`ReaderChapterNav`（前後話ナビゲーション新設）、`ReaderView`（縦書き/横書きスクロール進捗率算出・復元対応）、`ReaderPage`（画面レイアウト統合）の実装<br>・全4コンポーネントの 1対1 `*.stories.tsx` および Portable Stories `*.test.tsx`<br>・VRT スナップショット（1280px / 375px）更新・検証                  |
| **Sub-issue ③ (#34: MK-3 & IT)** | `[v0.1] ReaderContainer・ルーター統合・Playwright IT更新 (#14-3)`                   | ・`ReaderContainer`（`*.tsx`, `*.stories.tsx`, `*.test.tsx`）実装と `PocReaderContainer.*` の置換・廃止<br>・`src/App.tsx` の `/novels/:novelId/chapters/:chapterIndex` ルート統合（＋VRT更新）<br>・Playwright IT（`scn01-poc-vertical-reader.spec.ts`）の拡張検証<br>・`HO-05`・`HO-09` 解決記録、および本差分仕様の `docs/specs/changes/archive/` への移動（`Closes #14`） |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）

|   ID    | 申し送り事項の内容                                                                                                                                                                                                                                                             | 解決先（対象 Issue / 成果物）     | 完了ゲート          |  状態  |
| :-----: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- | :------------------ | :----: |
| `HO-05` | 小説リーダー画面（`SCR-03`）の文字サイズ・行間カスタマイズ、しおり自動保存、および前後話・目次ナビゲーションの実装（`SYS-REQ-09, 11, 12`）（※余白・フォント種別およびタップ/音量キー1画面送りはロードマップ通り Milestone `v0.2` スコープ）                                    | Issue #14 Sub-issue ③ (#34 IT PR) | Issue #14 PR マージ | `Open` |
| `HO-09` | 小説リーダー画面（`SCR-03`）での文字サイズ・行間変更とリロード永続化、前後エピソード遷移（`TR-05`）、作品詳細・目次画面（`SCR-02`）への復帰（`TR-06`）時の `既読`・`しおり` バッジ反映、および「続きから読む」でのスクロール進捗位置復元の実ブラウザ結合テスト（`SCN-01`）検証 | Issue #14 Sub-issue ③ (#34 IT PR) | Issue #14 PR マージ | `Open` |
