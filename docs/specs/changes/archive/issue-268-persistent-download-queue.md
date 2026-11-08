---
type: spec-delta
title: "永続ダウンロードキュー（QueueRepository / download_queue）の実装と一括キャッシュ中断再開・再試行統合"
description: "Issue #268 に対する差分仕様。SQLite download_queue テーブルを操作する QueueRepository の実装、ServiceProvider DI 統合、および作品詳細画面（SCR-02）での一括キャッシュ中断再開・失敗話スキップ継続・再試行・取得失敗バッジ表示の設計。"
issue: "#268"
status: "Completed (Archived)"
updated: "2026-11-08"
tags:
  [
    delta,
    storage,
    download-queue,
    queue-repository,
    batch-cache,
    novel-detail,
    scr-02,
    retry,
    resume,
    ho-34,
  ]
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/settings.md
  - docs/quality/bug-and-handover-log.md
related_tests:
  - src/storage/schema.test.ts
  - src/storage/repositories/chapterRepository.test.ts
  - src/app/ServiceProvider.test.tsx
  - src/features/novel-detail/hooks/useNovelDetail.test.ts
  - src/features/novel-detail/components/NovelDetailHeader.test.tsx
  - src/features/novel-detail/components/EpisodeListItem.test.tsx
  - src/features/novel-detail/components/EpisodeList.test.tsx
  - src/features/novel-detail/components/NovelDetailPage.test.tsx
  - src/features/novel-detail/components/NovelDetailContainer.test.tsx
  - test/it/scenarios/scn04-prefetch-and-cache.spec.ts
---

# 差分仕様書：永続ダウンロードキュー（QueueRepository / download_queue）の実装と一括キャッシュ中断再開・再試行統合（Issue #268）

## 1. 変更の背景・目的（Why）

- SQLite スキーマ（`src/storage/schema.ts` および `docs/specs/db-schema.md` §3.3）には `download_queue` テーブル（`status`: `pending` / `downloading` / `completed` / `failed`、`retry_count`、`last_error`）が定義されている一方、Storage 層の `QueueRepository`（`src/storage/repositories/queueRepository.ts`）は未実装であった。
- 作品詳細画面（`SCR-02`）の「未取得話を一括キャッシュ」（`useNovelDetail.startBatchCache`）はインメモリ配列のみでループ制御されており、1話でも取得エラーが発生するとその場でループ全体が中断され、画面離脱やアプリ再起動後にもキュー状態やエラー履歴（どの話が取得失敗したか・リトライ回数）が保持されない課題があった。
- 本 Issue（#268）では、`QueueRepository` を実装して `ServiceProvider` へ DI 統合し、`SCR-02` の一括キャッシュと統合することで、**① 途中1話の通信エラー時に `failed` 記録して残りの話を継続取得、② 中断・画面離脱・再起動後の未完了キュー（`pending`）からの再開、③ 失敗話（`failed`）のバッジ可視化とワンタップ再試行、④ 全話完了時およびキャッシュ削除時のキュー自動クリーンアップ** を実現する。

### スコープ境界（In Scope / Out of Scope）

- **対象スコープ（In Scope）**:
  - Storage 層: `QueueRepository`（`src/storage/repositories/queueRepository.ts`）および関連型定義（`src/storage/types.ts`）の実装。
  - Storage 層連動: `ChapterRepository.deleteCachedBodies` および `deleteAllCachedBodies` 実行時の対応 `download_queue` レコード自動削除。
  - DI 層: `ServiceProvider`（`src/app/ServiceProvider.tsx`）への `queueRepository` 組み込み。
  - UI / Hook 層（`SCR-02`）: `useNovelDetail`、`NovelDetailHeader`、`EpisodeListItem`、`EpisodeList`、`NovelDetailPage`、`NovelDetailContainer` における永続ダウンロードキュー統合、ボタンラベル動的切替（`キャッシュを再開（残りN話）` / `失敗した話を再試行（N話）`）、各話 `取得失敗` バッジ（`data-testid="episode-failed-badge"`）表示。
  - E2E 結合テスト: Playwright `SCN-04`（`test/it/scenarios/scn04-prefetch-and-cache.spec.ts`）の拡充。
- **対象外スコープ（Out of Scope）**:
  - アプリ完全終了中の OS ネイティブバックグラウンドデーモン通信（Android `WorkManager` 等）。
  - 内蔵ブラウザ（`SCR-04`）および表示中 DOM 手動インポート機能（別 Issue #269 で実装）。

---

## 2. 仕様・設計の差分（What Changes）

### 2.1 影響する App 全体正本ファイル一覧

| 対象正本ファイル                      | 変更概要                                                                                                                                                                              |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/specs/db-schema.md`             | §3.2（キャッシュ削除時の `download_queue` 連動クリーンアップ）および §3.3（`download_queue` の状態遷移・Upsert 契約・クリーンアップ契機）を追記。                                     |
| `docs/specs/architecture.md`          | §1・§2.1 の `QueueRepository` を実装済みに更新。§3.4 に `QueueRepository` 型契約、§3.7 項3 に永続キュー連動の一括キャッシュ制御ポリシー（失敗スキップ継続・中断再開・再試行）を反映。 |
| `docs/specs/features/novel-detail.md` | `NovelDetailHeader` / `EpisodeListItem` / `EpisodeList` / `NovelDetailPage` / `useNovelDetail` の契約拡張、および受入条件 `AC-ND-11`, `AC-ND-12`, `AC-ND-24`, `AC-ND-25` を定義。     |
| `docs/specs/features/settings.md`     | §4.4（`useStorageCache` / `deleteAllCachedBodies`）および `AC-ST-16` に、一括キャッシュ削除時の `download_queue` 自動クリーンアップを追記。                                           |
| `docs/specs/requirements.md`          | `SYS-REQ-02`, `SYS-REQ-03`, `SYS-REQ-05` および §4 Milestone `v0.9` ロードマップに永続ダウンロードキュー・一括キャッシュ中断再開/再試行（Issue #268 / `HO-34`）を反映。               |
| `docs/specs/screen-transitions.md`    | `SCR-02`, `TR-18`, `TR-19`, `TR-20` および `SCN-04` マッピングに永続キュー再開・再試行・`AC-ND-24` / `AC-ND-25` を反映。                                                              |

---

### 2.2 Storage Layer 契約（`src/storage/types.ts` & `src/storage/repositories/queueRepository.ts`）

#### 1. 型定義（`src/storage/types.ts`）

```ts
export type DownloadQueueStatus =
  "pending" | "downloading" | "completed" | "failed";

export interface DownloadQueueItem {
  id: number;
  novelId: string;
  chapterIndex: number;
  targetUrl: string;
  status: DownloadQueueStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueChapterInput {
  chapterIndex: number;
  targetUrl: string;
}

export interface QueueRepository {
  /**
   * 対象エピソード群をダウンロードキューへ一括登録（Upsert）する。
   * 既に同一 (novel_id, chapter_index) のレコードが存在する場合は、
   * target_url を更新し、status = 'pending', last_error = NULL, updated_at = nowIso にリセットする（retry_count は保持）。
   */
  enqueueChapters(
    novelId: string,
    items: EnqueueChapterInput[],
    nowIso?: string,
  ): Promise<void>;

  /**
   * 指定作品のダウンロードキュー一覧を chapter_index 昇順で取得する。
   */
  listByNovelId(novelId: string): Promise<DownloadQueueItem[]>;

  /**
   * 指定エピソードのキューステータスを更新する。
   * options.incrementRetry === true の場合は retry_count = retry_count + 1 に加算し、
   * options.lastError が指定された場合は last_error を更新する（status === 'completed' または 'pending' 時は省略時 NULL クリア）。
   */
  updateStatus(
    novelId: string,
    chapterIndex: number,
    status: DownloadQueueStatus,
    options?: {
      lastError?: string | null;
      incrementRetry?: boolean;
      nowIso?: string;
    },
  ): Promise<void>;

  /**
   * 画面アンマウントやアプリ再起動時に残存している 'downloading' 状態のレコードを 'pending' に戻す。
   */
  resetInterruptedToPending(novelId: string, nowIso?: string): Promise<void>;

  /**
   * 指定作品の特定話数リストに該当するキューレコードを削除する（個別話閲覧・先読み完了時の整理用）。
   */
  deleteByNovelAndChapters(
    novelId: string,
    chapterIndexes: number[],
  ): Promise<void>;

  /**
   * 指定作品の全キューレコードを削除する（全話キャッシュ完了時・作品キャッシュ削除時用）。
   */
  clearNovelQueue(novelId: string): Promise<void>;

  /**
   * 全作品の全キューレコードを削除する（設定画面での全キャッシュ一括削除時用）。
   */
  clearAllQueue(): Promise<void>;
}
```

#### 2. `ChapterRepository` におけるキャッシュ削除時の `download_queue` 連動クリーンアップ

- `chapterRepository.deleteCachedBodies(novelId, options)`:
  - トランザクション内で `chapters` の本文キャッシュを `NULL` クリアする際、同時に `download_queue` の対象レコードを削除する。
  - `options?.onlyRead === true` の場合: `DELETE FROM download_queue WHERE novel_id = ? AND chapter_index IN (SELECT chapter_index FROM chapters WHERE novel_id = ? AND is_read = 1);`
  - `options?.onlyRead !== true`（全話削除）の場合: `DELETE FROM download_queue WHERE novel_id = ?;`
  - クラウド同期 LWW タイムスタンプ保護規約（R1-01）に従い、`novels.updated_at` は一切更新しない。
- `chapterRepository.deleteAllCachedBodies(options)`:
  - トランザクション内で全作品の本文キャッシュを `NULL` クリアする際、同時に `download_queue` の対象レコードを削除する。
  - `options?.onlyRead === true` の場合: `DELETE FROM download_queue WHERE EXISTS (SELECT 1 FROM chapters WHERE chapters.novel_id = download_queue.novel_id AND chapters.chapter_index = download_queue.chapter_index AND chapters.is_read = 1);`
  - `options?.onlyRead !== true`（全話削除）の場合: `DELETE FROM download_queue;`

---

### 2.3 DI 層統合（`src/app/ServiceProvider.tsx`）

- `ServiceContextValue` に `queueRepository: QueueRepository` を追加する。
- `ServiceProvider` 初期化時に `createQueueRepository(db)` を生成して Context に提供する（テスト用 `services` 注入時は `services?.queueRepository ?? createQueueRepository(db)` で解決）。

---

### 2.4 Viewer & UI Layer（`SCR-02`: `src/features/novel-detail/`）契約

#### 1. `useNovelDetail` のキュー同期・一括キャッシュ・再開・再試行パイプライン

- **返却値（`UseNovelDetailResult`）への追加フィールド**:
  - `pendingCacheCount: number`: 未完了の `'pending'` 状態エピソード数（中断・離脱後の再開判定用）。
  - `failedCacheCount: number`: 取得失敗（`'failed'` 状態）エピソード数（再試行判定・ボタン表示用）。
  - `failedChapterIndexes: number[]`: 未キャッシュかつ `'failed'` 状態の `chapterIndex` 昇順リスト（各話の `取得失敗` バッジ表示用）。
- **画面ロード・再同期時（`reloadDetail`）のキュー整合性維持**:
  1. `queueRepository.resetInterruptedToPending(novelId)` を実行し、前回のアンマウントやアプリ強制終了で `'downloading'` のまま残ったレコードを `'pending'` に戻す。
  2. リーダー画面（`SCR-03`）での閲覧や 5話自動先読みによって既に有効なキャッシュ（`isChapterFresh(chapter.downloadedAt, now) === true`）を持つエピソード、または `'completed'` ステータスのエピソードが `download_queue` に残っている場合、`queueRepository.deleteByNovelAndChapters(novelId, freshOrCompletedIndexes)` でキューから自動除去する。
  3. 全話が有効キャッシュ済み（`isAllCached === true`）の場合は `queueRepository.clearNovelQueue(novelId)` でキューを空にする。
  4. 残存する `download_queue` レコードから `pendingCacheCount`（`status === 'pending'` 件数）、`failedCacheCount`（`status === 'failed'` 件数）、`failedChapterIndexes` を算出して State に反映する。
- **一括キャッシュ開始・再開・再試行（`startBatchCache`）**:
  1. 開始時に `resetInterruptedToPending(novelId)` および有効キャッシュ済み話のキュー除外を実行する。
  2. 対象エピソード（未キャッシュまたは TTL 7日経過したキャッシュ）を抽出し、`queueRepository.enqueueChapters(novelId, targetInputs)` で `'pending'` として登録（既存の `'failed'` 行も `status = 'pending'`, `last_error = NULL` にリセットされ、`retry_count` は保持される）。
  3. 今回の実行対象話数 $N$（`targets.length`）に対して `batchCacheProgress = { current: 0, total: N }` から `N / N` までカウントする。
  4. ループ内の各話処理:
     - 取得開始前に `queueRepository.updateStatus(novelId, chapter.chapterIndex, 'downloading')` に更新する。
     - 取得・パース成功時: `chapterRepository.saveChapterBody` で保存し（`novels.updated_at` は不変、R2-16）、`queueRepository.updateStatus(novelId, chapter.chapterIndex, 'completed')` に更新し、`novel` / `chapters` / `failedChapterIndexes` State を即時更新する。
     - 取得失敗時:
       - `signal.aborted === true`（手動中断または画面アンマウント）の場合は、`queueRepository.updateStatus(novelId, chapter.chapterIndex, 'pending')` に戻してループを終了する。
       - 既存キャッシュが存在する 7日経過話（`hasExistingCache === true`）の短タイムアウト失敗時は、既存キャッシュへフォールバックして `updateStatus(..., 'completed')` とし次話へ進む。
       - 未キャッシュ話の通信・パース失敗時は、**ループを中断せず** `queueRepository.updateStatus(novelId, chapter.chapterIndex, 'failed', { lastError: errorMessage, incrementRetry: true })` を記録し、`failedChapterIndexes` State に該当 `chapterIndex` を即時追加した上で、残りの話がある場合は `PREFETCH_INTERVAL_MS`（1.5秒）待機して次の `'pending'` 話の取得を継続する。
     - 1話処理完了ごとに `batchCacheProgress = { current: i + 1, total: N }` を更新する。
  5. ループ終了時の処理:
     - **手動中断・アンマウント時（`signal.aborted`）**: `'downloading'` 行を `'pending'` に戻し、最新の `pendingCacheCount` / `failedCacheCount` / `failedChapterIndexes` を State に反映して `isBatchCaching = false`, `batchCacheProgress = null` とする。
     - **全話取得成功時（失敗 0 件）**: `queueRepository.clearNovelQueue(novelId)` で当該作品のキューレコードを完全削除（クリーンアップ）し、`pendingCacheCount = 0`, `failedCacheCount = 0`, `failedChapterIndexes = []`, `refreshMessage = "全話のキャッシュを取得しました"`, `error = null` に更新する。
     - **一部または全話失敗時（失敗 $F \ge 1$ 件）**: 成功した `'completed'` レコードのみを `deleteByNovelAndChapters` で削除して `'failed'` レコードを `download_queue` に残し、`pendingCacheCount = 0`, `failedCacheCount = F`, `failedChapterIndexes` を更新した上で、ヘッダーに `error = "${F}話の取得に失敗しました（再試行可能）"`（`data-testid="novel-detail-error"`）を表示する。

#### 2. `NovelDetailHeader` の一括キャッシュボタン動的ラベル切替

既存の `data-testid="batch-cache-button"` を維持したまま、`pendingCacheCount` および `failedCacheCount` に応じて表示ラベルを動的に切り替える：

| 状態条件                                                                          | ボタンラベル（`data-testid="batch-cache-button"`）                  | 活性状態（`disabled`）                 |
| :-------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :------------------------------------- |
| `novel.totalChapters === 0`                                                       | `未取得話を一括キャッシュ`                                          | `true`（常に非活性）                   |
| `isAllCached === true`                                                            | `全話キャッシュ済み`                                                | `true`（常に非活性）                   |
| `pendingCacheCount > 0`（中断・離脱後の未完了 `'pending'` 話が残っている場合）    | `キャッシュを再開（残り${pendingCacheCount + failedCacheCount}話）` | `isRefreshing` または `isBatchCaching` |
| `pendingCacheCount === 0` かつ `failedCacheCount > 0`（失敗話のみ残っている場合） | `失敗した話を再試行（${failedCacheCount}話）`                       | `isRefreshing` または `isBatchCaching` |
| 上記以外（未開始・キュー空で未キャッシュ話がある場合）                            | `未取得話を一括キャッシュ`                                          | `isRefreshing` または `isBatchCaching` |

#### 3. `EpisodeListItem` の `取得失敗` バッジ表示

- `EpisodeListItemProps` に `isDownloadFailed?: boolean`（既定値 `false`）を追加する。
- 本文キャッシュ状態バッジの排他描画ルール:
  1. `chapter.downloadedAt !== null`（または `chapter.byteSize > 0`）の場合: `data-testid="episode-cached-badge"`（ラベル: `取得済み`）
  2. 上記以外で `isDownloadFailed === true` の場合: `data-testid="episode-failed-badge"`（ラベル: `取得失敗`、ローズ/赤系警告スタイル）
  3. 上記以外の場合: `data-testid="episode-uncached-badge"`（ラベル: `未取得`）

---

### 2.5 受入条件（Acceptance Criteria）の追加・更新

`docs/specs/features/novel-detail.md` において `AC-ND-11`, `AC-ND-12` を永続キュー仕様へ更新し、新規に `AC-ND-24`, `AC-ND-25` を追加する：

| AC ID          | 対象機能                                               | 検証条件                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 関連要件 / 遷移                |
| :------------- | :----------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- |
| **`AC-ND-24`** | 永続キューによる一括キャッシュ中断再開と進捗・自動整理 | 一括キャッシュ実行中に対象話を `download_queue`（`pending` → `downloading` → `completed`）で永続管理し、「中断」押下または画面離脱（アンマウント）時に未完了話が `pending` として保持され、ボタンラベルが `キャッシュを再開（残りN話）` に切り替わること。また再開時は残り $N$ 話を分母（`0/N` 〜 `N/N`）として進捗表示し、全話取得完了時および本文キャッシュ削除時にキューが自動削除されること。                                                                       | `SYS-REQ-02, 03, 05` / `TR-18` |
| **`AC-ND-25`** | 取得失敗話のスキップ継続・取得失敗バッジ・再試行       | 一括キャッシュ中に特定話の取得が失敗（通信エラー・タイムアウトかつ既存キャッシュなし）した場合、該当話を `download_queue` に `status = 'failed'`（`retry_count` 加算、`last_error` 記録）として保存して残りの `pending` 話の取得を継続すること。ループ完了後に失敗話行に `取得失敗` バッジ（`episode-failed-badge`）、ヘッダーにエラー通知と `失敗した話を再試行（N話）` ボタンが表示され、再試行で取得成功すると `取得済み` へ遷移しキューがクリーンアップされること。 | `SYS-REQ-02, 03, 05` / `TR-18` |

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Vitest: C0/C1/Functions 100%）

1. **`src/storage/repositories/queueRepository.test.ts`（新設）**:
   - `enqueueChapters`: 新規追加、同一 `(novel_id, chapter_index)` 存在時の `status = 'pending'`, `last_error = NULL` リセットおよび `retry_count` 維持、空配列時の no-op。
   - `listByNovelId`: `chapter_index` 昇順取得、他作品レコードとの分離。
   - `updateStatus`: `downloading` / `completed` / `failed` / `pending` への遷移、`incrementRetry: true` での `retry_count + 1`、`lastError` の保存とクリア。
   - `resetInterruptedToPending`: `'downloading'` のみ `'pending'` に戻り、`'completed'` や `'failed'` は変化しないこと。
   - `deleteByNovelAndChapters` / `clearNovelQueue` / `clearAllQueue`、および親作品削除（`novelRepository.deleteNovel`）時の `ON DELETE CASCADE` 動作。
2. **`src/storage/repositories/chapterRepository.test.ts`（拡充）**:
   - `deleteCachedBodies`（`onlyRead: true` および `onlyRead: false`）実行時に、対応する `download_queue` レコードが同一トランザクション内で削除され、`novels.updated_at` が不変であること。
   - `deleteAllCachedBodies`（`onlyRead: true` および `onlyRead: false`）実行時に、対応する `download_queue` レコードが削除されること。
3. **`src/app/ServiceProvider.test.tsx`（拡充）**:
   - デフォルト初期化およびカスタム注入時に `queueRepository` が Context から提供されること。
4. **`src/features/novel-detail/` 単体テスト群（拡充）**:
   - `useNovelDetail.test.ts`:
     - 初回ロード時の `'downloading'` → `'pending'` リセット、リーダーで取得済み（Fresh）となった話のキュー自動除外。
     - 一括キャッシュ中の途中話エラー時にループが中断せず残りの話を取得完了し、失敗話が `'failed'`（`retryCount = 1`）となり `error = "1話の取得に失敗しました（再試行可能）"` が設定されること。
     - 中断（`cancelBatchCache`）後の `pendingCacheCount` 反映と、再開時の残り話数分母（`0/N` 〜 `N/N`）進捗、および再試行（`失敗した話を再試行`）成功後のキュー完全クリーンアップ。
     - キャッシュ削除（`confirmClearCache`）時のキュー状態リセット。
   - `NovelDetailHeader.test.tsx` / `EpisodeListItem.test.tsx` / `EpisodeList.test.tsx` / `NovelDetailPage.test.tsx` / `NovelDetailContainer.test.tsx`:
     - Portable Stories（`composeStories`）を用いた `キャッシュを再開（残りN話）`、`失敗した話を再試行（N話）`、`取得失敗` バッジ（`episode-failed-badge`）の 1対1 Story/UT 検証。

### 3.2 VRT（Storybook Visual Regression Testing: 1280px / 375px）

- `NovelDetailHeader.stories.tsx`: 再開待ち状態（`ResumePending`）、再試行待ち状態（`RetryFailed`）のストーリー追加と VRT スナップショット検証。
- `EpisodeListItem.stories.tsx` / `EpisodeList.stories.tsx` / `NovelDetailPage.stories.tsx`: `取得失敗` バッジ表示ストーリーの追加と 1280px / 375px モバイル幅でのレイアウト崩れ・折り返し検証。

### 3.3 システム結合テスト（Playwright IT: `SCN-04`）

- `test/it/scenarios/scn04-prefetch-and-cache.spec.ts` を拡充し、実ブラウザ＋インメモリ SQLite 環境で以下を一気通貫検証する：
  1. 一括キャッシュ中に特定話が通信エラーとなった際、残りの話が最後まで取得され、失敗話に `取得失敗` バッジ（`episode-failed-badge`）とヘッダーに `失敗した話を再試行（1話）` ボタンが表示されること。
  2. 通信回復後に `失敗した話を再試行（1話）` を押下すると、失敗話のみが再取得されて `取得済み`（`全話キャッシュ済み`）へ遷移し、`download_queue` が空にクリーンアップされること。
  3. 一括キャッシュ途中で「中断」または別画面へ遷移して戻った際、`キャッシュを再開（残りN話）` が表示され、再開操作で残り話数が取得完了すること。

---

## 4. 実装 Sub-issue 分割計画

| 順序 | Sub-issue 番号 | タイトル                                                                                                                               | 主な対象レイヤー・成果物                                                                                                                                   | マージ方式                              |
| :--: | :------------: | :------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- |
|  1   |    **#293**    | `[v0.9][#268-MK1] Storage層（QueueRepository / download_queue）の実装とServiceProvider DI・キャッシュ削除連動`                         | `src/storage/types.ts`, `src/storage/repositories/queueRepository.ts`, `src/storage/repositories/chapterRepository.ts`, `src/app/ServiceProvider.tsx` + UT | AI 自律マージ（Gate 1〜6 通過後）       |
|  2   |    **#294**    | `[v0.9][#268-MK2] 作品詳細画面（SCR-02）の一括キャッシュ永続キュー統合・再開/再試行UI・取得失敗バッジ実装とVRT更新`                    | `src/features/novel-detail/**`（`useNovelDetail`, `NovelDetailHeader`, `EpisodeListItem`, `EpisodeList`, `NovelDetailPage`, `NovelDetailContainer`）+ VRT  | AI 自律マージ（Gate 1〜6 通過後）       |
|  3   |    **#295**    | `[v0.9][#268-IT] 永続ダウンロードキューによる一括キャッシュ・中断再開・再試行のPlaywright結合テスト（SCN-04）拡充と差分仕様アーカイブ` | `test/it/scenarios/scn04-prefetch-and-cache.spec.ts`, `docs/specs/changes/archive/issue-268-persistent-download-queue.md`, 正本 `Approved (#268)` 更新     | 人間承認・マージ（`Closes #268, #295`） |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）・Android 実機検証計画

- **Android 実機検証の実施タイミング**: **B. ミニリリース Milestone `v0.9` 完了時（Issue #270 Step 2-2）にまとめて実機検証**（Step 1 `/grill-me` 合意事項）。
- **登録する申し送り事項（`HO-34`）**:
  - **ID**: `HO-34`
  - **起票元**: `#268`
  - **内容**: Android 実機（`@capacitor-community/sqlite` ＋ `CapacitorHttp`）における永続ダウンロードキュー（`download_queue`）を用いた未取得話一括キャッシュ、中断・画面離脱・アプリ再起動後の再開（`キャッシュを再開（残りN話）`）、通信エラー発生時のスキップ継続と `取得失敗` バッジ・再試行（`失敗した話を再試行（N話）`）、および本文キャッシュ削除時のキュークリーンアップ動作の実機確認。
  - **解決先**: Milestone `v0.9` 完了承認 Issue #270（Step 2-2 実機検証）
  - **完了ゲート**: `Milestone v0.9 完了前`
  - **状態**: `Open`
