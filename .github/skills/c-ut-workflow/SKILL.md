---
name: c-ut-workflow
description: "Use when implementing production code and unit/VRT tests in MK tasks, orchestrating worker subagents (self) sequentially, and enforcing the 3-layer testing rules in docs/guidelines/testing.md."
---

# MK（C・UT / VRT）実行・サブエージェント委託手順

このスキルは、MK（実装・単体テスト・Storybook VRT）フェーズにおける **AI エージェントの実行手順およびサブエージェント（`self`）への直列委託（オーケストレーション）手順** を定めます。

3層アーキテクチャの責務境界、TDD コミット規約、1対1 Story/UT 原則、親子コンポーネント分離原則、カバレッジ基準（C0/C1/Functions 100%）、縦書き/ルビ VRT、およびバグ記録・原因 `D` 設計同期ルールの正本（SSOT）は **[docs/guidelines/testing.md](../../../docs/guidelines/testing.md)** です。作業前に必ず正本を読了してください。

---

## 1. オーケストレーター（親）とワーカー（`self`）の役割分担

MK 作業はファイル編集数やテスト・VRT 実行ログが多く、メインセッションのコンテキスト枯渇（Compaction による手順抜け）を招きやすいため、以下の役割分担を徹底します。

- **メインエージェント（Orchestrator）**:
  1. 対象 Issue の完了条件と `docs/specs/` の承認済み設計書を確認する。
  2. 作業単位（①Parser/Storage/Bridge ロジック層、②UI 子コンポーネント層、③Page 結合層など）ごとに汎用サブエージェント（`self`）を **直列（1つずつ順番）** に起動して TDD 実装を委託する（※テスト干渉・Git ロック競合・VRT ポート競合を防ぐため並列起動しない）。
  3. ワーカー完了後、ブランチを push して PR を作成し、[git-workflow スキル](../git-workflow/SKILL.md) に従って GitHub Actions 確認と `pr-reviewer` による独立レビュー・スレッド収束を管理する。
- **ワーカーサブエージェント（`self`）**:
  1. [docs/guidelines/testing.md](../../../docs/guidelines/testing.md) と対象設計書（`docs/specs/`）を読む。
  2. 担当範囲について TDD（Red → Green → Refactor）を実行し、各ステップで個別にコミットを刻む。
  3. 品質チェック一式を実行し、検出した不備や申し送り事項を記録して親エージェントに完了報告（コミット SHA 一覧・テスト/カバレッジ結果・不備記録有無）を返す。

### ワーカーサブエージェント（`self`）起動時の指示プロンプトひな形

```text
対象 Issue #XX のうち、[担当モジュール/コンポーネント名] の TDD 実装および単体テスト・VRT 作成を行ってください。

1. 必読正本:
   - `docs/guidelines/testing.md`（TDDコミット規約、3層責務境界、1対1 Story/UT、親子分離、C0/C1 100%、VRT、原因D設計同期、Worktree環境変数・DIモック分離規律）
   - `docs/specs/...`（対象の設計正本・受け入れ条件 AC-xx）
2. 作業手順:
   - Red（失敗確認） → Green（最小実装） → Refactor の各ステップで個別にコミット（英語 type + 日本語要約）を刻むこと。
   - `.tsx` を作成・変更する場合は、同階層に `.stories.tsx` と `.test.tsx`（`composeStories` 全件実行＋分岐補完）を 1対1 で作成し、親のテストで子のバリエーションを相乗りしないこと。
   - 新規設定カラム・DB カラム追加時は、DDL（`schema.ts` ＋ 既存 DB 復元マイグレーション）→ 型定義（`types.ts`）→ Repository → Hook / Container → Page → View → Storybook / UT / IT の全層でプロップス・コールバック・マイグレーションが途切れず伝播しているか確認すること。
   - Green 以降や検証中に不備を見つけた場合は `docs/quality/bug-and-handover-log.md` に記録し、原因分類 `D`（設計不備）の場合は必ず `docs/specs/` も同時修正すること。
3. 完了前検証:
   - `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:coverage`（C0/C1/Functions 100%）を実行し PASS を確認すること。
   - `.env.local` の有無に関わらずテスト・ビルドが 100% 決定論的に PASS することを確認すること（モック DI 徹底）。
   - UI/Story 変更時は `npm run test:vrt:update` および `npm run test:vrt`（1280px / 375px）を実行し PASS を確認すること。
4. 報告内容:
   - 作成したコミット SHA 一覧、カバレッジ・VRT 検証結果、記録した不備（L/S/D/B/A）と申し送り（HO-xx）を報告してください（※push や PR 作成は親が行います）。
```

---

## 2. ワーカー実行時の TDD・3層チェックリスト

ワーカー（または小規模変更を直接行うエージェント）は、[docs/guidelines/testing.md](../../../docs/guidelines/testing.md) の各規律を以下の手順で実行します。

### Step 1: Red（テスト・Story 先行作成と失敗確認）

- **Parser Layer**: `__fixtures__/*.html` にテスト用 HTML を用意し（現行サイトの初期表示 DOM 件数制限やトグル非表示章、`__NEXT_DATA__` 等の埋め込み JSON データ構造を事前調査し、7話超・複数章構成を含むフィクスチャを用意すること）、`*.test.ts` で抽出期待値（タイトル、目次、`<ruby>`・傍点保持、サニタイズ、異常系）を日本語の `it("... (AC-xx)")` で記述する。
- **Storage Layer**:
  - `resetTestDb()` で初期化するインメモリ DB を用い、Repository の CRUD・境界値テストを `*.test.ts` に記述する。
  - **新規設定カラム・DB カラム追加時の全層伝播チェック（原因 `D` 再発防止）**: DDL（`schema.ts` ＋ `ServiceProvider` での既存 DB バイナリ復元時マイグレーション `initializeDatabaseSchema`）→ 型定義（`types.ts`）→ Repository → Hook / Container → Page → View → Storybook / UT / IT の全層でプロップス・コールバック・マイグレーションが途切れず伝播しているか確認すること。
- **Viewer & Bridge Layer**:
  - `*.stories.tsx` に表示バリエーション（縦書き `vertical-rl`、横書き、ルビ・傍点、各カラーテーマ、Loading/Error/Empty、操作 `play` 関数）を定義する。
  - スクロール・Overflow を伴う表示コンポーネント（特に親 `horizontal-tb` 内で `writing-mode: vertical-rl` となる直交フロー要素）では、`w-full max-w-full` 等の幅制約を明示するとともに、画面外にはみ出す長文データを含めた Story（1280px / 375px 双方で Overflow するケース）を必須とし、VRT と実ブラウザ IT（負の `scrollLeft` 検証）の双方でスクロール可能性を保証する。
  - 非同期永続化を伴う設定やフォームでは、保存失敗時の状態ロールバックおよびエラー通知（`role="alert"`）の Story / UT を必須とする。
  - ルーティング・ナビゲーション機能では、同一ルート再タップ時の重複履歴ガード（no-op 制御）を考慮する。
  - **Android ネイティブプラグイン ＆ 幾何学的 UI タッチゾーン実装時の検証規律（原因 `D` 再発防止）**:
    - Capacitor ネイティブプラグイン（Java）では `startActivityForResult` 等の非推奨/非互換シグネチャを避け `ActivityResultContracts.StartIntentSenderForResult` ＋ `saveCall`/`getSavedCall`/`freeSavedCall` を使用し、401 リトライ時は `clearToken` でローカルキャッシュを破棄してから再取得すること。また `ci.yml` の `android-compile` ジョブおよび `scripts/android-build-config.test.ts` で検証すること。
    - フルスクリーン UI の複数タッチゾーン（左右端ページめくり領域と最下部オーバーレイ起動領域など）は幾何学的に排他配置（例: `left-[20%] right-[20%]`）とし、境界座標タップの単体テストを作成すること。
  - **React Hooks の非同期タスク直列化・Abort ガード・参照安定性（原因 `A`/`S` 再発防止）**:
    - エピソード遷移や連続操作で再スケジュールされる非同期処理（先読み `startPrefetch` 等）は、先行 Promise の完了待機（`activePrefetchPromiseRef`）による直列化、`AbortSignal` の下位関数（`fetchAndSaveChapterBody`）への伝播、および HTTP 完了直後・DB 保存直前の `if (signal?.aborted) return` / マウント状態ガードを徹底すること。
  - **モーダルダイアログ・非同期処理時のアクセシビリティ・堅牢性規律（原因 `L` 再発防止）**:
    - 削除・送信等の非同期処理中（`isClearing` / `isSubmitting`）は、Escape キーおよびダイアログ外周（backdrop）クリックによるダイアログ即時閉鎖を確実にガードすること。
    - ダイアログ内の非同期コールバック（`onConfirm` 等）実行は `try/finally` で囲み、コールバックが例外を投げた場合でも Unhandled Promise Rejection を防止しつつダイアログ閉鎖などの後始末を確実に完遂すること。
    - 非同期処理を扱うカスタム Hook では、`isMountedRef` によるアンマウント後の State 更新防止ガードを設けること。
  - **モバイル WebView におけるジェスチャーイベントの Pointer / Touch 分離規律（原因 `L` 再発防止）**:
    - ネイティブスクロールが共存するモード（実効 `scroll` モード等）では、WebView の仕様によりスクロール開始直後に `pointercancel` が発火する。
    - PointerEvent 用の開始座標（`pointerStartRef`）と TouchEvent 用の開始座標（`touchStartRef`）を別個の ref として分離管理し、`pointercancel` 発生時に Touch 側の座標情報を誤消去しないこと（端部到達後 2 段階スワイプ等のジェスチャー不発を防止）。
  - **アニメーション・境界タイマーの `chapterIndex` / `isPaged` 切替時クリーンアップと操作開始時スクロール境界評価・マルチパス計測時の初期位置復元維持（原因 `A`/`D` 再発防止: `R1-18`, `R1-19`, `R1-26`）**:
    - ページ送りアニメーションタイマー（200ms 等）やエピソード境界ヒントタイマーを持つ Hook では、`chapterIndex`（話数移動）や `isPaged`（モード切替）が変化した際に進行中のタイマー・保留ページ参照・境界フラグ（`false`）を即座にクリアし、旧エピソードの遅延タイマー発火によるページ位置上書き競合を防止すること。
    - 連続スクロールモードの端到達フラグ（`reachedStartRef` / `reachedEndRef`）は、`syncScrollBoundaryState()` 等により各操作開始時（ポインター・タッチ・ホイール・音量キー）に実 DOM 座標および 1 画面短文（`maxScroll <= 0`）時の両端到達判定から同期評価し、`scroll` イベント発火前の初期状態でも端 2 段階遷移を確実に機能させること。
    - 初回マウント・コンテナ寸法反映・`requestAnimationFrame`・`document.fonts.ready` 等で複数回 `setTotalPages` が通知される組版 UI では、単発フラグで初期復元を打ち切らず、ユーザーが明示的にページ操作（`goToPage`）を行うまでの間は `initialScrollProgress` から現在ページを再算出し続けること（中間ページからの画面再遷移時の最終ページ化け防止）。
  - **ネイティブ Bridge イベント購読順序と Promise `.catch()` 保護・`static` 状態解放（原因 `A`/`S`/`L` 再発防止: `R1-03`, `R1-04`, `R1-08`, `R1-12`）**:
    - Capacitor Java プラグインで `static` フラグを保持する場合は、`load()` および `handleOnDestroy()` で必ず `false` にリセットし、`scripts/android-build-config.test.ts` に契約テストを追加すること。
    - Web 側でネイティブ Bridge を有効化する際は、`add*Listener` を先行登録してから `set*Enabled(true).catch(() => {})` を呼び出し、クリーンアップ時も `.catch(() => {})` で Unhandled Rejection を防止すること。
  - **Container / Page テストにおける `vi.spyOn` / `vi.mock` を用いた親子分離と実時間依存（固定過去日付）の排除（原因 `A`/`B` 再発防止: `R1-01`, `R1-11`, `R1-23`）**:
    - Container / Page の単体テストでは直下の子コンポーネントへの Props・コールバック受け渡しを `vi.spyOn`（または `vi.mock`）で検証し、子・孫の内部 DOM 重複アサートや CI 高負荷時の非同期競合を排除すること。
    - `Date.now()` と比較する保持期限（Tombstone GC・TTL 等）のテストでは固定過去日付をハードコードせず、必ず `Date.now()` からの相対日時計算（`new Date(baseNow - days * 86_400_000).toISOString()` 等）または `vi.setSystemTime` を使用すること。
  - **`useReader` における非同期参照・同期反映と探索世代ガード・結合テスト実体アサーション（原因 `A`/`L`/`S` 再発防止: `v0.7 Kaizen`）**:
    - `useReader` の `loadInitialData` および `fetchNovelFromUrl` では、`setNovel` と同時に `novelRef.current` および `currentChapterIndexRef.current` を同期的（インライン）に更新し、コールバックでのしおり保存スキップを防ぐため `novelRef.current ?? novel` フォールバックを行うこと。
    - 非同期探索 Hook（`useNovelSearch`, `useNovelRanking`）では `requestIdRef`（世代カウンタ）を導入して旧通信の遅延解決結果による一覧汚染を防止し、通信中のセレクター・ピル操作を UI レベルで非活性化（`isInteractingDisabled`）すること。
    - 結合テスト（IT）では条件分岐（`if (await element.isVisible())`）による暗黙スキップや `waitForTimeout` を禁止し、`toHaveAttribute("aria-pressed", "true")` や `toHaveValue(...)` で選択状態の反映を決定論的にアサートすること。
  - **クラウド同期 LWW タイムスタンプ保護・探索確定クエリ＆複合パラメータ検証・狭幅ヘッダー＆トグル寸法不変性（原因 `D`/`L`/`A`/`S` 再発防止: `v0.8 Kaizen`）**:
    - `novels.updated_at`（および React State の `novel.updatedAt`）はユーザーの明示的な作品設定変更時のみ更新し、定常処理（目次更新・しおり・本文キャッシュ・再集計・`startBatchCache` ループ）で更新しないこと。また `SyncEngine.mergeNewNovel` 初回 Pull 時は `createdAt` / `updatedAt` の双方を復元し、IT（`SCN-03`, `SCN-05`）では `T1 < T2 < now` タイムラインで定常処理後の LWW 勝敗を検証すること。
    - 外部サイト検索フィルタ実装時は複合クエリパラメータ（カクヨム短編の `serial_status=completed&total_character_count_range=-20000` 等）を実サイト仕様で確認し、`useNovelSearch.loadMore` は `committedQueryRef` の確定条件を使用、IT（`SCN-02`）では `expect.poll` で送信 URL クエリパラメータ実体を全種別アサートすること。
    - 375px モバイル狭幅ヘッダーの補助フィルタボタンはアイコンのみ（`★`/`☆` ＋ `aria-label`）＋ `shrink-0 whitespace-nowrap` とし、トグルボタンは ON/OFF 双方で常時 1px `border` と固定文字数ラベル（`★ お気に入り` / `☆ お気に入り`）を維持して 2px 高さ変化や横幅ちらつきを防止すること。また折りたたみパネルの `aria-controls` は `useId()` を用い展開時のみ出力し、非同期トグル操作には作品 ID 単位（`Set<string>` ref）または操作単位の連打排他ガードを設けること。
  - **WebView DOM インポート・永続キュー一括キャッシュ・Android ネイティブ安全性・結合テスト状態収束（原因 `L`/`D`/`S` 再発防止: `v0.9 Kaizen`）**:
    - `useWebViewImport` では `canonicalUrl` 完全一致検証と話数解決の安全ガード（別話上書き遮断）を設け、`isMountedRef` による画面離脱時の非同期 State 更新遮断および Bridge クリーンアップ（`close()`）呼び出し、`httpClient` 未渡下時の non-null アサーション排除と防御的フォールバックを徹底すること。
    - Android ネイティブの WebView 拡張プラグイン（`WebViewDomPlugin.java`）では `setAllowFileAccess(false)`, `setAllowContentAccess(false)`、大文字小文字非依存スキーム判定、Dialog 閉鎖時/破棄時の `destroy()` 解放、および `domCaptured` リスナーの確実なバインドを行うこと。
    - 一括キャッシュ進行中のヘッダー表示（`NovelDetailHeader`）には `[失敗 N話]` を警告色（アンバー）でリアルタイム表示し、`startBatchCache` 開始時に前回の失敗状態（`setFailedCacheCount(0)`, `setFailedChapterIndexes([])`）を確実にリセットすること。
    - 非同期永続化（一括キャッシュ、再試行、キュー更新）の結合テスト（IT）では固定待機 `waitForTimeout` を排除し、`expect.poll` による状態駆動アサーションに一本化すること。
    - 共通子コンポーネント（`BottomTabBar` 等）を持つ親コンポーネントのテストでは、隠し要素による検証を排除し、直下の子への Props 配線検証のみを行う親子分離を徹底すること。
  - **Android ネイティブ REST メソッド・インメモリ DB 直列化・親子分離徹底・CI 環境耐性（原因 `L`/`D`/`S` 再発防止: `v1.0 Kaizen`）**:
    - Android ネイティブの HTTP 呼び出し（`CloudSyncPlugin.java`）で `PATCH` メソッドを用いる際は、`POST` ＋ `X-HTTP-Method-Override: PATCH` ヘッダー方式を徹底し、`scripts/android-build-config.test.ts` で契約検証を行うこと。
    - `inMemoryDb.ts` においても Promise チェーン排他 mutex（`opMutex`）およびトランザクション専用 `txAdapter` を導入し、並行クエリ割り込みおよびネストトランザクションを確実に遮断すること。
    - Container / Page レベルの単体テストにおいて、直下の子コンポーネントおよび孫コンポーネントの内部 DOM を直接探索・操作せず、直下の子に対する `vi.spyOn` 経由での Props / コールバック配線検証に統一して親子分離を徹底すること。
    - CI ランナー環境における APT パッケージ取得では、Azure ネイティブミラー維持、タイムアウト緩和（60秒）、再試行回数増加（5回）、`--fix-missing` オプションを追加してビルドの堅牢性を確保すること。
    - 新規テスト追加時は正本仕様書のフロントマター `related_tests` および構成図に即時登録し、バグ台帳の原因 `D` には設計書同期コミット SHA を 1 対 1 で明記すること。
  - `*.test.tsx` で `composeStories` による全 Story 実行＋内部ロジック補完テストを記述する。
- **失敗確認とコミット**: `npx vitest run <対象テスト>` を実行し、未実装により期待通り失敗することを確認して `test(<scope>): ...（Red）` をコミットする。

### Step 2: Green（最小実装）

- テストをパスさせる最小限の実装コードを作成する（YAGNI 原則、[ponytail スキル](../ponytail/SKILL.md) 参照）。
- 対象テストを実行して全件 PASS を確認し、`feat(<scope>): ...（Green）`（または `fix`）をコミットする。

### Step 3: Refactor（構造・型安全性の改善）

- テストが Green の状態を維持したまま、重複排除・型定義の厳密化・可読性向上を行い、再度テスト PASS を確認して `refactor(<scope>): ...（Refactor）` をコミットする。
- ※Green / Refactor 中にテストケース漏れや期待値誤りに気づいた場合は、プロダクションコードとテストを同時に書き換えず、一度テストを追加・修正して Red を確認してから実装を直すこと。

### Step 4: 局所検証・カバレッジ・VRT・不備記録

1. `npm run test:coverage` を実行し、変更・追加した全ファイルの **C0 / C1 / Functions カバレッジが 100%** であることを確認する（不正な `v8 ignore` は使用禁止）。
2. `npm run typecheck`, `npm run lint`, `npm run format:check` を実行し PASS を確認する。
3. Story を追加・変更した場合は `npm run test:vrt:update` → `npm run test:vrt` を実行し、1280px / 375px のスナップショットが正しく生成・検証されることを確認する（Story を削除・置換した場合は旧スナップショット PNG を削除し、孤児スナップショット検知ガードテストを通過させること）。
4. 作業中に検出した不備や後続への申し送り（`HO-xx`）を [docs/quality/bug-and-handover-log.md](../../../docs/quality/bug-and-handover-log.md) に記録する（原因 `D` は設計書も同時修正）。

---

## 3. 標準コマンド一覧（Phase 3 で `package.json` 整備後に有効化）

| コマンド                                       | 用途                                                        |
| :--------------------------------------------- | :---------------------------------------------------------- |
| `npm run typecheck`                            | TypeScript 型検査                                           |
| `npm run lint`                                 | ESLint 静的解析                                             |
| `npm run format:check` / `npm run format`      | Prettier 書式検査 / 自動整形                                |
| `npm run test:unit`                            | Vitest 単体テスト実行                                       |
| `npm run test:coverage`                        | Vitest カバレッジ計測（C0/C1/Functions 100% 検証）          |
| `npm run test:vrt` / `npm run test:vrt:update` | Storybook VRT 実行 / スナップショット更新（1280px / 375px） |
| `npm run test:it`                              | Playwright 実ブラウザ結合テスト（`SCN-01`〜）実行           |
| `npm run build && npx cap sync android`        | Web 本番ビルド ＆ Capacitor Android プロジェクトへの同期    |
