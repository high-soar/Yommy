---
type: spec-delta
title: "複数端末利用時（リーダー表示のまま画面ロック・復帰時）のクラウド同期しおり上書き防止と競合確認ダイアログの設計"
description: "Issue #342 に対する差分仕様、全画面バックグラウンド復帰自動Pull（5分閾値）、リーダー画面（SCR-03）しおり競合確認モーダルダイアログ（OSバックキー・背景タップ抑止）、未操作離脱時flushBookmark上書き防止・画面ロック時即時フラッシュ、作品詳細（SCR-02）自動更新、テスト計画、およびSub-issue分割計画。"
issue: "#342"
status: "Review (#342)"
updated: "2026-11-13"
tags:
  - delta
  - cloud-sync
  - google-drive
  - bookmark
  - conflict-dialog
  - visibilitychange
  - reader
  - novel-detail
  - bookshelf
  - router
  - scr-01
  - scr-02
  - scr-03
  - ho-38
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/quality/bug-and-handover-log.md
related_tests:
  - src/App.test.tsx
  - src/app/router.test.tsx
  - src/features/cloud-sync/services/syncEngine.test.ts
  - src/features/bookshelf/hooks/useBookshelf.test.ts
  - src/features/novel-detail/hooks/useNovelDetail.test.ts
  - src/features/reader/components/ReaderView.test.tsx
  - src/features/reader/components/ReaderPage.test.tsx
  - src/features/reader/components/ReaderContainer.test.tsx
  - src/features/reader/hooks/useReader.test.ts
  - test/it/scenarios/scn05-cloud-sync.spec.ts
---

# 差分仕様書：複数端末利用時（リーダー表示のまま画面ロック・復帰時）のクラウド同期しおり上書き防止と競合確認ダイアログの実装（Issue #342）

本ドキュメントは、Issue #342「`[v1.1] 複数端末利用時（リーダー表示のまま画面ロック・復帰時）のクラウド同期しおり上書き防止と競合確認ダイアログの実装`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

タブレット（自宅）とスマートフォン（外出先）など複数端末を併用して読書する際、「小説リーダー画面（`SCR-03`）を開いたまま画面ロック（スリープ）」して端末を切り替える利用形態が頻発する。例として、タブレットで第10話まで読んでリーダー表示のまま画面ロックし、スマートフォンで第15話まで読み進めて Google Drive へ同期保存した後、タブレットの画面ロックを解除したケースを考える。

現行仕様・実装には以下の 2 つの構造的課題が存在し、タブレット側で第15話のしおりが第10話へ意図せず上書きされてしまう。

1. **リーダー離脱時の無条件な `flushBookmark()` 実行**:
   `ReaderContainer` から「← 目次」ボタン・OS バックキー（`popstate`）・下部タブ遷移・コンポーネントアンマウントで離脱する際、ページめくりやスクロールを一度も行っていない状態でも無条件に `flushBookmark()` → `novelRepository.updateBookmark()` が呼ばれ、表示中話数（第10話）と **離脱時点の現在時刻（`last_read_at = now`）** で DB 更新および `syncEngine.notifyChanged()`（自動 Push）が実行されていた。これにより LWW（`lastReadAt` 比較）で古い第10話が別端末の新しい第15話に勝ってしまう。
2. **バックグラウンド復帰時の自動 Pull が本棚画面（`SCR-01`）限定**:
   5分（`300,000ms`）以上の休止後にフォアグラウンド復帰した際の `visibilitychange` 自動 Pull が `useBookshelf` 内にのみ実装されており、リーダー画面（`SCR-03`）や作品詳細・目次画面（`SCR-02`）を表示したまま画面ロック・復帰しても自動 Pull が発動しない。また、リーダー表示中に他端末の新規しおり話数を Pull した場合のユーザー確認 UI が存在しない。

そこで `SYS-REQ-06`・`SYS-REQ-12`・`SYS-REQ-16` を拡張し、**全画面での 5 分以上バックグラウンド復帰時自動 Pull**、**作品詳細画面の自動リロード追従**、**リーダー画面でのしおり競合確認モーダルダイアログ（誤操作ガード付き）**、および **未保存進捗変更がある場合のみ書き込む `flushBookmark()` 保護＋画面ロック時の即時フラッシュ** を一体で設計・実装する。

---

## 2. 仕様・設計の差分（What Changes）

Step 1 で確定した要件・合意事項に基づき、以下のアーキテクチャおよび画面・フック契約を変更・新設します。

### 2.1 Cloud Sync 層（`SyncEngine` 完了購読と全画面自動 Pull フック）

[docs/specs/architecture.md](../architecture.md) §3.8.2 および `src/features/cloud-sync/`・`src/App.tsx` を以下の通り拡張します。

1. **`SyncEngine.subscribePullCompleted`（Pull 完了イベント購読機構の追加）**:
   - `SyncEngine`（`src/features/cloud-sync/services/syncEngine.ts`）に以下の結果型および購読メソッドを追加する。
     ```ts
     export interface PullMergeResult {
       pulled: boolean;
       mergedNovels: number;
     }

     subscribePullCompleted(
       listener: (result: PullMergeResult) => void,
     ): () => void;
     ```
   - `pullAndMerge()` 正常完了時（`!isPullOnlySkipped`、少なくとも `pulled: true` または完了結果確定時）に登録済みリスナーへ結果を通知する。リスナー内で例外が発生しても他リスナーおよび `pullAndMerge()` 自体の完了を阻害しないよう `try/catch` で隔離する。
   - **ローカル未Push変更のデバウンス通知**: `SyncEngine.pullAndMerge()` は `pulled: true` でリモートをローカル DB へマージした際、全登録リスナーへ `PullMergeResult` をブロードキャストする。これにより現在マウント中の画面（`SCR-01` 本棚、`SCR-02` 作品詳細、`SCR-03` リーダー）が共通の契機で最新 DB 状態を再読込・競合検知できる。

2. **全画面共通バックグラウンド復帰自動 Pull フック（`useBackgroundAutoPull` / `src/features/cloud-sync/hooks/useBackgroundAutoPull.ts`）**:
   - 従来 `useBookshelf` 内に閉じていた `visibilitychange`（休止閾値 `BACKGROUND_SYNC_THRESHOLD_MS = 5 * 60 * 1000` ＝ `300,000ms`）リスナーを専用フック `useBackgroundAutoPull` として切り出し、`AppContent`（`src/App.tsx`）のルートレベルで常時マウントする。
   - これにより、ユーザーが `SCR-01`（本棚）・`SCR-02`（作品詳細）・`SCR-03`（リーダー）および他画面のいずれを開いたまま画面ロック（`document.visibilityState === "hidden"`）し、5 分（`300,000ms`）以上経過して復帰（`document.visibilityState === "visible"`）した場合でも、1 箇所で重複なく自動 Pull が実行される。
   - 挙動ルール:
     - `document.visibilityState === "hidden"` になった時刻 `lastHiddenAt` を記録する。
     - `document.visibilityState === "visible"` 復帰時、`lastHiddenAt !== null` かつ `Date.now() - lastHiddenAt >= 300_000` の場合に `lastHiddenAt = null` にリセットした上で処理を起動する（5 分未満の場合は `lastHiddenAt = null` のみ行いスキップ）。
     - `cloudSyncBridge?.getAuthState` が存在する場合は認証状態を確認し、`authState.status !== "connected"`（`unlinked` 等）のときは `pullAndMerge()` を呼び出さない（R1-14）。
     - 同一復帰処理の多重実行ガード（`isPullingRef`）および例外吸収（`.catch(() => {})`）を備え、アプリが通信失敗でクラッシュしないこと。
     - ※`useBookshelf.ts` からは重複する `visibilitychange` リスナーを撤去し、代わりに `useBookshelf` マウント中の `syncEngine.subscribePullCompleted` 購読（`if (result.pulled) void reloadNovels()`）に統一する（初回マウント時の `pullAndMerge()` は従来通り維持）。

### 2.2 Application Router・App シェルの OS バックキー抑止ガード

[docs/specs/architecture.md](../architecture.md) §3.5（`src/app/router.tsx`）および `src/App.tsx` を拡張し、競合確認モーダル表示中の誤操作（画面離脱）を物理的・論理的に遮断します。

1. **`RouterContextValue` への戻る遷移ブロック API 追加（`src/app/router.tsx`）**:
   ```ts
   blockBackNavigation?: () => () => void; // 登録中は true（参照カウント管理）
   isBackNavigationBlocked?: () => boolean;
   ```
   - 内部では参照カウント（または Set トークン）`backBlockersRef` で管理し、`blockBackNavigation()` が返却するクリーンアップ関数を呼ぶまでブロック状態を維持する。
   - ブラウザの `popstate` イベント発火時（`handlePopState`）、`isBackNavigationBlocked()` が `true` の場合はルート遷移（`setCurrentPath`）を実行せず、`window.location` が変わっていれば `window.history.pushState(null, "", currentPathRef.current)` で現在パスを維持する。
2. **`AppContent`（`src/App.tsx`）での Capacitor OS バックキー遮断**:
   - `appBridge.addBackButtonListener` コールバック先頭において `if (router.isBackNavigationBlocked?.()) return;` を評価し、ブロック中は `router.back()` および終了トーストを一切発火させない。

### 2.3 作品詳細・目次画面（`SCR-02`）の自動更新

[docs/specs/features/novel-detail.md](../features/novel-detail.md) §4.2 を以下の通り拡張します。

- **`useNovelDetail` における Pull 完了時自動リロード**:
  - `useNovelDetail` マウント中に `syncEngine?.subscribePullCompleted` を購読し、`result.pulled === true` かつ `novelId` が設定されている場合に `void reloadDetail()` を呼び出す。
  - これにより、`SCR-02` を開いたまま画面ロック（5分以上）→ロック解除した際、他端末で更新された「しおり（`しおり` バッジおよび `続きから読む（第N話）` ボタン）」と「既読バッジ（`既読`）」が自動 Pull 完了直後に最新状態へ自動更新される。
  - なお、自動 Pull に伴うリロードでは初回の `hasScrolledToBookmarkRef` スクロールジャンプを誤って再発火させない（`reloadDetail()` の既存仕様に準拠、または既存読込完了時はスクロール位置保持、しおり表示・バッジのみ更新）。

### 2.4 小説リーダー画面（`SCR-03`）のしおり保護・即時フラッシュ・競合ダイアログ

[docs/specs/features/reader-view.md](../features/reader-view.md) を以下の通り拡張します。

#### 2.4.1 未保存進捗フラグ（`hasPendingBookmarkRef`）と画面ロック時即時フラッシュ（`useReader` / `ReaderView`）

1. **`ReaderView` のプログラム的スクロール復元ガード（`src/features/reader/components/ReaderView.tsx`）**:
   - エピソード表示開始時や設定変更時に `restoreScrollPosition(el, writingMode, initialScrollProgress)` が `el.scrollTop` / `el.scrollLeft` を設定すると、実ブラウザ環境では非同期 `scroll` イベントが発火して `onScrollProgressChange` が誤呼び出しされる恐れがある。
   - これを防ぐため `isRestoringScrollRef`（`restoreScrollPosition` 実行時に `true` にセットし、`requestAnimationFrame` で解除）を導入し、`handleScroll` 内では `isRestoringScrollRef.current === true` の間は `onScrollProgressChange` を発火しない。
2. **`useReader` における未保存進捗追跡（`hasPendingBookmarkRef`）と `flushBookmark` 保護**:
   - `hasPendingBookmarkRef = useRef(false)` を導入し、「ローカルで未 DB 保存（または直近 DB 書き込み待ち）の進捗変更が存在するか」を厳密に管理する。
   - **初期ロード（`loadInitialData`）および `goToChapter` 完了時**:
     - `hasPendingBookmarkRef.current = false` にリセットする（なお別話を開いた場合の `updateBookmark(novelId, targetIndex, 0)` 自体は初期ロード時・話遷移時に完了しているため、以後の不要書き込みを行わない）。
   - **ユーザー操作による進捗更新（`updateScrollProgress(progress)`）**:
     - `hasPendingBookmarkRef.current = true` にセットし、従来通り 300ms デバウンスタイマーを設定する。
     - 300ms デバウンス完了時: `novelRepository.updateBookmark(currentNovel.id, currentChapterIndexRef.current, clamped)` を実行して成功時に `hasPendingBookmarkRef.current = false` へ戻し、`syncEngine?.notifyChanged().catch(() => {})` を呼び出して変更をクラウド同期へ通知する（これにより、ページめくりから 300ms 経過後に画面ロックした場合も他端末へ変更が同期され得る状態となる）。
   - **`flushBookmark()` の条件付き書き込み**:
     - 保留中のデバウンスタイマー（`bookmarkDebounceTimerRef.current`）がある場合は即座にキャンセルする。
     - **`hasPendingBookmarkRef.current === false` かつ保留タイマーなしの場合**: `novelRepository.updateBookmark()` および `syncEngine.notifyChanged()` を **一切実行せずに即座にリターンする**。
     - **`hasPendingBookmarkRef.current === true` の場合**: `novelRepository.updateBookmark(currentNovel.id, currentChapterIndexRef.current, scrollProgressRef.current)` を即時実行し、成功時に `hasPendingBookmarkRef.current = false` とし、`novel` State / `novelRef` 更新および `syncEngine?.notifyChanged().catch(() => {})` を実行する。
   - **画面ロック・バックグラウンド移行時（`visibilityState === "hidden"`）の即時フラッシュ**:
     - `useReader` 内の `visibilitychange` リスナーで `document.visibilityState === "hidden"` を検知した際、**`hasPendingBookmarkRef.current === true`（300ms デバウンス待機中を含む未保存変更あり）の場合のみ即座に `void flushBookmark()` を実行** し、DB 保存を完了させる。未保存変更がない場合（`false`）は何もしない。

#### 2.4.2 クラウド同期しおり競合検知と解決フロー（`useReader`）

1. **`UseReaderResult` の拡張（`src/features/reader/hooks/useReader.ts`）**:
   ```ts
   export interface BookmarkConflictState {
     currentChapterIndex: number;
     remoteChapterIndex: number;
   }
   ```
   `UseReaderResult` に以下を追加する：
   - `bookmarkConflict: BookmarkConflictState | null`（競合なし時は `null`）
   - `resolveBookmarkConflict: (action: "move" | "keep") => Promise<void>`
2. **Pull 完了時の競合検知ルール**:
   - `useReader` は `syncEngine?.subscribePullCompleted` を購読する。
   - `result.pulled === true` かつ `novelRef.current` が存在する場合、`const latestNovel = await novelRepository.getNovelById(novelRef.current.id)` で最新 DB レコードを取得する（アンマウント済みの場合は中断）。
   - `latestNovel?.bookmarkChapterIndex` が非 null であり、有効範囲（`1 <= latestNovel.bookmarkChapterIndex <= latestNovel.totalChapters`）内かつ **`latestNovel.bookmarkChapterIndex !== currentChapterIndexRef.current`** の場合：
     - `setBookmarkConflict({ currentChapterIndex: currentChapterIndexRef.current, remoteChapterIndex: latestNovel.bookmarkChapterIndex })` をセットし、競合確認モーダルを表示させる。
     - ※この時点ではローカルの `hasPendingBookmarkRef` は変更せず（`false` 維持）、`bookmarkChapterIndex` の自動巻き戻し書き込みも行わない。
   - `latestNovel.bookmarkChapterIndex === currentChapterIndexRef.current` の場合：
     - 競合なし（同一話数）。もし `bookmarkConflict` が開いていた場合は `null` にクリアしてもよい。
3. **競合解決アクション（`resolveBookmarkConflict(action)`）**:
   - **`action === "move"`（「第{remoteChapterIndex}話へ移動する」選択時）**:
     - 対象話数 `target = bookmarkConflict.remoteChapterIndex` を取得し、`setBookmarkConflict(null)` でダイアログを閉じる。
     - `const moved = await goToChapter(target)` を実行して表示話を第 `target` 話へ切り替え、URL 同期（`onNavigateChapter` 連携）も既存 `ReaderContainer` の前後話遷移と同一導線で行われるようにする。
     - ※`goToChapter` 内で対象話の本文取得に失敗した場合は `error` 表示となるため、ユーザーはリトライまたは内蔵ブラウザフォールバックを利用できる。
   - **`action === "keep"`（「第{currentChapterIndex}話のまま読む」選択時）**:
     - `setBookmarkConflict(null)` でダイアログを閉じる。
     - 現在の表示話（`currentChapterIndexRef.current`）および現在進捗率（`scrollProgressRef.current`）で **`novelRepository.updateBookmark(currentNovel.id, currentChapterIndexRef.current, scrollProgressRef.current)` を明示実行** し、`last_read_at = now` へ更新する。
     - `novel` State / `novelRef` を最新化し、`hasPendingBookmarkRef.current = false` を維持した上で、`syncEngine?.notifyChanged().catch(() => {})` を呼び出してクラウドへ現在話維持を同期通知する。

#### 2.4.3 `BookmarkConflictDialog`（新規 Presentational コンポーネント）と誤操作防止ガード

- **新規コンポーネント**: `src/features/reader/components/BookmarkConflictDialog.tsx`（+ `.stories.tsx` + `.test.tsx`）
- **Props 契約（`BookmarkConflictDialogProps`）**:
  ```ts
  export interface BookmarkConflictDialogProps {
    isOpen: boolean;
    currentChapterIndex: number;
    remoteChapterIndex: number;
    isResolving?: boolean;
    onMoveToRemote: () => void;
    onKeepCurrent: () => void;
  }
  ```
- **UI 仕様・セマンティック属性**:
  - `isOpen === false` の場合は `null` を返し何も描画しない。
  - ルートオーバーレイ（`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4`）: **背景クリック（Backdrop タップ）には `onClick` クローズ処理を一切設定しない**。
  - ダイアログ本体: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="bookmark-conflict-title"`, `data-testid="bookmark-conflict-dialog"`。
  - タイトル（`id="bookmark-conflict-title"`）: `他の端末で読書位置が更新されました`
  - 本文メッセージ（`data-testid="bookmark-conflict-message"`）: `別の端末で第${remoteChapterIndex}話まで読み進められています（現在は第${currentChapterIndex}話を表示中）。どちらの話から読みますか？`
  - アクションボタン（2択、縦並びまたは横並びで押しやすく明確な表示）:
    1. **移動ボタン（プライマリ）**: `data-testid="bookmark-conflict-move-button"`、ラベル `第${remoteChapterIndex}話へ移動する`、`onClick={onMoveToRemote}`、`disabled={isResolving}`。
    2. **維持ボタン（セカンダリ）**: `data-testid="bookmark-conflict-keep-button"`、ラベル `第${currentChapterIndex}話のまま読む`、`onClick={onKeepCurrent}`、`disabled={isResolving}`。
- **OS バックキー / Escape キー誤操作ガード**:
  - `BookmarkConflictDialog` 自体または `ReaderPage` / `ReaderContainer` で `Escape` キーのデフォルトキャンセル動作を抑止（ダイアログを閉じない）。
  - `ReaderContainer` において `bookmarkConflict !== null` の間は：
    1. `router.blockBackNavigation?.()` を有効化し、Android OS バックキー（`AppBridge.addBackButtonListener`）およびブラウザ `popstate` による目次離脱をブロックする。
    2. `handlePopState` による自動 `flushBookmark()` 実行も抑止する（画面離脱させないため）。
    3. `ReaderPage` に `bookmarkConflict`, `onResolveBookmarkConflictMove`, `onResolveBookmarkConflictKeep` を渡し、オーバーレイ背後の操作を遮断するモーダルとして描画する。
- **Storybook / VRT 規約（`docs/guidelines/testing.md` 準拠）**:
  - `BookmarkConflictDialog.stories.tsx` で `isOpen: true`（例: `currentChapterIndex: 10, remoteChapterIndex: 15`）および `isResolving: true` のストーリーを定義して VRT（1280px / 375px）で中央モーダル表示とボタン視認性を検証する。
  - `isOpen: false`（`null` 返却）の非表示ストーリーには **`tags: ["skip-vrt"]`** を必ず付与する（ポータブルストーリー UT では 100% カバレッジのため検証し、VRT 0px スクリーンショットエラーを防止する）。

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 Cloud Sync / Router / App シェル単体テスト（Vitest）

- `src/features/cloud-sync/services/syncEngine.test.ts`:
  - `subscribePullCompleted`: `pullAndMerge()` 完了時に購読リスナーへ `{ pulled, mergedNovels }` が通知されること、unsubscribe 後は通知されないこと、リスナー内例外が発生しても他リスナーおよび `pullAndMerge()` が正常完了すること。
- `src/features/cloud-sync/hooks/useBackgroundAutoPull.test.ts`:
  - `document.visibilityState === "hidden"` から **5 分（300,000ms）以上** 経過して `"visible"` に復帰したとき、`cloudSyncBridge.getAuthState()` が `connected` なら `syncEngine.pullAndMerge()` が呼び出されること。
  - 5 分未満（例: 4 分 59 秒）の復帰では `pullAndMerge()` が呼ばれないこと。
  - 未連携（`unlinked`）時や `syncEngine` 例外スロー時にクラッシュせず安全に処理されること。
- `src/app/router.test.tsx` / `src/App.test.tsx`:
  - `blockBackNavigation()` 登録中（`isBackNavigationBlocked() === true`）は、`AppBridge` の OS バックキーリスナー発火時および `popstate` イベント発火時に画面遷移（`router.back()` / `currentPath` 変更）がブロックされ、解除後は通常通り戻れること。
  - `AppContent` マウント下で `SCR-02` や `SCR-03` 表示中に 5 分経過 `visibilitychange` 復帰を行うと自動 Pull が発火すること。

### 3.2 機能別 Hooks・UI コンポーネント単体テスト ＆ VRT（Vitest / Storybook / Playwright VRT）

- `src/features/bookshelf/hooks/useBookshelf.test.ts`:
  - 従来の `useBookshelf` 内 `visibilitychange` テストを `subscribePullCompleted` 連携テスト（`pulled: true` 通知で `reloadNovels()` が実行されること、`pulled: false` では不要リロードしないこと）へ整理・更新（アプリ全体の `visibilitychange` 5分検証は `useBackgroundAutoPull.test.ts` / `App.test.tsx` へ移管）。
- `src/features/novel-detail/hooks/useNovelDetail.test.ts`:
  - `syncEngine.subscribePullCompleted` で `{ pulled: true, mergedNovels: 1 }` が通知された際、`reloadDetail()` が自動実行され、`novel.bookmarkChapterIndex` や既読状態が最新化されること。
- `src/features/reader/components/BookmarkConflictDialog.stories.tsx` / `BookmarkConflictDialog.test.tsx`:
  - `isOpen: true` 時のタイトル・メッセージ（「第15話」「第10話」）・2 ボタン表示、クリック時の `onMoveToRemote` / `onKeepCurrent` 発火、背景（backdrop）クリックおよび `Escape` キーで閉じないこと、`isResolving: true` 時のボタン `disabled`、および `isOpen: false`（`tags: ["skip-vrt"]`）時の非描画（C0/C1/Functions 100%、VRT 1280px / 375px）。
- `src/features/reader/components/ReaderView.test.tsx`:
  - 初期マウント時の `restoreScrollPosition`（プログラム的スクロール位置復元）直後に `scroll` イベントが発火しても `onScrollProgressChange` が誤通知されないこと（ユーザー操作によるスクロールでは正常発火すること）。
- `src/features/reader/hooks/useReader.test.ts`:
  - **未操作離脱時 `flushBookmark` スキップ**: ロード完了後・ページ移動/スクロール変更なしで `flushBookmark()` を呼んだ場合、`novelRepository.updateBookmark` および `syncEngine.notifyChanged` が呼び出されないこと（※従来の無条件 `flushBookmark` テストを本新仕様に更新）。
  - **変更あり時 300ms デバウンス ＋ `hidden` 即時フラッシュ**: `updateScrollProgress` 呼び出し後 300ms 未満で `visibilityState === "hidden"` になった場合、直ちに `updateBookmark` が完了すること。300ms デバウンス完了後に `syncEngine.notifyChanged` が呼ばれ、その後に未操作で `flushBookmark()` を呼んでも重複書き込みされないこと。
  - **競合検知と解決**: Pull 完了通知（`subscribePullCompleted`）で DB の `bookmarkChapterIndex` が現在話と異なる（例: 10 → 15）場合に `bookmarkConflict = { currentChapterIndex: 10, remoteChapterIndex: 15 }` がセットされること。同一話の場合は `null` のまま。
  - `resolveBookmarkConflict("move")` で `bookmarkConflict` がクリアされ `goToChapter(15)` が実行されること。
  - `resolveBookmarkConflict("keep")` で `bookmarkConflict` がクリアされ、`novelRepository.updateBookmark(..., 10, scrollProgress)` と `syncEngine.notifyChanged()` が実行されること。
- `src/features/reader/components/ReaderPage.stories.tsx` / `ReaderPage.test.tsx`:
  - `bookmarkConflict` 非 null 時に `BookmarkConflictDialog` が描画され、移動・維持ボタンからコールバックが伝播すること（VRT スナップショット含む）。
- `src/features/reader/components/ReaderContainer.test.tsx`:
  - 未操作状態での「← 目次」・下部タブ・`popstate`・アンマウント時に `updateBookmark` が呼ばれないこと（従来の無条件 `flushBookmark` テストを「ページ操作後に離脱すると保存される」「未操作離脱では保存されない」の 2 観点へ更新）。
  - `bookmarkConflict` 表示中は `router.blockBackNavigation` が有効化され、`popstate` や背景クリックで離脱しないこと。「第15話へ移動する」選択後に `onNavigateChapter` で URL が第15話へ遷移すること。「第10話のまま読む」選択後にダイアログが閉じ第10話のまま維持されること。

### 3.3 Playwright システム結合テスト（`SCN-05`: `test/it/scenarios/scn05-cloud-sync.spec.ts`）

- **シナリオ拡張観点**:
  1. **リーダー表示のまま画面ロック・5分後復帰時の自動 Pull ＆競合確認ダイアログ（「第15話へ移動する」/「第10話のまま読む」）**:
     - リーダー画面（`SCR-03`）で第1話を表示中に、Google Drive モック上のリモートデータで別端末が第3話（より新しい `lastReadAt`）まで読み進めた状態を用意し、`document.visibilityState` を `"hidden"` → 5 分経過モック → `"visible"` へ切り替える。
     - 自動 Pull 完了後に画面中央へ `bookmark-conflict-dialog` が表示され、背景クリック・`Escape` キー・ブラウザ戻る（`popstate`）で閉じないことを確認する。
     - 「第3話へ移動する」（`bookmark-conflict-move-button`）押下でリーダー表示が第3話へ切り替わることを確認する。
     - 別ケースとして「第1話のまま読む」（`bookmark-conflict-keep-button`）押下時は第1話のまま表示が維持され、リモート JSON のしおりが第1話・新 `lastReadAt` へ更新されることを確認する。
  2. **画面ロック時即時フラッシュ ＆ 未操作離脱時の他端末しおり上書き防止**:
     - リーダー画面（第1話）で進捗操作を行わずにロック復帰後（あるいは Pull による第3話更新後に操作せず）、「← 目次」ボタンまたはタブ遷移で離脱しても、他端末の新しい第3話しおりが第1話で上書きされないことを確認する。
     - ページめくり操作直後（300ms 以内）に `visibilityState === "hidden"` になった場合は即時保存されることを確認する。
  3. **作品詳細画面（`SCR-02`）表示中の画面ロック・5分後復帰による自動 Pull 反映**:
     - `SCR-02` を開いた状態でリモートしおり・既読を更新し、5分経過 `visibilitychange` 復帰後にリロードなしでしおりバッジ・既読バッジ・ボタン文言（「続きから読む（第3話）」）が最新状態へ自動更新されることを確認する。

---

## 4. 実装 Sub-issue 分割計画

1 回の PR の変更量をレビューしやすい適正サイズ（目安 200〜400 行）に抑え、機能単位・レイヤー単位で確実に検証するため、以下の 3 つの Sub-issue へ分割して進めます。

1. **Sub-issue ①（MK1: Cloud Sync / Router 基盤）**:
   - `SyncEngine.subscribePullCompleted` 追加、アプリ共通 `useBackgroundAutoPull`（5分 `visibilitychange`）実装と `src/App.tsx` / `useBookshelf.ts` 統合、`RouterContext` の `blockBackNavigation` / `App.tsx` の OS バックキー遮断、および `useNovelDetail` の Pull 完了時自動リロード対応（UT ＋ 100% カバレッジ。Gate 1〜6 通過後に AI 自律マージ）。
2. **Sub-issue ②（MK2: リーダー保護・競合確認ダイアログ UI / Hook）**:
   - `BookmarkConflictDialog`（Component + Story + UT + 1280px/375px VRT）、`ReaderView` のスクロール復元ガード、`useReader` の `hasPendingBookmarkRef`・`hidden` 即時フラッシュ・未操作 `flushBookmark` 抑止・競合検知/解決ロジック、`ReaderPage` / `ReaderContainer` 統合（UT / Story / VRT ＋ 100% カバレッジ。Gate 1〜6 通過後に AI 自律マージ）。
3. **Sub-issue ③（IT: `SCN-05` 結合テスト拡充 ＆ 差分仕様アーカイブ）**:
   - `test/it/scenarios/scn05-cloud-sync.spec.ts` への本機能 E2E シナリオ追加・全シナリオ PASS 確認、および本差分仕様書の `docs/specs/changes/archive/` 移動・正本 `Approved` 化（人間マージで親 Issue #342 クローズ）。

---

## 5. 申し送り事項（Handover Items: `HO-xx`）・実機検証計画

- **Android 実機検証の実施タイミング判断（`docs/guidelines/workflow.md §2.2` に基づく判定）**:
  - **判定**: **B. Milestone 最終レビュー後に一括で実機検証を実施（完了ゲート: `Milestone v1.1 完了前` / Issue #345）**
  - **理由**:
    1. Android ネイティブ Java プラグイン（`AppBridge` の `CapacitorAppBridge` / `CloudSyncPlugin.java`）や OS 権限・ビルド設定の変更を伴わず、既存の `document.visibilitychange` API および `AppBridge.addBackButtonListener` 上の React / TypeScript 状態制御・モーダル UI 拡張として完結する。
    2. 5分休止タイマー・`visibilitychange`・モーダル誤操作ガード・未操作離脱保護の主要ロジックと DOM 挙動は、Vitest 単体テスト（100% カバレッジ）、Storybook VRT（1280px/375px）、および Playwright 実ブラウザ E2E（`SCN-05`）で高精度に自動検証できる。
    3. Android 実機（WebView）では、スリープ／画面ロック復帰時の `visibilitychange` 発火とハードウェア戻るボタンの抑止挙動を中心とする **2 項目のスモーク確認** に収まるため、Milestone `v1.1` 最終レビュー時の実機一括検証（`HO-38`）で検証する方が開発効率・検証精度ともに高い。
- **登録する申し送り事項**:
  - **`HO-38`**: Android 実機（WebView）におけるリーダー／作品詳細表示のまま画面ロック・5分以上経過後復帰時のクラウド同期自動 Pull、しおり競合ダイアログ表示中のハードウェア戻るボタン抑止、および未操作離脱時しおり保持のスモーク確認（完了ゲート: `Milestone v1.1 完了前` / Issue #345）。
