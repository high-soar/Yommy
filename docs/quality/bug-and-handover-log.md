---
type: quality-log
title: 品質記録・バグ記録票 ＆ 申し送り管理シート（Bug & Handover Log）
description: 製品コードと支援成果物を分離したバグ記録（原因5分類 L/S/D/B/A）および後続タスクへの申し送り事項（HO-xx）を追跡する正本シート。
status: Approved
updated: "2026-10-26"
tags: [quality, bug-log, handover, dre, kaizen]
related_specs:
  - docs/index.md
  - docs/guidelines/workflow.md
  - docs/guidelines/testing.md
related_tests: []
---

# 品質記録・バグ記録票 ＆ 申し送り管理シート（Bug & Handover Log）

本ドキュメントは、Yommy の開発プロセス（TDD 実装、単体テスト、VRT、結合テスト、独立 AI レビュー、節目横断レビュー）において検出された不備の記録、および後続タスクへの申し送り事項（Handover Items）を追跡管理する正本シートです。

---

## 1. バグ記録の記入ルール

1. **記録対象と除外基準**:
   - **記録対象**: 実装後のテスト失敗、AI レビュー（`pr-reviewer` / `phase-final-reviewer`）での指摘事項、VRT 差分検知、IT（結合テスト）や実機確認で発覚した仕様違反・バグ・設計不整合を 1 件として記録します。
   - **除外対象**: TDD の初回 Red ステップ（未実装機能に対する意図的なテスト失敗）や、作業中の単純なタイポ・フォーマッタ自動整形は除外します。
2. **成果物区分の厳格分離**:
   - **`製品コード`**: `src/` 配下の本番アプリケーションコードの不備（製品バグ密度および欠陥除去率 DRE の分子として集計）。
   - **`支援成果物`**: テストコード（`*.test.*`, `test/it/`）、Storybook（`*.stories.tsx`）、HTML フィクスチャ、モック、設計ドキュメント単体の記述ミス、CI/設定ファイルの不備。
3. **原因分類コード（5分類）**:
   - **`L` (Logic)**: 条件分岐・アルゴリズム・DOM セレクタ抽出等のロジック誤り
   - **`S` (State)**: React State・キャッシュ状態・しおり位置等の状態遷移誤り
   - **`D` (Design)**: 仕様・設計書（`docs/specs/`）の誤認、インターフェース契約や DB スキーマとの不一致、設計考慮漏れ
   - **`B` (Boundary)**: 空文字、0件、長大テキスト、不正 HTML、特殊文字等の境界値・エッジケース考慮漏れ
   - **`A` (Async)**: 非同期競合（Race Condition）、レートリミット・キュー制御、AbortController 未連携、二重実行防止漏れ
4. **【重要】原因分類 `D` の設計書即時同期義務**:
   - 原因が **`D`** の場合、**コードのみを修正して設計書を放置することは厳禁**です。必ず対応する `docs/specs/` の設計書（App 全体正本および進行中の差分仕様）も同時修正し、下表の是正内容欄に **コード修正コミットと設計書同期コミットの双方** を記録してください。

---

## 2. バグ記録一覧（Bug Log）

| No. | Issue / PR | 検出フェーズ・手段                   | 成果物区分 (`製品コード` / `支援成果物`) | 対象箇所                                                            | 原因 (`L`/`S`/`D`/`B`/`A`) | 不備の概要と是正内容（原因 `D` は設計書同期コミット併記）                                                                                                                                                                                                                |
| :-: | :--------: | :----------------------------------- | :--------------------------------------: | :------------------------------------------------------------------ | :------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  |     #3     | OKF検証 (`npm run lint:okf`)         |                支援成果物                | `.github/skills/sdd/scripts/validate-okf.mjs`                       |            `L`             | `parseFrontmatter` においてクォート内の `#` がコメントとして一律除去され `status: "Review (#N)"` が不正ステータスと判定されていた不備を、クォート認識付きコメント除去関数 `stripYamlComment` を導入して是正。                                                            |
|  2  |     #3     | 単体テスト (`npm run test:coverage`) |                支援成果物                | `vite.config.ts`                                                    |            `D`             | `docs/guidelines/testing.md` の除外規定が `vite.config.ts` の `coverage.exclude` に未反映でカバレッジ閾値エラーとなっていた不備。設定コミット `cdd4cd4` にて除外設定し、是正PRにて `testing.md` 側にも `src/main.tsx`, `src/test/**` を追記して正本側も完全同期。        |
|  3  |     #4     | TDD Green / 結合 (`npm run test`)    |                製品コード                | `src/storage/adapter/inMemoryDb.ts`                                 |            `S`             | `InMemoryDatabaseAdapter` の `execute` ごとに呼ばれる `onUpdate`（export）がトランザクション中に実行され、`sql.js` のトランザクションが不正終了していた不備。是正コミット `c6c6464` にて `inTransaction` フラグを導入しコミット時のみ export するよう是正。              |
|  4  |     #4     | TypeScript ビルド (`npm run build`)  |                製品コード                | `src/app/ServiceProvider.tsx`                                       |            `L`             | `createDefaultMockHttpClient` 内でモックレスポンスの `HttpResponse.headers` プロパティが未定義で型エラーとなっていた不備。是正コミット `43de01f` にて `headers: {}` を補完（正本 `architecture.md` の型契約に準拠）。正本修正は不要。                                    |
|  5  |     #4     | 結合テスト (`npm run test:it`)       |                支援成果物                | `test/it/scenarios/scn01-poc-vertical-reader.spec.ts`               |            `L`             | カクヨム第1話タイトル期待値を「第1話 見知らぬ空」と誤認して結合テストが失敗した不備。是正コミット `cdfa11d` にて実際のフィクスチャ定義「プロローグ：目覚め」に合わせてテスト期待値を是正。正本修正は不要。                                                               |
|  6  |  #1 / R1   | 節目横断レビュー (R1-01)             |                製品コード                | `src/app/ServiceProvider.tsx`                                       |            `D`             | 本番 DI が Mock/InMemory に固定され Capacitor 実機配線が未接続であった不備。`Capacitor.isNativePlatform()` によるネイティブ DI 自動配線と `src/storage/schema.ts` 共通 DDL 初期化を実装。設計書 `docs/specs/architecture.md` も同時更新。                                |
|  7  |  #1 / R1   | 節目横断レビュー (R1-02)             |                製品コード                | `src/storage/adapter/capacitorSqlite.ts`                            |            `L`             | `CapacitorSqliteAdapter` の `run`/`execute` で `transaction: false` が未指定のためネイティブ SQLite で入れ子トランザクション例外が発生する潜在不備。明示的に `false` を指定して是正。                                                                                    |
|  8  |  #1 / R1   | 節目横断レビュー (R1-03)             |                支援成果物                | `docs/quality/bug-and-handover-log.md`                              |            `D`             | 原因 `D` 登録の No. 2, 4, 5 にコミット SHA が未記載かつ原因分類の精緻化が不足していた不備。コミット SHA を補記し、No. 4, 5 を正本準拠の `L` へ精緻化して是正。                                                                                                           |
|  9  |  #1 / R1   | 節目横断レビュー (R1-04)             |                支援成果物                | `docs/quality/bug-and-handover-log.md`                              |            `D`             | Phase 4（Milestone `v0.1`）および実機検証へ向けた未解決申し送り事項の起票漏れ。`HO-03`（実機確認）、`HO-04`（ルーティング/本棚）、`HO-05`（組版設定/しおり）を起票して是正。                                                                                             |
| 10  |  #1 / R1   | 節目横断レビュー (R1-05)             |                製品コード                | `src/features/reader/components/PocReaderContainer.tsx`             |            `L`             | 作品取得処理において通信前にパーサー解決と `normalizeWorkUrl` 正規化を行っておらず、未対応URLでも無駄な通信が発生していた不備。通信前にパーサー解決・正規化を行う順序に是正。                                                                                            |
| 11  |  #1 / R1   | 節目横断レビュー (R1-06)             |                支援成果物                | `test/it/scenarios/scn01-poc-vertical-reader.spec.ts`               |            `L`             | `SCN-01` 結合テストにおいて傍点（`<em class="bouten">`）の可視性・テキスト検証アサーションが欠落していた不備。アサーションを追加して結合レベルでの回帰保証を確立。                                                                                                       |
| 12  |  #1 / R1   | 節目横断レビュー (R1-07)             |                支援成果物                | `docs/specs/features/reader-view.md`                                |            `D`             | 小説リーダー画面の受入条件、`SCN-01` シナリオ、および localStorage 永続化仕様の正本が未策定であった不備。正本 `docs/specs/features/reader-view.md` を新規策定して同期。                                                                                                  |
| 13  |  #1 / R1   | 節目横断レビュー (R1-08)             |                製品コード                | `src/app/ServiceProvider.tsx`                                       |            `B`             | `ServiceProvider.init` に try/catch がなく初期化失敗時にハングする不備。例外ハンドリング（`error` 状態）を追加し、関数型 fallback および直和型による型健全性を確保して是正。                                                                                             |
| 14  |  #1 / R1   | 節目横断レビュー (R1-09)             |                製品コード                | `src/parsers/kakuyomu/KakuyomuParser.ts`                            |            `L`             | カンマ区切り CSS セレクタによりフォールバック要素が優先順位ではなく文書順で評価されていた不備。優先順位セレクタ配列の順次探索ループ構造（`queryFirst`）に是正。                                                                                                          |
| 15  |  #1 / R1   | 節目横断レビュー (R1-10)             |                製品コード                | `src/storage/repositories/novelRepository.ts`                       |            `D`             | 目次 upsert キーが `chapter_index` のためエピソード挿入時に本文キャッシュが別話へ誤移動する不備。一意キーを `(novel_id, remote_chapter_id)` に変更し、DB正本 `docs/specs/db-schema.md` と同時同期。                                                                      |
| 16  |  #1 / R1   | 節目横断レビュー (R1-11)             |                製品コード                | `src/app/ServiceProvider.tsx`                                       |            `B`             | localStorage バックアップが容量超過（QuotaExceededError）時に黙って失敗する不備。警告ログ出力とブール値返却を整備し、正本に Phase 4 ネイティブ SQLite 移行での解消方針を明記。                                                                                           |
| 17  |  #1 / R1   | 節目横断レビュー (R1-12)             |                支援成果物                | `docs/guidelines/testing.md`                                        |            `D`             | `vite.config.ts` で除外されている `src/main.tsx`, `src/test/**` がテスト規約正本の除外許可リストに未記載であった不備。`docs/guidelines/testing.md` に追記して同期。                                                                                                      |
| 18  |  #1 / R1   | 節目横断レビュー (R1-13)             |                支援成果物                | `src/app/ServiceProvider.test.tsx`                                  |            `L`             | `ServiceProvider` UT 2件において非同期初期化完了後の `isReady: true` 遷移がアサートされていなかった不備。`waitFor` による状態遷移アサーションを追加して是正。                                                                                                            |
| 19  |  #1 / R1   | 節目横断レビュー (R1-14)             |                支援成果物                | `docs/specs/parsers/kakuyomu.md`                                    |            `D`             | カクヨム正本のフロントマター status がマージ後も `"Review (#3)"` のまま残存していた不備。`Approved (Phase 3)` へ更新して是正。                                                                                                                                           |
| 20  |  #1 / R1   | 節目横断レビュー (R1-15)             |                支援成果物                | `test/vrt/snapshots/`                                               |            `L`             | 旧ストーリー（Vertical）削除に伴う孤立 VRT スナップショット画像 2 ファイルが残存していた不備。`git rm` で削除して是正。                                                                                                                                                  |
| 21  |  #1 / R1   | 節目横断レビュー (R1-16)             |                支援成果物                | `docs/specs/screen-transitions.md`                                  |            `D`             | Mermaid 画面遷移図において TR-11 の遷移先 SCR-02 への矢印が欠落していた不備。Mermaid 遷移図に矢印を追加して一覧表と完全同期。                                                                                                                                            |
| 22  |  #1 / R1   | 節目横断レビュー (R1-17)             |                支援成果物                | `docs/specs/architecture.md`                                        |            `D`             | 標準ディレクトリツリー記述が `src/app/App.tsx` となっていた不備。実際の実装配置である `src/App.tsx` に合わせて修正・同期。                                                                                                                                               |
| 23  |  #1 / R1   | 節目横断レビュー (R1-18)             |                支援成果物                | `docs/specs/requirements.md` 等                                     |            `D`             | 要件（SYS-REQ）、画面遷移（TR）、受入条件（AC）間の相互参照リンク列が欠落していた不備。各仕様書の表に相互参照 ID 列を追加して双方向トレーサビリティを確立。                                                                                                              |
| 24  |  #1 / R1   | 節目横断レビュー (R1-19)             |                支援成果物                | `src/App.stories.tsx`                                               |            `L`             | `App.stories.tsx` の個別 Story エクスポート直上に日本語 JSDoc コメントが欠落していた不備。日本語 JSDoc を追記して是正。                                                                                                                                                  |
| 25  |  #1 / R1   | 節目横断レビュー (R1-20)             |                支援成果物                | `docs/index.md`                                                     |            `D`             | ドキュメント全体ツリーに Phase 3 策定正本（`kakuyomu.md`, `reader-view.md`）が追記されていなかった不備。目次ツリーに反映して是正。                                                                                                                                       |
| 26  |  #1 / R1   | 節目横断レビュー (R1-21)             |                支援成果物                | `docs/specs/*.md`                                                   |            `D`             | App 全体正本の OKF フロントマター `related_specs` / `related_tests` に Phase 3 成果物が反映されていなかった不備。全正本ドキュメントを最新状態に更新して是正。                                                                                                            |
| 27  |  #1 / R1   | 節目横断レビュー (R1-22)             |                支援成果物                | `docs/specs/parsers/kakuyomu.md`                                    |            `D`             | カクヨム正本とパーサー実装の挙動（サブドメイン許可、canonicalフォールバック、優先順位探索）の微細な乖離。仕様正本側を実装の挙動に合わせて完全同期。                                                                                                                      |
| 28  |  #1 / R1   | 節目横断レビュー (R1-23)             |                支援成果物                | `test/vrt/vrt.spec.ts` 等                                           |            `L`             | VRT テスト内の固定待機（`waitForTimeout`）、Storybook 0件空振り防止漏れ、親テストでの子内部 CSS 検証、`stmt.free()` try/finally 保護漏れの不備。アサーションベース待機・セマンティック属性化・finally 保護で是正。                                                       |
| 29  |  #1 / R1   | 節目横断レビュー (R1-24)             |                支援成果物                | `.github/workflows/ci.yml`                                          |            `D`             | CI ワークフローにおいて `npm run build` が二重実行され、ガイドライン上のワークフロー表現と乖離していた不備。ステップ順序を整理し、ガイドライン表記を単一ジョブ集約の実態に同期。                                                                                         |
| 30  | #1 / Step3 | 実機検証 (Step 3-3)                  |                製品コード                | `src/storage/schema.ts`                                             |            `D`             | Android 実機起動時に `reader_settings` 初期行が存在せず例外となる不備。`schema.ts` の `DDL_STATEMENTS` に `INSERT OR IGNORE INTO reader_settings` を追加し、`docs/specs/db-schema.md` を同期。                                                                           |
| 31  | #1 / Step3 | 実機検証 (Step 3-3)                  |                製品コード                | `PocReaderContainer.tsx`, `KakuyomuParser.ts`                       |            `D`             | デフォルト作品 URL がダミー ID のままで 404 となり、カクヨム現行レイアウトで目次抽出できない不備。実在作品 URL への更新とパーサー新レイアウトフォールバックを追加し、`docs/specs/parsers/kakuyomu.md` を同期。                                                           |
| 32  | #12 / PR20 | 独立AIレビュー (`pr-reviewer` 指摘1) |                支援成果物                | `requirements.md`, `bookshelf.md`, `reader-view.md`                 |            `D`             | `SYS-REQ-02`・`TR-03`・`AC-BS-06` の双方向トレーサビリティ不整合および `reader-view.md` の対応要件ID表記ずれ。各正本の関連画面/遷移列および対応要件リストを完全同期して是正。                                                                                            |
| 33  | #12 / PR20 | 独立AIレビュー (`pr-reviewer` 指摘2) |                支援成果物                | `docs/specs/features/bookshelf.md`                                  |            `D`             | `BookshelfPage` の `isLoading` 排他描画ルール（`bookshelf-loading`）、`BookshelfContainerProps`、`UseBookshelfResult` 契約、および `related_tests`（`BookshelfContainer.test.tsx`）の記載漏れ。正本 `bookshelf.md` にすべて明記して是正。                                |
| 34  | #12 / PR20 | 独立AIレビュー (`pr-reviewer` 指摘3) |                支援成果物                | `issue-12-bookshelf-and-routing.md`, `reader-view.md`               |            `D`             | 全 `*.tsx` に対する 1対1 `.stories.tsx` 原則（`router.stories.tsx`, `NovelDetailPlaceholder.stories.tsx` 等）の差分仕様・Sub-issue 記載漏れ、および `SCN-01` 検証ステップ 10・`targetUrl` 定義の正本同期漏れ。差分仕様と全体正本の双方を同期修正して是正。               |
| 35  | #22 / MK-2 | Storybook VRT (`npm run test:vrt`)   |                支援成果物                | `src/features/bookshelf/components/AddNovelDialog.stories.tsx`      |            `L`             | `fixed inset-0` を持つモーダルダイアログ単体の Story において `#storybook-root` の高さが 0 に縮退し Playwright の `expect(root).toBeVisible()` が失敗した不備。デコレーターに `min-h-screen relative` コンテナを導入し、非描画の `Closed` に `skip-vrt` を付与して是正。 |
| 36  | #14 / PR36 | 独立AIレビュー (`pr-reviewer` 指摘1) |                支援成果物                | `reader-view.md`, `issue-14-reader-navigation-bookmark-settings.md` |            `D`             | `ReaderToolbar` の手動取得ボタン（`fetch-novel-button`）活性制御、`useReader.fetchNovelFromUrl` の通信前 URL 正規化検証、および `goToChapter` の範囲外境界条件（`false` 返却）の明文化漏れ。正本 `reader-view.md` と差分仕様の双方に追記して同期。                       |
| 37  | #14 / PR36 | 独立AIレビュー (`pr-reviewer` 指摘2) |                支援成果物                | `reader-view.md`, `issue-14-reader-navigation-bookmark-settings.md` |            `D`             | `ReaderView` のスクロール位置復元の発火トリガー条件（マウント時および `initialScrollProgress`・`bodyHtml`・`writingMode` 変化時）の明記漏れ、および差分仕様 `related_tests` の新設テスト4件同期漏れ。正本 `reader-view.md` と差分仕様の双方を同期修正して是正。          |

---

## 3. 申し送り事項追跡一覧（Handover Items: `HO-xx`）

設計時や PR 作業中に「現在の PR スコープ外だが、後続の Sub-issue や IT、実機確認で必ず検証・対応すべき事項」が発生した場合は、以下に `HO-xx` として登録し、解決ゲート（親 Issue クローズ前、または Milestone 完了前）までに確実に消化します。

|   ID    | 起票元 Issue / PR | 申し送り事項の内容                                                                                                                                                                                                                                                                                                                     | 解決先（対象 Issue / 成果物）             | 完了ゲート          | 状態 (`Open` / `Resolved`) |
| :-----: | :---------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- | :------------------ | :------------------------: |
| `HO-01` |        #2         | カクヨム用のサイト別スクレイピング仕様書（`docs/specs/parsers/kakuyomu.md`）の策定、および HttpClientBridge・HtmlSanitizer・KakuyomuParser・Storage Layer（DatabaseAdapter/Repositories）のローカルフィクスチャ Vitest TDD 実装                                                                                                        | #3 (`[Phase 3-2a]`)                       | Issue #3 PR マージ  |         `Resolved`         |
| `HO-02` |        #2         | ServiceProvider 経由での Http/Storage/Parser 注入、縦書き・ルビ対応ミニマムリーダー UI、Storybook VRT、および Playwright IT（`SCN-01` 縦貫通シナリオ）の結合実装                                                                                                                                                                       | #4 (`[Phase 3-2b]`)                       | Issue #4 PR マージ  |         `Resolved`         |
| `HO-03` |      #1 (R1)      | Android 実機 / エミュレータ環境における技術リスク 4 点（CORS 回避通信、ネイティブ SQLite 保存、縦書き・ルビ組版表示、VRT/IT 整合性）の動作確認と APK ビルド検証                                                                                                                                                                        | #1 Step 3（人間確認スコープ）             | Phase 3 承認・完了  |           `Open`           |
| `HO-04` |      #1 (R1)      | `src/app/router.tsx` による画面ルーティング導入、および `SCR-01` 本棚画面（#12）・`SCR-02` 作品詳細/目次画面（#13）の実装                                                                                                                                                                                                              | Phase 4 Milestone `v0.1` (#12, #13 / #27) | Issue #13 PR マージ |           `Open`           |
| `HO-05` |      #1 (R1)      | 小説リーダー画面（`SCR-03`）の文字サイズ・行間・余白カスタマイズ、しおり自動保存、および目次ナビゲーションの実装（`SYS-REQ-09, 11, 12`）（※余白・フォント種別およびタップ/音量キー1画面送りはロードマップ通り Milestone `v0.2` スコープとし、`v0.1` の文字サイズ・行間・しおり自動保存・前後話/目次ナビゲーションを Issue #14 で解決） | Issue #14 Sub-issue ③ (#34 IT PR)         | Issue #14 PR マージ |           `Open`           |
| `HO-06` |        #15        | Android 実機 / エミュレータ環境におけるホーム画面アプリアイコン表示（Adaptive Icon 各種マスク形状、解像度視認性）および Web ブラウザでの Favicon 表示の確認                                                                                                                                                                            | Issue #15 Sub-issue ② (IT PR)             | Issue #15 PR マージ |           `Open`           |
| `HO-07` |        #12        | 本棚画面（`SCR-01`）での URL 作品登録 → 「続きから読む」（`TR-03`）によるリーダー画面（`SCR-03`）での未キャッシュ第1話オンデマンド取得 → 縦書き・ルビ表示・リロード復元の実ブラウザ結合テスト（`SCN-01`）検証                                                                                                                          | Issue #12 Sub-issue ③ (#23 IT PR)         | Issue #12 PR マージ |         `Resolved`         |
| `HO-08` |        #13        | 本棚画面（`SCR-01`）からの作品カード選択（`TR-02`）→ 作品詳細・目次画面（`SCR-02`）での目次更新・未キャッシュ話選択（`TR-04`）→ リーダー（`SCR-03`）オンデマンド取得 → 作品詳細復帰（`TR-06`）での `取得済み` バッジ反映 → 確認ダイアログ付き作品削除（`TR-07`）の実ブラウザ結合テスト検証                                             | Issue #13 Sub-issue ③ (#27 IT PR)         | Issue #13 PR マージ |           `Open`           |
| `HO-09` |        #14        | 小説リーダー画面（`SCR-03`）での文字サイズ・行間変更とリロード永続化、前後エピソード遷移（`TR-05`）、作品詳細・目次画面（`SCR-02`）への復帰（`TR-06`）時の `既読`・`しおり` バッジ反映、および「続きから読む」でのスクロール進捗位置復元の実ブラウザ結合テスト（`SCN-01`）検証                                                         | Issue #14 Sub-issue ③ (#34 IT PR)         | Issue #14 PR マージ |           `Open`           |

---

## 4. ミニリリース Milestone 品質振り返りサマリー（定期追記）

各節目（Phase 3 完了時、および Phase 4 以降の各ミニリリース Milestone 完了時）に、上記バグ記録を集計して傾向分析とプロセス改善（Kaizen）アクションを記録します（詳細レポートは `docs/quality/reports/` 配下に `type: quality-report` として格納）。

### Phase 3: PoC（Walking Skeleton 実証、対象 Issue: #1, #2, #3, #4）

- **製品コード不備件数**: 9 件（うち MK/UT/PRレビュー検出: 2 件、横断レビュー検出: 7 件、IT 流出: 0 件、実機流出: 0 件 → **UT/レビュー段階 DRE: 100%**）
- **支援成果物不備件数**: 20 件（OKF・正本同期 13 件、テストコード・VRT 衛生 7 件）
- **原因分類内訳**: `L`: 11 件（製品 4 / 支援 7） / `S`: 1 件（製品 1） / `D`: 15 件（製品 2 / 支援 13） / `B`: 2 件（製品 2） / `A`: 0 件（計 29 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - `docs/guidelines/testing.md` のカバレッジ除外規定（`src/main.tsx`, `src/test/**`）を明文化。
  - セレクタ優先順位の厳格化（配列順次探索 `queryFirst`）と `chapters` 一意キー `(novel_id, remote_chapter_id)` の正本化。
  - ネイティブ DI 自動配線（`Capacitor.isNativePlatform()`）および共有 DDL（`src/storage/schema.ts`）の整備。
  - VRT の固定待機排除・アサーションベース待機化、0件空振り防止アサーションの義務化。
  - 詳細分析は [docs/quality/reports/phase3-poc.md](reports/phase3-poc.md) を参照。
