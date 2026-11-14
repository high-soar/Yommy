---
type: spec-delta
title: "バックグラウンド一括キャッシュの非ブロッキング化とリーダー5話先読み優先度キュー統合"
description: "Issue #344 に対する差分仕様、影響する全体正本、UT/VRT/ITテスト計画、実装Sub-issue分割計画、および実機検証計画（HO-39）。"
issue: "#344"
status: "Completed (Archived)"
updated: "2026-11-14"
tags:
  [
    delta-spec,
    issue-344,
    cache-scheduler,
    priority-queue,
    batch-cache,
    prefetch,
    non-blocking,
    ho-39,
    milestone-v1.2,
  ]
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
  - docs/specs/features/webview-import.md
  - docs/quality/bug-and-handover-log.md
related_tests:
  - src/features/cache/services/cacheScheduler.test.ts
  - src/app/ServiceProvider.test.tsx
  - src/features/novel-detail/hooks/useNovelDetail.test.ts
  - src/features/novel-detail/components/NovelDetailPage.test.tsx
  - src/features/novel-detail/components/NovelDetailHeader.test.tsx
  - src/features/novel-detail/components/EpisodeListItem.test.tsx
  - src/features/reader/hooks/useReader.test.ts
  - src/features/settings/hooks/useStorageCache.test.tsx
  - src/features/webview-import/hooks/useWebViewImport.test.ts
  - test/it/scenarios/scn04-prefetch-and-cache.spec.ts
---

# Issue #344 差分仕様: バックグラウンド一括キャッシュの非ブロッキング化とリーダー5話先読み優先度キュー統合

## 1. 背景・目的・適用範囲

### 1.1 背景と課題

現行の一括キャッシュ実行（`useNovelDetail.startBatchCache`）には以下の制約があり、長編作品での実用性とリーダー閲覧体験を阻害している。

1. **操作ブロッキング**: `isBatchCaching === true` の間、`SCR-02`（作品詳細）の「最初から読む」「各エピソードタップ」「目次更新」「お気に入り」「一括キャッシュ開始/最新取得」等が `disabled` 化または無効化され、ユーザーは一括キャッシュ完了または手動キャンセルまで該当作品を読めない。
2. **ページ離脱による強制中断**: `useNovelDetail` 内部のローカル `AbortController` がコンポーネントのアンマウント時に `abort()` されるため、`SCR-02` から `SCR-03`（リーダー）や `SCR-01`（本棚）へ遷移した時点で一括キャッシュが強制停止する。
3. **ネットワーク競合・二重取得**: リーダー画面の即時取得（`high`）や次の5話先読み（`medium`）と一括キャッシュ（`low`）が単一の共有スケジューラを持たないため、レート制限（1.5秒間隔）の制御・割り込み・再開を一元管理できない。

### 1.2 目的

1. アプリ全体で共有する `CacheScheduler`（優先度付きバックグラウンドキュー: `high > medium > low`）を `ServiceProvider` 経由で提供し、`SCR-02` の操作・画面遷移を一切ブロックしない非ブロッキング一括キャッシュを実現する。
2. リーダー遷移時および閲覧中の即時取得（`high`）は 0ms で割り込み、5話先読み（`medium`）は一時待機または実行順優先したうえで、完了後に一括キャッシュ（`low`）を未取得話から自動再開できるようにする。
3. 本棚削除・一括キャッシュ全削除（`SCR-05`）・WebView DOM インポート（`SCR-04`）・アプリ再起動との整合性を保証する。

### 1.3 スコープ外（Out of Scope）

- アプリ完全終了後（OS タスクキル後）の OS ネイティブバックグラウンド実行（Android `WorkManager` 等）
- 先読み間隔（`PREFETCH_INTERVAL_MS = 1500`）およびキャッシュ有効期限（7日 `CACHE_TTL_MS`）の基本値変更
- 作品詳細ヘッダーの1行アイコンバー・3点メニュー再編自体（Issue `#343` で対応）

---

## 2. 設計詳細（Delta Spec）

### 2.1 `CacheScheduler` 設計（新規: `src/features/cache/`）

#### 2.1.1 ファイル構成

- `src/features/cache/types.ts`: `CachePriority`（`'high' | 'medium' | 'low'`）、`CacheFetchTask`、`CacheNovelProgress`、`CacheScheduler` インターフェースを定義する。
- `src/features/cache/services/cacheScheduler.ts`: `createCacheScheduler(...)` 実装を提供する。
- `src/app/ServiceProvider.tsx`: `ServiceContextValue` に `cacheScheduler?: CacheScheduler` を追加し、`fallbackDefaultsRef`（`v1.1` `R1-24`）同様の **`useRef` 等による安定参照**（再レンダリング時にインスタンスを再生成しない）として初期化・提供し、アンマウント時のみ `cacheScheduler.dispose()` を呼び出す。

> **注記（テストファイル登録）**: `src/features/cache/services/cacheScheduler.test.ts` は MK1 実装フェーズで新規作成し、同フェーズにて本ファイルの `related_tests` および `architecture.md` へ登録する。

#### 2.1.2 優先度とキュー仕様

| 優先度       | 用途                                                | レート制限（1.5秒）                   | 割り込み・競合挙動                                                                                                                                                                                                                                                                                                                                                                  | 永続キュー（`download_queue`）扱い                                                                                                                                                                                                                                                                                             |
| :----------- | :-------------------------------------------------- | :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`high`**   | リーダー表示話の即時フェッチ・リトライ              | **即時開始（0ms 待機）**              | `medium`/`low` のフェッチ・タイマーが進行中の場合、`AbortController` で即中断。中断した `low` タスクの DB 状態が `'downloading'` の場合は **`retryCount` を増加させず `'pending'` に巻き戻す**。`high` 完了後に未処理の `medium`/`low` を再評価して再開する。既存キャッシュフォールバック対象外の取得・パース失敗時は呼び出し元へ Promise reject を返し `reader-error` を表示する。 | メモリキュー優先実行。同一 `(novelId, chapterIndex)` が DB `download_queue` に存在する場合、`high` 取得完了時に `status = 'completed'` へ更新（または重複フェッチをスキップして既存取得結果に合流）。                                                                                                                          |
| **`medium`** | リーダー次の5話先読み（`prefetchChapters`）         | 適用（連続リクエスト間隔 1,500ms）    | `low` が待機中・実行中の場合、`low` の次チャンク処理より先に `medium` タスクを実行する。既存アクティブ HTTP 通信がある場合は現行フェッチ完了または割り込み後に実行。失敗時は警告ログに留めリーダー表示をエラーにしない。すべて完了後、保留中 `low` タスクを自動再開する。                                                                                                           | 一時的メモリタスクとして管理しつつ、DB に同話数の `'pending'` タスクがあれば重複取得せずスキップまたは `'completed'` 同期。                                                                                                                                                                                                    |
| **`low`**    | バックグラウンド一括キャッシュ（`startBatchCache`） | 適用（`PREFETCH_INTERVAL_MS = 1500`） | `SCR-02` をアンマウントして `SCR-03`/`SCR-01` へ遷移しても継続する。`high`/`medium` が存在する間は自動一時停止し、上位優先度キューが空になった時点で残りの `'pending'` 話から自動再開する。                                                                                                                                                                                         | `CacheScheduler.enqueueBatchCache` が `resetInterruptedToPending`・有効キャッシュ除外・`queueRepository.enqueueChapters` 登録を担い、`download_queue` 投入完了時に Promise を即時 resolve する。各話の進行ごとに `'downloading'` -> `'completed'` / `'failed'` を更新し、進捗・状態購読（`subscribeProgress`）へ即時通知する。 |

#### 2.1.3 一時停止・中断・キュー同期・競合ガードルール

1. **手動中断・割り込み・目次更新時の一時停止（`pauseNovelTasks`）**:
   - ユーザーの手動「中断」ボタン（`cancelBatchCache`）、`high` 割り込み中断、または `refreshToc` 実行時は `pauseNovelTasks(novelId)` により進行中タスクを安全に停止し、`'downloading'` 状態を **`retryCount` 非増加で `'pending'` に戻す**。`download_queue` 上の `'pending'` / `'failed'` 行は破棄せず保持するため、直後に `キャッシュを再開（残りN話）` として再開できる（`clearNovelQueue` は呼ばない）。
2. **破壊的操作前の協調停止（`cancelNovelTasks` / `cancelAllTasks`）**:
   - `cancelNovelTasks(novelId, options?: { clearQueue?: boolean })` は対象作品のメモリ上 `low`/`medium` タスクを中断・完了待機した上で、`clearQueue !== false`（デフォルト: 作品削除・全話本文キャッシュ削除時）は `queueRepository.clearNovelQueue(novelId)` でキューを全削除し、`clearQueue: false`（`onlyRead: true` による既読のみ本文キャッシュ削除時、`R1-18`）は `'downloading'` を `'pending'` に戻すのみとして未読話の `'pending'`/`'failed'` 行を保持する。
   - `cancelAllTasks(options?: { clearQueue?: boolean })`（`SCR-05` 設定画面のキャッシュ全削除前等）は全作品のメモリタスクを中断・書き込み完了待機し、`clearQueue !== false`（`onlyRead: false` 時）は `queueRepository.clearAllQueue()` を実行、`clearQueue: false`（`onlyRead: true` 時）は未読キュー行を保持したまま `chapterRepository.deleteAllCachedBodies(options)` を安全に実行可能にする。
3. **`syncNovelQueueState` との競合ガード**:
   - バックグラウンドで対象作品の `isBatchCaching === true` が継続している状態で `SCR-02` に再訪した場合、`useNovelDetail` は `queueRepository.resetInterruptedToPending(novelId)` を呼び出してはならない（現在実行中の `'downloading'` 話数を誤って `'pending'` に戻さないため）。アプリ初回起動などでスケジューラ上に当該作品のアクティブバッチが存在しない場合のみ、`resetInterruptedToPending(novelId)` を実行し中断タスクを復帰させる。
4. **進捗の購読（`subscribeProgress`）**:
   - 進捗情報 `CacheNovelProgress`（`novelId`, `isBatchCaching`, `status` [`"idle" | "running" | "preempted" | "paused" | "completed" | "cancelled"`], `current`, `total`, `failedCount`, `failedChapterIndexes`, `pausedReason`）をリアクティブに配信し、`SCR-02` に戻った際も現在の進行状況・`N/M 話キャッシュ済み`・進捗バー・失敗バッジを即座に復元するとともに、`completed` / `paused` / `cancelled` を明確に識別して完了通知誤発火を防止する。
5. **全画面自動 Pull（Tombstone 削除 ＆ 差分目次補完）とのバックグラウンド競合保護（`v1.1` `useBackgroundAutoPull` 協調）**:
   - `useBackgroundAutoPull` は全画面で動作するため、`CacheScheduler` が `'low'`/`'medium'` タスクをバックグラウンド実行中に他端末からの Tombstone 削除（`novelRepository.deleteNovel(novelId)` カスケード削除）が発生し得る。
   - このレースコンディションによる `FOREIGN KEY` 例外・削除済み作品への幽霊書き込み・誤失敗記録を防ぐため、`CacheScheduler` は各話の **HTTP 通信直前** および **`httpClient.getHtml` 完了直後（`chapterRepository.saveChapterBody` / `queueRepository.updateStatus` 実行直前）** に `signal.aborted` に加えて **`await chapterRepository.getChapter(novelId, chapterIndex) !== null`** を検証する。`null` の場合、`'low'` タスクは同一 `novelId` の未処理タスクをメモリ上から破棄して `status: "cancelled"` で安全終了（`saveChapterBody` / `updateStatus` / 失敗加算を実行しない）し、`'high'`/`'medium'` タスクも書き込みを行わず安全中断する。
   - また `SyncEngine` の `mergeExistingNovel` 差分目次補完（`upsertNovelWithToc(..., { updateOnly: true })`、`R1-19`）、`chapterRepository.saveChapterBody` 内のアトミックな `download_queue` 削除（`R1-44`）、および `saveChapterBody` / `recalculateNovelStats` の `novels.updated_at` 保持規律（`R1-01`）と競合なく安全に共存する。

### 2.2 `SCR-02`（作品詳細画面）の非ブロッキング化

- **操作ロック解除**:
  - `NovelDetailHeader`: `isBatchCaching` を理由としたお気に入り（`☆`）・目次更新（`🔄`）・3点メニュー（`⋮`）、「最初から読む（`detail-read-first-button`）」および「続きから読む（`detail-resume-button`）」ボタンの `disabled` ロックを撤廃する。`isRefreshing`（目次更新通信中）および `novel.totalChapters === 0`（0話時の読書開始ボタン無効）等の本来の制約のみ維持する。
  - `NovelDetailPage` / `EpisodeListItem`: `isBatchCaching` 中の `pointer-events-none opacity-80` およびエピソードタップ無効化を撤廃し、任意の話（キャッシュ済み・未キャッシュ問わず）をタップして即座に `SCR-03` へ遷移できる。
- **3点メニュー内アクション・破壊的操作の協調制御**:
  - 一括キャッシュ実行中も3点メニュー自体は開閉可能とし、`batch-cache-button` のみ二重起動防止のため無効化（例: `一括キャッシュ実行中...`）する。
  - 手動「中断」ボタン（`cancelBatchCache`）押下時は `cacheScheduler.pauseNovelTasks(novelId)` を呼び出し、未完了話の `'pending'`/`'failed'` キューを保持したまま安全停止する。
  - 破壊的・競合操作の協調制御:
    - `confirmDeleteNovel`: 削除前に `await cacheScheduler.cancelNovelTasks(novelId, { clearQueue: true })` を先行実行。
    - `confirmClearCache(options)`: 削除前に `await cacheScheduler.cancelNovelTasks(novelId, { clearQueue: !options.onlyRead })` を先行実行（既読のみ削除時は未読キューを保持 `R1-18`）。
    - `refreshToc`: 先頭で `isAnyExclusiveOperationActive()` ガードを通過し、`isRefreshingRef.current = true` / `isRefreshing = true` を設定した直後（`await` 前）の `try` 内で `wasBatchCaching = cacheScheduler?.isNovelBatchCaching(novelId) === true` を記録し、`await cacheScheduler?.pauseNovelTasks(novelId)` で一旦安全にポーズする。目次更新（`upsertNovelWithToc`）成功後、`wasBatchCaching === true` かつ未キャッシュ・期限切れ対象話が残存する場合は残対象インデックスで `await cacheScheduler.enqueueBatchCache(novelId, remainingTargetIndexes)` を呼び出し、キュー再登録後に即時 resolve して自動再開する。
- **`useNovelDetail` の排他制御分離（`isAnyExclusiveOperationActive`）・自動 Pull 連携・派生 State 整合（`v1.1` 協調）**:
  - `v1.1` で導入された `isAnyExclusiveOperationActive()`（現在 `isRefreshing` / `isBatchCaching` / `isDeleting` / `isClearingCache` を内包）から **`isBatchCaching` を分離**し、DB・TOC 構造を書き換える操作（`isRefreshingRef` / `isDeletingRef` / `isClearingCacheRef`）のみを排他対象とする。これにより一括キャッシュ実行中も `refreshToc`・`confirmDeleteNovel`・`confirmClearCache`・`toggleFavorite` がブロックされず即時に協調実行でき、また `syncEngine?.subscribePullCompleted` の `reloadDetail({ silent: true })`（`AC-ND-28`）も **`pendingSilentReloadRef`（`R1-22`）による遅延対象から `isBatchCaching` を除外**して即時サイレント最新化（Tombstone 削除による `novel === null` 安全処理含む）を実行する。
  - 失敗話数カウントは `v1.1` `No. 438` 準拠のまま単一派生値 `const failedCacheCount = failedChapterIndexes.length` を維持し、重複 State を設けない。
- **`useNovelDetail` アンマウント時の挙動変更**:
  - 旧仕様では `useEffect` クリーンアップで一括キャッシュ用 `AbortController.abort()` および無条件の `queueRepository.resetInterruptedToPending(novelId)` を呼んでいたが、`cacheScheduler` 注入時は **アンマウント時に `abort()` / `pauseNovelTasks()` も `queueRepository.resetInterruptedToPending(novelId)` も実行しない**（`resetInterruptedToPending` のアンマウント呼び出しは `!cacheScheduler` のフォールバック経路のみに限定）。購読（`subscribeProgress`）の解除のみ行い、実行中 `'downloading'` 話を巻き戻さずバックグラウンド一括キャッシュを継続させる（全非同期コールバック内では `isMountedRef.current` を確認してアンマウント後 State 更新を防止）。

### 2.3 `SCR-03`（リーダー画面）・`SCR-05`（設定）・`SCR-04`（WebView）との連携

1. **`SCR-03`（`useReader`）**:
   - `ServiceProvider` から `cacheScheduler` が提供されている場合、現在話取得を `priority: 'high'`（0ms 即時割り込み）、次5話先読みを `priority: 'medium'` として `cacheScheduler` 経由で実行する。
   - `v1.1` Issue #342 のしおり競合解決（`resolveBookmarkConflict("move")` → `goToChapter(remoteChapterIndex, { preserveChapterOnError: true })`、`R1-01`）において、未キャッシュ移動先話の `'high'` 取得失敗時の reject が呼び出し元へそのまま伝播することを保証し、失敗時に競合ダイアログ（`BookmarkConflictDialog`＋背面 `inert` 保護）を誤って閉じずに開いたまま維持する。
   - `cacheScheduler` 未注入時のフォールバック互換も維持し、既存ユニットテストとの互換性を保つ。
   - 5話先読み完了後、同一作品または他作品の `low` バッチタスクがキューに残っていればスケジューラが自動的に再開する。
2. **`SCR-05`（設定画面 `useStorageCache`）**:
   - 「キャッシュ整理（既読のみ / すべて削除）」実行前、実行中タスクとの競合（削除直後に書き込み完了してゴミデータが残るレースコンディション）を防ぐため、`await cacheScheduler?.cancelAllTasks({ clearQueue: !options.onlyRead })` を先に実行し、**`await` 後の `isMountedRef.current` 確認**を経てから `deleteAllCachedBodies(options)` を呼び出す（既読のみ削除時は `clearQueue: false` により未読 `'pending'`/`'failed'` キューを保持、`R1-18`）。なお `v1.1` `R1-23` で導入された `subscribePullCompleted` 連動 `refreshSummary({ silent: true })` とも競合なく動作する。
3. **`SCR-04`（内蔵ブラウザ・WebView DOM インポート `useWebViewImport`）**:
   - WebView DOM インポート完了時、既にキャッシュ済みとなった話数がバックグラウンドの `download_queue` に `'pending'` のまま残っていれば `queueRepository.deleteByNovelAndChapters(novelId, importedChapters)` および `cacheScheduler?.syncNovelProgress(novelId)` 等で重複取得を防止する。

---

## 3. テスト計画

| レイヤー                                | 対象ファイル・テスト種別                                                                                                                                                                                                  | 主な検証観点                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit Test (Vitest)**                  | `src/features/cache/services/cacheScheduler.test.ts`（MK1 新規）、`src/app/ServiceProvider.test.tsx`                                                                                                                      | `high > medium > low` 優先度実行、0ms `high` 割り込みと `'downloading'` -> `'pending'` 巻き戻し（`retryCount` 非増加）、`high` 失敗時 reject と `medium` 失敗時エラー非伝播、`medium` 完了後の `low` 自動再開、1.5s レート制限、`enqueueBatchCache` のキュー登録・即時 resolve、`status`（`running`/`preempted`/`paused`/`completed`/`cancelled`）と `failedChapterIndexes` 配信、通信前後 `getChapter !== null` による Tombstone 削除競合キャンセル、`pauseNovelTasks` / `cancelNovelTasks(..., { clearQueue })` / `cancelAllTasks(..., { clearQueue })` / `dispose`、`ServiceProvider` 安定参照・破棄（100% C0/C1/Functions カバレッジ）。 |
| **Component / Hook UT & Storybook VRT** | `NovelDetailHeader.{stories,test}.tsx`, `NovelDetailPage.{stories,test}.tsx`, `EpisodeListItem.{stories,test}.tsx`, `useNovelDetail.test.ts`, `useReader.test.ts`, `useStorageCache.test.tsx`, `useWebViewImport.test.ts` | `isBatchCaching === true` 中もヘッダーアクション・最初から読む・全エピソードタップが活性であること（Story + `npm run test:vrt:update` による 1280px/375px VRT）、`isAnyExclusiveOperationActive` 分離による `refreshToc`/`confirmDeleteNovel`/`confirmClearCache`/`toggleFavorite`・`subscribePullCompleted` 即時動作、`SCR-02` アンマウント継続と post-`await` `isMountedRef` ガード、`useReader` の `high`/`medium` 委譲（`preserveChapterOnError: true` 連携）、`useStorageCache` 全削除前 `cancelAllTasks`＋post-`await` ガード、`useWebViewImport` 後キュー同期（100% C0/C1/Functions）。                                               |
| **Integration Test (Playwright)**       | `test/it/scenarios/scn04-prefetch-and-cache.spec.ts`（`SCN-04` 拡張）                                                                                                                                                     | ① `SCR-02` で一括キャッシュ開始後、直ちに第1話または任意の未キャッシュ話をタップして `SCR-03` へ遷移・本文表示できること、② `SCR-03` 滞在中の先読み後に `SCR-02` へ戻った際、一括キャッシュが進捗継続または完了していること、③ 一括キャッシュキャンセル後に進捗バーが消滅すること、④ 設定画面のキャッシュ全削除でキュー・タスク競合なくクリアされること。                                                                                                                                                                                                                                                                                    |

> [!IMPORTANT]
> **Milestone `v1.1` Kaizen 反映テスト実装規律（`.github/skills/c-ut-workflow/SKILL.md` §1・§4・§5 準拠）**:
>
> - **非同期ポスト・`await` ガード**: すべての `await` 直後に `isMountedRef.current` / `AbortSignal.aborted` を検査し、アンマウント済み・キャンセル済みの状態更新や DB 書き込みを発生させない（`finally` リセット漏洩・エラー時状態不整合も UT で検証）。
> - **`vi.spyOn` クリーンアップと境界遵守**: コンポーネント UT の `vi.spyOn` には `afterEach(() => vi.restoreAllMocks())` または `try / finally` で `mockRestore()` を必須とし、親コンテナ／ページは直下子 Props 検証のみに留め孫 DOM を直接参照しない。
> - **VRT スナップショット更新基準**: Storybook VRT 更新時は `npm run test:vrt:update`（全プロジェクト `--update-snapshots=all`、`maxDiffPixelRatio: 0.001`）を実行し、1280px・375px 双方の差分を検証する。
> - **IT 決定論的待機と仮想時計**: `SCN-04` 拡張において TTL 7 日超過等の時間進行テストが必要な場合は固定未来日を使用せず `window.Date` `Proxy` 仮想時計を使用し、非同期待機は **`expect.poll`** で行う（`page.waitForTimeout` 使用禁止）。

---

## 4. Sub-issue 分割計画（Step 3 実行単位）

Step 2 Design Update PR が人間によりマージされた後、以下の順で Sub-issue を起票し MK -> IT を順次実装する。

1. **MK1 (`feat/issue-344-mk1-cache-scheduler`)**:
   - `src/features/cache/types.ts`, `src/features/cache/services/cacheScheduler.ts`, `src/features/cache/services/cacheScheduler.test.ts` の新規作成および `ServiceProvider` への統合。
   - `useReader`（`high`/`medium` 連携）、`useStorageCache`（`cancelAllTasks` 連携）、`useWebViewImport`（DOM インポート後キュー同期）の結合・単体テスト実装。
2. **MK2 (`feat/issue-344-mk2-nonblocking-novel-detail`)**:
   - `useNovelDetail` の `CacheScheduler` 連携（アンマウント継続・`isBatchCaching` ガード付き再訪問復元）。
   - `NovelDetailHeader`, `EpisodeListItem`, `NovelDetailPage` の操作ロック撤廃、Story / テスト / 1280px・375px VRT 更新。
3. **IT (`test/issue-344-it-priority-cache`)**:
   - `test/it/scenarios/scn04-prefetch-and-cache.spec.ts` の拡充（`SCN-04`: 非ブロッキング読込・`SCR-03` 先読み統合・`SCR-02` 復帰継続・全削除連携）、全 `SCN-01`〜`SCN-07` リグレッション確認。
   - `HO-39` 検証項目の整理、本 Delta Spec の `docs/specs/changes/archive/` へのアーカイブ（`git mv`）、関連 Canonical Spec の更新記録、人間マージ後に親 Issue `#344` クローズ。

---

## 5. Android 実機検証方針・申し送り事項 (`HO-39`)

- **判定区分**: **判定 B（Milestone `v1.2` 最終レビュー後に一括で実機検証を実施）**
- **理由**: 本タスクはアプリフォアグラウンド中の TypeScript / React / SQLite 状態管理と HTTP クライアントスケジューリングが中心であり、ネイティブプラグインの新規追加や権限追加を伴わない。ただし Android WebView 実機環境における長時間一括キャッシュ中のリーダー遷移レスポンス・手動中断/再開・キャッシュ削除との協調停止・実機ストレージ負荷の確認を Milestone `v1.2` の最終実機検証に含めるため、申し送り事項 **`HO-39`** として起票する。
- **検証項目（`HO-39`）**:
  1. Android 実機上で長編作品の一括キャッシュ開始直後に、未キャッシュ話（例: 第50話）や第1話をタップして遅延なく `SCR-03` で読めること。
  2. `SCR-03` で数話読み進めた後 `SCR-02` へ戻った際、バックグラウンド一括キャッシュが停止せず進行・完了していること。
  3. 一括キャッシュ中に「中断」押下および再訪問時に `キャッシュを再開（残りN話）` が正しく動作し、また作品別本文キャッシュ整理（既読のみ／全話）実行時に進行中タスクが安全に停止してキュー・データ整合性が保たれること。
  4. 設定画面（`SCR-05`）「すべての本文キャッシュを削除」を実行した際、実行中の一括キャッシュが即座に停止してキャッシュが 0 になること。
