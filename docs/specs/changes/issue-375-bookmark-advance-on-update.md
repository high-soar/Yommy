---
type: spec-delta
title: "最新話末尾しおり時の新着話追加に伴うしおり自動進行およびクラウド同期進捗連携の設計"
description: "Issue #375 に対する差分仕様、upsertNovelWithToc における末尾到達しおり自動進行（last_read_at/updated_at 保護・remote_chapter_id 追跡）、リーダー短文1ページ/1画面完了保存と5px端丸め、SyncNovelData.bookmarkScrollProgress 同期、テスト計画、Sub-issue 分割計画、および実機検証計画（HO-41）。"
issue: "#375"
status: "Review (#375)"
updated: "2026-11-19"
tags:
  - delta
  - bookmark
  - update-check
  - reader
  - bookshelf
  - novel-detail
  - cloud-sync
  - storage
  - ho-41
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/quality/bug-and-handover-log.md
related_tests:
  - src/shared/constants/bookmark.test.ts
  - src/storage/repositories/novelRepository.test.ts
  - src/features/reader/components/ReaderView.test.tsx
  - src/features/reader/hooks/useReader.test.ts
  - src/features/cloud-sync/services/syncEngine.test.ts
  - test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts
  - test/it/scenarios/scn05-cloud-sync.spec.ts
---

# 差分仕様書：最新話末尾しおり時の新着話追加に伴うしおり自動進行およびクラウド同期進捗連携（Issue #375）

本ドキュメントは、Issue #375「`最新話末尾にしおりがある状態で新着話が更新された際、しおりを開くと新着（未読）話の先頭から再開できるようにする`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、実装 Sub-issue 分割計画、および申し送り事項（`HO-41`）・Android 実機検証計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

読者が当時公開されていた最新話（例: 第10話）を最後まで読み終えると、しおりは「第10話の末尾（`bookmarkChapterIndex = 10`, `bookmarkScrollProgress` が末尾到達状態）」に保存された状態となる。その後、作品が更新されて新着エピソード（例: 第11話〜）が追加された状態で「続きから読む（しおりを開く）」を実行すると、**すでに読み終えた第10話の末尾**が開かれてしまい、手動で次の話（第11話）へ送る手間が発生している。

さらに既存実装を調査した結果、本要件を破綻なく実現するためには以下の 3 つの構造的課題を合わせて解決する必要があることが判明した。

1. **目次更新時のしおり位置据え置き**:
   全更新経路（本棚自動/手動更新チェック・作品詳細目次更新・内蔵ブラウザ DOM インポート・クラウド同期目次補完）が集約される `SqlNovelRepository.upsertNovelWithToc()` は `total_chapters` と `has_new_update` のみを更新し、最新話末尾に達していたしおりを新着話先頭へ進めない。
2. **1ページ／1画面完結の短文話および高DPI連続スクロールでの末尾進捗未到達**:
   - ページめくりモードで全 1 ページ（`totalPages === 1`）または連続スクロールモードで 1 画面内に収まる（`maxScroll <= 0`）短文エピソード（更新告知回・掌編等）では、ページ送りやスクロールが発生せず `bookmarkScrollProgress = 0` のまま保存されるため、読了済みであっても末尾到達と判定できない。
   - 連続スクロールモードでは、Android 高 DPI 端末のサブピクセル丸め誤差により最下部までスクロールしても `progress` が `1.0` に満たない（例: `0.994`）ケースがある。
3. **クラウド同期（`SyncNovelData`）における進捗率未同期**:
   現行 `SyncNovelData` は `bookmarkChapterIndex` のみを同期し `bookmarkScrollProgress` を持たない（他端末 Pull 時は一律 `0.0` で保存）。そのため、端末 A で最新話末尾まで読了して同期した後、端末 B で新着話を検知しても端末 B 側の進捗が `0.0` 扱いとなり新着話先頭へ自動進行できない。

そこで `SYS-REQ-04`・`SYS-REQ-06`・`SYS-REQ-12` を拡張し、**目次更新時のしおり自動進行（`last_read_at` / `updated_at` 保護・`remote_chapter_id` 基準の途中挿入対策）**、**リーダー短文 1 ページ/1 画面の完了進捗 `1.0` 保存および連続スクロール 5px 端丸め**、ならびに **クラウド同期での `bookmarkScrollProgress` 双方向 LWW 同期・復元** を一体で設計・実装する。

---

## 2. 仕様・設計の差分（What Changes）

Step 1 の合意事項に基づき、以下の各層および正本仕様を変更・拡張します（SQLite テーブルの DDL スキーマ変更は行いません）。

### 2.1 共通定数・判定ヘルパー（`src/shared/constants/bookmark.ts` 新設）

[docs/specs/architecture.md](../architecture.md) §3.4 に準拠し、Storage 層・Reader 層・Cloud Sync 層で末尾判定基準のズレを防ぐ SSOT として新規モジュール `src/shared/constants/bookmark.ts`（+ 1対1 単体テスト `bookmark.test.ts`）を追加します。

```ts
/** しおりがエピソード末尾（読み終わり）に到達していると判定する進捗率の下限閾値（既存 DB レコード互換） */
export const BOOKMARK_END_PROGRESS_THRESHOLD = 0.99;

/** 連続スクロールモードで最下部到達を 1.0 に丸めるサブピクセル誤差許容幅（px） */
export const SCROLL_END_SNAP_TOLERANCE_PX = 5;

/** しおり進捗率がエピソード末尾到達状態かを判定する */
export function isBookmarkAtEnd(progress: number): boolean {
  return (
    Number.isFinite(progress) && progress >= BOOKMARK_END_PROGRESS_THRESHOLD
  );
}
```

### 2.2 Storage 層（`SqlNovelRepository.upsertNovelWithToc` のしおり自動進行）

[docs/specs/architecture.md](../architecture.md) §3.4 および [docs/specs/db-schema.md](../db-schema.md) §3.1 を以下の通り拡張します。

1. **自動進行の発動前提条件**:
   `upsertNovelWithToc(index, fetchedAt, options)` の既存作品更新トランザクション内において、更新前の `existing` レコードが以下のすべてを満たす場合を「当時の最終話末尾（読み終わり）」と判定する：
   - `existing.totalChapters > 0`
   - `existing.bookmarkChapterIndex === existing.totalChapters`
   - `isBookmarkAtEnd(existing.bookmarkScrollProgress)`（`>= 0.99`）
2. **`remote_chapter_id` 基準の移行先解決ルール（途中挿入・削除・複数話更新・飛ばし読み対応）**:
   更新前の `chapters` テーブルから `chapter_index = existing.totalChapters` の `remote_chapter_id`（`prevLastRemoteId`）を取得し、新目次 `index.chapters`（`chapterIndex` 昇順、`1..N`）と照合して新しい `(nextBookmarkChapterIndex, nextBookmarkScrollProgress)` を決定する：
   - **Case 1（`prevLastRemoteId` が新目次に存在し、その後ろに新着話がある場合：`newLastPos < index.chapters.length`）**:
     - `nextBookmarkChapterIndex = newLastPos + 1`（複数話まとめて追加された場合も追加分の先頭話）
     - `nextBookmarkScrollProgress = 0`
     - ※更新前の最終話より前に未読話（飛ばし読み）があっても過去話へは戻さない。
   - **Case 2（`prevLastRemoteId` が新目次に存在し、依然として最終話である場合：`newLastPos === index.chapters.length`）**:
     - 過去話の途中挿入・削除等で連番のみ変化したケース。新着話は後ろにないため、`nextBookmarkChapterIndex = newLastPos`、`nextBookmarkScrollProgress = existing.bookmarkScrollProgress`（末尾値を維持し `0` へ巻き戻さない）。
   - **Case 3（元の最終話 `prevLastRemoteId` が新目次から削除されている場合）**:
     - `index.chapters.length > existing.totalChapters`（総話数が増加している場合）: `nextBookmarkChapterIndex = existing.totalChapters + 1`, `nextBookmarkScrollProgress = 0` にフォールバックする。
     - `index.chapters.length === 0`: `nextBookmarkChapterIndex = null`, `nextBookmarkScrollProgress = 0`。
     - 上記以外で `existing.bookmarkChapterIndex > index.chapters.length`（話数減少により範囲外となった場合）: `nextBookmarkChapterIndex = index.chapters.length`, `nextBookmarkScrollProgress = existing.bookmarkScrollProgress` にクランプする。
   - **Case 4（前提条件を満たさない場合：最新話の途中、過去話にしおりあり、または未読 `bookmarkChapterIndex === null`）**:
     - 従来のしおり位置（`bookmark_chapter_index`, `bookmark_scroll_progress`）をそのまま維持する。
3. **クラウド同期保護（`last_read_at` / `updated_at` の厳格維持）**:
   - `upsertNovelWithToc` によるしおり自動進行時は、`novels.bookmark_chapter_index` と `novels.bookmark_scroll_progress` のみを更新し、**`novels.last_read_at` および `novels.updated_at` は一切更新しない**。
   - これにより、起動時自動更新チェック（`useBookshelf`）がクラウド同期 `pullAndMerge()` より先に走っても、ローカル側の `last_read_at` が現在時刻へ偽装されて別端末のより新しい読書位置（例: 第15話）を LWW で上書きしてしまう競合を防止する。
4. **移動先新着話の既読フラグ**:
   - 新規追加されたエピソードは `UPSERT_CHAPTER_SQL` により `is_read = 0`（未読）で登録され、しおりが自動移動しても `is_read` は `0` のまま維持する（リーダーで実際に本文を開いた時点で `markChapterRead(..., true)` により既読化する）。

### 2.3 Reader 層（`ReaderView` 端丸め・短文検知 ＆ `useReader` 自動保存・Pull 非競合）

[docs/specs/features/reader-view.md](../features/reader-view.md) §3.5・§4.2・§6 を以下の通り拡張します。

1. **`ReaderView.tsx` の連続スクロール 5px 端丸めと 1 画面短文検知**:
   - `calculateScrollProgress(el, writingMode)` において、`maxScroll > 0` かつ `maxScroll - currentScroll <= SCROLL_END_SNAP_TOLERANCE_PX`（5px 以内、横書きは `el.scrollTop`、縦書きは `Math.abs(el.scrollLeft)`）の場合に **`1`**（`1.0`）を返すよう丸める。これにより Android 高 DPI 端末のサブピクセル誤差で `0.994` 等に留まる現象を解消し、`1.0` として確実に保存する。
   - `ReaderViewProps` に任意コールバック `onSingleScreenContentMeasured?: (isSingleScreen: boolean) => void`（または既存レイアウト計測 `useEffect` からの通知）を導入し、実効連続スクロールモード（`!isPaged`）で本文（`bodyHtml !== null`）が描画・計測された際、`maxScroll <= 0`（1 画面内に全文が収まる短文エピソード）であることを `useReader` へ通知する。
     - ※**未レイアウト状態（`0px`）の共通抑止ガード**: 実効 `paged` の `measure()`（`onTotalPagesChange`）および連続スクロール計測（`onSingleScreenContentMeasured`）の双方において、コンテナ寸法（`currentWidth <= 0 || currentHeight <= 0`）の未レイアウト状態ではコールバックを発火しない。計測は `bodyHtml`, `chapterTitle`, `writingMode`, `fontSizePx`, `lineHeight`, `fontFamily`, `pageMarginPx`, `pagingMode`, `containerWidth`, `containerHeight` に連動し、初回・`requestAnimationFrame`・`document.fonts.ready` のタイミングで確定評価する。
2. **`useReader.ts` の 1 ページ／1 画面完結エピソード進捗 `1.0` 自動保存と再計測巻き戻し・Issue #342 保護**:
   - 本文読み込み完了済み（`chapter?.bodyHtml !== null` かつ `!isLoading`）かつ `bookmarkConflictRef.current === null` の状態で：
     - 実効 `paged` モード時: DOM 計測により確定した `totalPages === 1` となった場合（ただし初期仮値 `1` での誤発火を防ぐため、`ReaderView` からの実 DOM 計測コールバック `setTotalPages(1)` 完了時かつ `chapter?.bodyHtml !== null` かつ `!isLoading` の場合）。
     - 実効 `scroll` モード時: `ReaderView` から `isSingleScreen === true`（`maxScroll <= 0`）が通知された場合。
   - 上記に該当し、**現在の保存済み進捗が末尾未到達（`!isBookmarkAtEnd(scrollProgressRef.current)`）の場合のみ**、自動保存識別フラグ（`isAutoSingleScreenSavePendingRef.current = true`）を立てた上で `updateScrollProgress(1)` を実行して `bookmarkScrollProgress = 1.0` を保存する（300ms デバウンス完了・書き込み確定時にフラグを `false` クリア）。
   - **再計測遷移時の誤保存キャンセル・巻き戻し契約**: 初回仮計測で一時的に `totalPages === 1`（または `isSingleScreen === true`）となり短文自動保存が保留中（`isAutoSingleScreenSavePendingRef.current === true`）の間に、後続の `rAF` / `document.fonts.ready` 等で `totalPages > 1`（または `isSingleScreen === false`）へ確定し、かつユーザーがまだページ送り・スクロール操作を行っていない場合（`!hasUserChangedPageRef.current`）は、保留中の 300ms デバウンスタイマーを即時キャンセルし、`isAutoSingleScreenSavePendingRef.current = false`、`hasPendingBookmarkRef.current = false` とした上で、`scrollProgress` / `scrollProgressRef` を直前の保存済み進捗（`initialScrollProgressRef.current`）へ巻き戻す。
   - **重要（Issue #342 未操作離脱保護との整合）**: すでに `isBookmarkAtEnd(targetNovel.bookmarkScrollProgress)`（`>= 0.99`）として保存済みの短文エピソードを再表示しただけの場合は `updateScrollProgress(1)` を呼ばず、`hasPendingBookmarkRef.current = false` のまま維持することで、再表示・離脱時に `last_read_at` を不要更新しない。
3. **`useReader.ts` の `lastReadAt` メモリ同期と自動 Pull 完了時における競合判定の精緻化**:
   - **`updateBookmark` 後の `lastReadAt` メモリ同期契約**: `loadInitialData`（別話初回表示時）・`goToChapter`・`persistBookmark`（300ms デバウンス完了・`flushBookmark`・`resolveBookmarkConflict("keep")`）で `novelRepository.updateBookmark()` を実行した後は、DB から最新の `last_read_at`（`novelRepository.getNovelById` の再取得、または `updateBookmark` と同一タイムスタンプの反映）を必ず `novel` State および `novelRef.current.lastReadAt` へ同期保持する。
   - **`subscribePullCompleted` 内の比較順序と非競合判定**:
     1. `latestNovel = await novelRepository.getNovelById(targetNovelId)` を取得した直後、`novelRef.current` を書き換える前に `prevLastReadAt = novelRef.current.lastReadAt` を退避する。
     2. `latestNovel.totalChapters > novelRef.current.totalChapters` の場合、`novel` State / `novelRef.current` の `totalChapters` を最新化する（最新話表示中にバックグラウンド Pull で目次が補完された場合に「次の話へ」ボタンを有効化するため）。
     3. 競合ダイアログ（`BookmarkConflictDialog`）の表示判定において、`latestNovel.bookmarkChapterIndex !== currentChapterIndexRef.current` であっても、**`latestNovel.lastReadAt === prevLastReadAt`**（他端末での閲覧による `last_read_at` 更新ではなく、目次更新に伴うローカル自動進行のみでしおり話数が進んだケース）の場合は競合ダイアログを誤表示しない。

### 2.4 Cloud Sync 層（`SyncNovelData.bookmarkScrollProgress` 追加と LWW 同期・Pull 時新着遷移）

[docs/specs/architecture.md](../architecture.md) §3.6・§3.8.2 を以下の通り拡張します。

1. **`SyncNovelData` 型拡張（`src/features/cloud-sync/types.ts`）**:
   - `version: 1` のまま後方互換の任意フィールドを追加する：
     ```ts
     bookmarkScrollProgress?: number; // しおり進捗率（0.0 〜 1.0、旧バージョンデータでは省略され 0.0 扱い）
     ```
2. **ゼロトラスト検証（`validateSyncState`）**:
   - `n.bookmarkScrollProgress !== undefined` の場合、`typeof n.bookmarkScrollProgress === "number" && Number.isFinite(n.bookmarkScrollProgress) && n.bookmarkScrollProgress >= 0 && n.bookmarkScrollProgress <= 1` を厳格に検証し、範囲外・`NaN`・非数値は拒否して例外を送出する。
3. **Push 構築・マージ（`buildSyncNovels` / `buildMergedSyncNovels`）**:
   - `buildSyncNovels()` にて `bookmarkScrollProgress: full.bookmarkScrollProgress` を出力する。
   - `buildMergedSyncNovels()` の LWW マージ（`remoteLastRead > localLastRead`）において、`bookmarkChapterIndex` とセットで `bookmarkScrollProgress` も新しい方を採用する。ただしリモート側が旧形式（`bookmarkScrollProgress === undefined`）の場合は、話数が異なるとき（`remoteNovel.bookmarkChapterIndex !== local.bookmarkChapterIndex`）のみ `0.0` にフォールバックし、**ローカルと同一話数（`remoteNovel.bookmarkChapterIndex === local.bookmarkChapterIndex`）のときは後方互換保護としてローカルの `bookmarkScrollProgress` を維持する**。
   - `remoteLastRead === localLastRead` かつ同一話数で片方のみ `bookmarkScrollProgress` が大きい（または `undefined` を補完する）場合は `Math.max(localProgress, remoteProgress)` ではなくローカル優先（`local.bookmarkScrollProgress`）を維持する。
4. **Pull マージ（`mergeNewNovel` / `mergeExistingNovel`）と末尾到達新着遷移**:
   - **`mergeNewNovel`**:
     - `remoteNovel.bookmarkChapterIndex !== null` のとき、進捗率 `remoteProgress = remoteNovel.bookmarkScrollProgress ?? 0` を算出する。
     - もし `remoteNovel.totalChapters > 0 && remoteNovel.bookmarkChapterIndex === remoteNovel.totalChapters && isBookmarkAtEnd(remoteProgress)` かつ、今回取得した最新目次 `parsedIndex.chapters.length > remoteNovel.totalChapters` である場合は、新着話の先頭（`remoteNovel.totalChapters + 1`, `progress = 0`）を適用する（それ以外は `remoteNovel.bookmarkChapterIndex`, `remoteProgress` をそのまま復元する）。
     - その後 `updateSyncMetadata` でリモートの `lastReadAt`, `isFavorite`, `createdAt`, `updatedAt` を復元する。
   - **`mergeExistingNovel`**:
     - 既存作品の目次補完（`needsTocRefresh`）において、リモートが最新話末尾到達かつローカルより話数が多い場合はすでに `upsertNovelWithToc` が実行される。
     - LWW 判定で `remoteLastRead > localLastRead && !isBookmarkOutOfRange` の場合：
       - リモートの進捗率 `remoteProgress = remoteNovel.bookmarkScrollProgress`（旧形式時は `undefined`）を用いて適用先を決定する。
       - もし `remoteNovel.totalChapters > 0 && remoteNovel.bookmarkChapterIndex === remoteNovel.totalChapters && remoteProgress !== undefined && isBookmarkAtEnd(remoteProgress)` かつ `currentLocalNovel.totalChapters > remoteNovel.totalChapters`（ローカル側ですでに新着話を取り込み済み、または今回の目次補完で新着話が増えた場合）は、新着話の先頭（`remoteNovel.totalChapters + 1`, `progress = 0`）を `updateBookmark` で適用する。
       - 話数が異なる場合（`remoteNovel.bookmarkChapterIndex !== currentLocalNovel.bookmarkChapterIndex`）は、`updateBookmark(novelId, remoteNovel.bookmarkChapterIndex, remoteProgress ?? 0.0)` でリモートの話数・進捗率（旧形式時は `0.0` フォールバック）を復元する。
       - 同一話数の場合、リモートが新形式（`remoteProgress !== undefined`）かつ進捗率が異なるとき（`remoteProgress !== currentLocalNovel.bookmarkScrollProgress`）のみ `updateBookmark(novelId, remoteNovel.bookmarkChapterIndex, remoteProgress)` でリモートの進捗率を復元し、**リモートが旧形式（`bookmarkScrollProgress === undefined`）のときは後方互換保護としてローカルの `bookmarkScrollProgress` を維持する**。
       - 直後に `updateSyncMetadata(novelId, { lastReadAt: remoteNovel.lastReadAt })` でリモートの `lastReadAt` を復元・維持する。

### 2.5 UI 表示（`SCR-01` 本棚・`SCR-02` 作品詳細）への波及と整合性

UI コンポーネントのレイアウト・DOM 構造の変更はありません。DB の `bookmark_chapter_index` / `bookmark_scroll_progress` が目次更新時に自動進行するため、以下の既存 UI 表示が即座に新着話へ揃います：

- **本棚画面（`SCR-01`: `bookshelf.md` `AC-BS-16`）**: 自動/手動更新チェック完了後の `listNovels()` リフレッシュにより、`NovelCard` のしおりバッジが `しおり: 第11話`、再開ボタンが `第11話から読む` へ更新される。タップ時は `第11話` の先頭（`progress = 0`）からリーダーが開く。
- **作品詳細・目次画面（`SCR-02`: `novel-detail.md` `AC-ND-31`）**: 目次更新（`refreshToc()`）完了後の `getNovelById()` 再取得により、`NovelDetailHeader` のボタンが `続きから読む（第11話）` へ更新され、`EpisodeList` 上の `しおり` バッジが第11話（`未読` 状態）へ移動する。なお目次一覧で第10話を直接タップした場合は従来通り第10話を先頭から再読できる。

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 共通定数 ＆ Storage 層単体テスト（Vitest）

- `src/shared/constants/bookmark.test.ts`（新設）:
  - `BOOKMARK_END_PROGRESS_THRESHOLD === 0.99`, `SCROLL_END_SNAP_TOLERANCE_PX === 5`。
  - `isBookmarkAtEnd`: `0`, `0.5`, `0.989`, `NaN`, `Infinity` で `false`、`0.99`, `0.995`, `1.0` で `true`。
- `src/storage/repositories/novelRepository.test.ts`:
  - **正常系（1話追加）**: 全10話・しおり第10話・`progress = 1.0`（および境界値 `0.99`）の状態で第11話追加の `upsertNovelWithToc` を実行 → `bookmarkChapterIndex === 11`, `bookmarkScrollProgress === 0` に進行し、第11話の `isRead === false`、かつ `lastReadAt` と `updatedAt` が更新前の値のまま維持されること。
  - **正常系（複数話追加）**: 全10話・第10話末尾 → 第11〜13話の3話追加 → `bookmarkChapterIndex === 11`, `bookmarkScrollProgress === 0` に進行すること。
  - **非進行ケース（最新話の途中）**: 全10話・第10話・`progress = 0.5`（および境界値 `0.98`）→ 第11話追加 → `bookmarkChapterIndex === 10`, `bookmarkScrollProgress` 維持。
  - **非進行ケース（過去話にしおりあり / 未読 `null`）**: 全10話・第5話・`progress = 1.0` → 第11話追加 → 第5話のまま維持。`bookmarkChapterIndex === null` → `null` のまま維持。
  - **飛ばし読みケース**: 第1〜9話に未読があり、第10話末尾にしおりがある状態で第11話追加 → 過去未読話には戻さず第11話先頭へ進行すること。
  - **途中話挿入ケース（改稿）**: 第5話と第6話の間に幕間エピソードが挿入され、元の第10話（`remote_chapter_id = "ep10"`）が新第11話（最終話のまま）になった場合 → `bookmarkChapterIndex === 11`, `bookmarkScrollProgress` は末尾値（`1.0`）を維持し `0` に巻き戻らないこと。
  - **途中話挿入＋新着追加の同時発生**: 幕間挿入で元の最終話 `"ep10"` が新第11話になり、さらに新着 `"ep11"` が新第12話として追加された場合 → `bookmarkChapterIndex === 12`, `bookmarkScrollProgress === 0` へ進行すること。
  - **元最終話削除フォールバック**: 元の最終話 `"ep10"` が削除されて新着が増えた場合（総話数12話）は `11` 先頭へ進行、総話数が8話へ減少した場合は `8` へクランプ、0話になった場合は `null` になること。

### 3.2 Reader 層 ＆ Cloud Sync 層単体テスト（Vitest）

- `src/features/reader/components/ReaderView.test.tsx`:
  - 連続スクロールモード（縦書き・横書き双方）で `maxScroll - currentScroll <= 5` px（例: `maxScroll = 1000`, `scrollTop = 996`）のとき `calculateScrollProgress` が `1` を返すこと（6px 残りは `< 1`）。
  - コンテナ寸法が `0`（未レイアウト状態）のときは、実効 `paged` の `onTotalPagesChange` および連続スクロールの `onSingleScreenContentMeasured` のいずれも発火しないこと。
  - 連続スクロールモードで `maxScroll <= 0`（1画面完結短文）の本文計測完了時に `onSingleScreenContentMeasured(true)` が呼ばれ、`maxScroll > 0` のときは `false` が呼ばれること。
- `src/features/reader/hooks/useReader.test.ts`:
  - 実効 `paged` モードで本文ロード完了後に `setTotalPages(1)` が呼ばれた際、保存済み進捗が `0` であれば `updateScrollProgress(1)` が呼ばれて `1.0` が保存されること。
  - 初回仮計測で `setTotalPages(1)`（または `markSingleScreenContentMeasured(true)`）が呼ばれて 300ms デバウンス保留中に、再計測で `setTotalPages(3)`（または `markSingleScreenContentMeasured(false)`）へ確定した場合、未操作であれば保留タイマーがキャンセルされ `hasPendingBookmark` および進捗率が直前の保存済み進捗へ巻き戻され誤保存されないこと。
  - すでに `bookmarkScrollProgress === 1.0` の1ページ短文話を再表示しただけの場合は `updateBookmark` / `notifyChanged` が呼ばれないこと（Issue #342 保護）。
  - 実効 `scroll` モードで `markSingleScreenContentMeasured(true)` が通知された際、同様に `1.0` が保存され、既存 `1.0` 再表示時は再書き込みされないこと。
  - `loadInitialData` / `goToChapter` / `persistBookmark` で `updateBookmark` を実行した直後に `novel.lastReadAt` が DB 最新値へ同期され、`subscribePullCompleted` 受信時に `lastReadAt` が変化せずに目次更新でしおり話数が進んだだけのケースでは `bookmarkConflict` が `null` のまま維持され、`novel.totalChapters` が最新値へ更新されること。一方、他端末閲覧により `lastReadAt` が変化してしおり話数が異なった場合は従来通り `BookmarkConflictDialog` が表示されること。
- `src/features/cloud-sync/services/syncEngine.test.ts`:
  - `validateSyncState`: `bookmarkScrollProgress` 省略（旧データ後方互換）・`0`・`0.5`・`1` を受理し、`-0.1`・`1.1`・`NaN`・文字列を拒否すること。
  - `pushCurrentState`: `SyncNovelData.bookmarkScrollProgress` にローカル進捗率が出力され、`buildMergedSyncNovels` で LWW に従い進捗率もマージされること。
  - `pullAndMerge`（`mergeNewNovel` / `mergeExistingNovel`）:
    - 他端末で途中（例: 第5話 `progress = 0.6`）まで読んだ状態がそのまま第5話 `progress = 0.6` として復元されること（同一話数で進捗率のみ進んだ場合も復元されること）。
    - 他端末で当時最新話（第10話 `totalChapters = 10`）の末尾（`progress = 1.0`）まで読了済みであり、ローカル側または目次補完で第11話が存在する場合、Pull マージ後にしおりが第11話 `progress = 0.0` へ自動進行し、かつ `lastReadAt` はリモート値が維持されること。

### 3.3 Storybook VRT ＆ Playwright システム結合テスト（E2E）

- **Storybook VRT（1280px / 375px）**: 既存 UI レイアウト変更なしのため、既存全ストーリー VRT 100% PASS で回帰がないことを担保する。
- **Playwright IT（`SCN-03`: `test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts`）**:
  - 最新話（例: 最終話）の末尾まで読み終えた状態で本棚へ戻り、新着話が追加された目次更新（手動更新チェック）を実行すると、本棚カードのしおり表示が自動的に新着話へ進み、「第N話から読む」をタップすると新着話の先頭からリーダーが開き、既読化されることを検証。
  - あわせて作品詳細画面（`SCR-02`）からの目次更新でも「続きから読む（第N話）」・目次 `しおり` バッジが新着未読話へ移動し、最新話途中の場合は移動せず維持されることを検証。
- **Playwright IT（`SCN-05`: `test/it/scenarios/scn05-cloud-sync.spec.ts`）**:
  - クラウド同期 Pull で別端末の途中進捗率（`bookmarkScrollProgress`）が復元されること、および別端末で最新話末尾（`progress = 1.0`）まで読了済み＋新着話ありのケースで Pull 後に新着話先頭へ自動進行することを検証。

---

## 4. 実装 Sub-issue 分割計画

1 PR あたり 200〜400 行目安となるよう、以下の **3 つの Sub-issue** に分割して直列実装します。

1. **Sub-issue ①（MK / Storage 層＆共通定数）**:
   - `src/shared/constants/bookmark.ts` (+ `bookmark.test.ts`) の新設。
   - `src/storage/repositories/novelRepository.ts` (`upsertNovelWithToc`) の最新話末尾しおり自動進行・`remote_chapter_id` 追跡・`last_read_at`/`updated_at` 保護の実装および `novelRepository.test.ts` の TDD テスト追加（C0/C1/Functions 100%）。
2. **Sub-issue ②（MK / Reader 層＆Cloud Sync 層）**:
   - `src/features/reader/components/ReaderView.tsx` の 5px 端丸め・1画面短文検知 (`onSingleScreenContentMeasured`) と `ReaderPage.tsx` / `ReaderContainer.tsx` / `useReader.ts` の 1ページ/1画面短文 `1.0` 保存・再表示保護・Pull 時非競合＆`totalChapters` 更新の実装・TDD テスト（C0/C1/Functions 100%）。
   - `src/features/cloud-sync/types.ts` および `src/features/cloud-sync/services/syncEngine.ts` の `bookmarkScrollProgress?: number` ゼロトラスト検証・LWW 同期復元・Pull 時末尾到達新着遷移の実装・TDD テスト（C0/C1/Functions 100%）。
3. **Sub-issue ③（IT / 全体回帰テスト・差分仕様アーカイブ・親 Issue #375 完了）**:
   - `test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts` および `test/it/scenarios/scn05-cloud-sync.spec.ts` への E2E シナリオ追加・全 IT シナリオ 100% PASS 確認。
   - 本差分仕様書の `status: "Completed (Archived)"` 更新および `git mv docs/specs/changes/issue-375-bookmark-advance-on-update.md docs/specs/changes/archive/issue-375-bookmark-advance-on-update.md`、`docs/index.md` および影響正本 6 冊の `related_specs`・`status: "Approved"` 復帰、`Closes #375` による親 Issue 完了（人間マージ）。

---

## 5. 申し送り事項（Handover Items: `HO-41`）・Android 実機検証計画

[docs/guidelines/workflow.md §2.2](../../guidelines/workflow.md#22-android-実機検証の実施判断基準と試験項目表フォーマット) の判断基準に基づき、本要望の実機検証タイミングを以下の通り決定します。

- **実施区分**: **B. Milestone 最終レビュー後に一括で実機検証を実施**（完了ゲート: **`Milestone v1.3 完了前`**）
- **判断理由**:
  - Android ネイティブ層（Java / Capacitor Plugin / WebView ブリッジ / 権限）の変更を含まない。
  - タッチ・スワイプ・ハードウェアキー等の新規物理操作やアニメーション変更を伴わない。
  - 主要ロジック（目次更新時自動進行・1ページ/1画面完了保存・5px 端丸め・クラウド同期進捗 LWW）は Vitest UT および Playwright 実ブラウザ IT（`SCN-03` / `SCN-05`）で決定論的に検証可能であり、実機確認は高 DPI 端末でのスクロール末尾丸め・Google Drive 実機同期連携のスモーク確認（2項目程度）に留まる。
- **登録する申し送り事項（`docs/quality/bug-and-handover-log.md` へ登録）**:
  - **`HO-41`**: Android 実機（高 DPI 端末）での連続スクロール末尾到達（5px 丸め）・1ページ短文話読了後の新着話追加によるしおり自動進行、および Google Drive クラウド同期での `bookmarkScrollProgress` 複数端末引き継ぎのスモーク確認（解決先: `Milestone v1.3 実機一括検証`、完了ゲート: `Milestone v1.3 完了前`）。
