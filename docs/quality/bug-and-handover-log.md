---
type: quality-log
title: 品質記録・バグ記録票 ＆ 申し送り管理シート（Bug & Handover Log）
description: 製品コードと支援成果物を分離したバグ記録（原因5分類 L/S/D/B/A）および後続タスクへの申し送り事項（HO-xx）を追跡する正本シート。
status: Approved
updated: "2026-10-31"
tags: [quality, bug-log, handover, dre, kaizen]
related_specs:
  - docs/specs/changes/issue-122-reader-page-turning.md
  - docs/specs/changes/issue-120-cloud-sync-google-drive.md
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
5. **【運用】Milestone 完了時のアーカイブ移動ルール**:
   - 各ミニリリース Milestone（`v0.1`, `v0.2` 等）や Phase 完了の節目（Step 3：一括 `Approved` 化 PR）において、当該マイルストーンで検出されたバグ記録一覧および解決済み（`Resolved`）の申し送り事項を `docs/quality/archive/<milestone>-log.md`（OKF `type: quality-log`, `status: Completed (Archived)`）へ移動しアーカイブ化します。
   - 本シート（`docs/quality/bug-and-handover-log.md`）には、平時は「現在作業中マイルストーンのバグ記録」「作業中マイルストーンで解決した申し送り事項」「未解決（`Open`）の申し送り事項」のみを保持し、ドキュメントの肥大化を防止して高い一覧性とメンテナンス性を維持します。

---

## 2. バグ記録一覧（Bug Log）

> [!NOTE]
> **完了済みマイルストーンのアーカイブ記録**:
> 過去のマイルストーンで完了したバグ記録は、以下のアーカイブファイルへ移動・保存されています：
>
> - **Phase 3（PoC 実証、No. 1〜31）**: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
> - **Milestone `v0.1`（カクヨム MVP、No. 32〜70）**: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)
> - **Milestone `v0.2`（UI/UX 刷新 ＆ 開発基盤整備、No. 71〜99）**: [docs/quality/archive/v0.2-ui-ux-log.md](archive/v0.2-ui-ux-log.md)
> - **Milestone `v0.3`（検索/ランキング・先読みキャッシュ・更新チェック ＆ 実機基盤改善、No. 100〜132）**: [docs/quality/archive/v0.3-search-prefetch-log.md](archive/v0.3-search-prefetch-log.md)
>
> 次期作業中の **Milestone `v0.4`（クラウド同期 ＆ 外部連携強化）** で検出されたバグ記録は、本表へ No. 133 より連番で記入します。

| No. |  Issue / PR  | 検出フェーズ・手段                   | 成果物区分 (`製品コード` / `支援成果物`) | 対象箇所                                                                                                                                  | 原因 (`L`/`S`/`D`/`B`/`A`) | 不備の概要と是正内容（原因 `D` は設計書同期コミット併記）                                                                                                                                                                                                                                                                                                                                                          |
| :-: | :----------: | :----------------------------------- | :--------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------- | :------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 133 | #128 / PR130 | 独立AIレビュー (`pr-reviewer` 指摘1) |                支援成果物                | `test/it/scenarios/scn01-poc-vertical-reader.spec.ts`                                                                                     |            `L`             | `ReaderBottomOverlay` の閉じるボタン廃止に伴い、結合テスト `SCN-01` 内の閉じるボタンクリック検証が取り残され CI E2E で失敗していた不備。閉じるボタンの非存在検証および本文エリアタップによる自動非表示検証へ追従是正（コミット: `7d86b08`）。                                                                                                                                                                      |
| 134 |     #138     | TDD Green 実装中（設計整合確認）     |                支援成果物                | `docs/specs/db-schema.md`                                                                                                                 |            `D`             | `deleted_novels.deleted_at` および `cloud_sync_last_synced_at` の日時表現について、`db-schema.md` の ISO8601 文字列と Issue #138 指示（ミリ秒エポック数値）に差異があった不備。SQLite DDL を `INTEGER NOT NULL`（およびミリ秒文字列）へ更新し即時同期是正（コード: `4657a6d` / 設計: `4657a6d`）。                                                                                                                 |
| 135 | #139 / PR145 | 独立AIレビュー (`pr-reviewer` 指摘)  |                支援成果物                | `src/features/cloud-sync/services/syncEngine.ts`, `docs/specs/architecture.md`, `docs/specs/changes/issue-120-cloud-sync-google-drive.md` |            `D`             | PR #145 独立レビューにて再登録作品の Tombstone 残留消失、URL/作品ID不整合検証、多重並行実行防止（isSyncing/Single-flight）、deletedNovels 空文字・重複キー検証、および debouncedPush 未処理例外漏洩の考慮漏れを検出。Tombstone 除外・パージ、URL/ID 整合性検証、排他制御、スキーマ検証強化、catch 登録を実施し、正本仕様書（architecture.md §3.7, issue-120-cloud-sync-google-drive.md §2.2/§2.5）へ即時同期是正。 |
| 136 | #140 / PR146 | 独立AIレビュー (`pr-reviewer` 指摘)  |                支援成果物                | `android/app/src/main/java/com/yommy/app/CloudSyncPlugin.java`, `src/bridges/cloud-sync/capacitorCloudSyncBridge.ts`                      |            `L`             | `CloudSyncPlugin.java` における Capacitor `startActivityForResult` と `IntentSender` の型不一致による Java コンパイルエラー、および `email` 未正規化の是正。`ActivityResultContracts.StartIntentSenderForResult` への移行と空文字 `email` の `undefined` 正規化を実施。                                                                                                                                            |

---

## 3. 申し送り事項追跡一覧（Handover Items: `HO-xx`）

設計時や PR 作業中に「現在の PR スコープ外だが、後続の Sub-issue や IT、実機確認で必ず検証・対応すべき事項」が発生した場合は、以下に `HO-xx` として登録し、解決ゲート（親 Issue クローズ前、または Milestone 完了前）までに確実に消化します。

> [!NOTE]
> **解決済み申し送り事項（`HO-01`〜`HO-14`, `HO-16`〜`HO-21`）のアーカイブ**:
>
> - Phase 3 で解決済みの申し送り（`HO-01`〜`HO-03`）: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
> - Milestone `v0.1` で解決済みの申し送り（`HO-04`〜`HO-09`）: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)
> - Milestone `v0.2` で解決済みの申し送り（`HO-10`〜`HO-13`）: [docs/quality/archive/v0.2-ui-ux-log.md](archive/v0.2-ui-ux-log.md)
> - Milestone `v0.3` で解決済みの申し送り（`HO-14`, `HO-16`〜`HO-21`）: [docs/quality/archive/v0.3-search-prefetch-log.md](archive/v0.3-search-prefetch-log.md)

|   ID    | 起票元 Issue / PR | 申し送り事項の内容                                                                                                                                        | 解決先（対象 Issue / 成果物）          | 完了ゲート             | 状態 (`Open` / `Resolved`) |
| :-----: | :---------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- | :--------------------- | :------------------------: |
| `HO-15` |        #78        | Android 実機での APK 上書きインストール実証（GitHub Actions 生成 APK を実機へアンインストールなしで上書きアップデートできることの検証）                   | Milestone `v0.3` Step 3 人間確認タスク | 実機インストール確認時 |           `Open`           |
| `HO-22` |       #120        | Google Drive appDataFolder クラウド同期の Android 実機 / Google Play 開発者サービス環境での OAuth 認可フローおよび `AuthorizationClient` 連携の実機検証   | Milestone `v0.4` Step 3 人間確認タスク | 実機インストール確認時 |           `Open`           |
| `HO-23` |       #122        | リーダー縦書きページめくりにおける Android 実機（90Hz/120Hz）でのタッチイベント・スワイプリアルタイム指追従パフォーマンスおよびラバーバンド描画負荷の検証 | Milestone `v0.4` Step 3 人間確認タスク | 実機インストール確認時 |           `Open`           |

---

## 4. ミニリリース Milestone 品質振り返りサマリー（定期追記）

各節目（Phase 3 完了時、および Phase 4 以降の各ミニリリース Milestone 完了時）に、上記バグ記録を集計して傾向分析とプロセス改善（Kaizen）アクションを記録します（詳細レポートは `docs/quality/reports/` 配下に `type: quality-report` として格納）。

### Phase 3: PoC（Walking Skeleton 実証、対象 Issue: #1, #2, #3, #4、記録 No. 1〜31）

- **アーカイブ記録**: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
- **詳細分析レポート**: [docs/quality/reports/phase3-poc.md](reports/phase3-poc.md)
- **製品コード不備件数**: 11 件（うち MK/UT/PRレビュー検出: 2 件、横断レビュー検出: 7 件、IT 流出: 0 件、Step 3-3 実機検証検出: 2 件 → **UT/レビュー段階 DRE: $9/11 \approx 81.8\%$**）
- **支援成果物不備件数**: 20 件（OKF・正本同期 13 件、テストコード・VRT 衛生 7 件）
- **原因分類内訳**: `L`: 11 件（製品 4 / 支援 7） / `S`: 1 件（製品 1） / `D`: 17 件（製品 4 / 支援 13） / `B`: 2 件（製品 2） / `A`: 0 件（計 31 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - `docs/guidelines/testing.md` のカバレッジ除外規定（`src/main.tsx`, `src/test/**`）を明文化。
  - セレクタ優先順位の厳格化（配列順次探索 `queryFirst`）と `chapters` 一意キー `(novel_id, remote_chapter_id)` の正本化。
  - ネイティブ DI 自動配線（`Capacitor.isNativePlatform()`）および共有 DDL（`src/storage/schema.ts`、`reader_settings` 初期行含む）の整備。
  - VRT の固定待機排除・アサーションベース待機化、0件空振り防止アサーションの義務化。

### Milestone `v0.1`: カクヨム MVP（3画面基本完成・アプリアイコン設定、対象 Issue: #12, #13, #14, #15, #42, #16、記録 No. 32〜70）

- **アーカイブ記録**: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.1-mvp.md](reports/v0.1-mvp.md)
- **製品コード不備件数**: 7 件（うち MK/UT/PRレビュー検出: 0 件、横断コードレビュー検出: 5 件、実データ動作確認検出: 2 件［`R1-26`, `R1-27`］、リリース後流出: 0 件 → **自動テスト・コードレビュー段階 DRE: $5/7 \approx 71.4\%$、Milestone リリース前 DRE: 100%**）
- **支援成果物不備件数**: 32 件（独立 AI PR レビュー設計・レポート同期 6 件、MK/IT/CI テスト・スクリプト是正 6 件、節目横断レビュー正本/テスト/CI 是正 20 件）
- **原因分類内訳（Milestone `v0.1` 単体 39 件）**: `D`: 21 件（製品 3 / 支援 18） / `L`: 15 件（製品 2 / 支援 13） / `A`: 2 件（製品 1 / 支援 1） / `B`: 1 件（製品 1 / 支援 0） / `S`: 0 件（計 39 件、Phase 3 からの累計 70 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **実サイト HTML 構造・埋め込みデータ事前調査の義務化（`R1-27` 再発防止）**: `docs/guidelines/testing.md` §2.1 および `.github/skills/c-ut-workflow/SKILL.md` に、外部小説サイトパーサー実装時の初期表示 DOM 制限（直近7話等）・トグル非表示章・`__NEXT_DATA__` 埋め込み JSON の事前調査と 7話超・複数章フィクスチャ検証を明文化。
  - **直交フロー（縦書き `vertical-rl`）の幅制約と長文 Overflow Story / IT 検証の義務化（`R1-26` 再発防止）**: `docs/guidelines/testing.md` §2.3 および `.github/skills/c-ut-workflow/SKILL.md` に、直交フロー要素の `w-full max-w-full` 幅制約、1280px/375px 双方で Overflow する長文 Story の必須化、および実ブラウザ IT での負の `scrollLeft` 検証を明文化。
  - **OKF 検証スクリプトの強化（`R1-08` 再発防止）**: `.github/skills/sdd/scripts/validate-okf.mjs` を拡張し、`related_specs` に加えて `related_tests` 配列内のテストファイルパス実在性を機械検証するよう強化。
  - **1対1 Story/UT 原則の例外明記（`R1-14` 解消）**: `docs/guidelines/testing.md` §1.5 に `src/main.tsx`（§5.2 項4）の例外参照を明記し規約間の整合性を確立。

### Milestone `v0.2`: UI/UX 刷新 ＆ 開発基盤整備（100dvh全画面シェル・設定画面新設・全画面リーダー・CIブラウザレス化、対象 Issue: #49, #50, #51, #52, #53、記録 No. 71〜99）

- **アーカイブ記録**: [docs/quality/archive/v0.2-ui-ux-log.md](archive/v0.2-ui-ux-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.2-ui-ux.md](reports/v0.2-ui-ux.md)
- **製品コード不備件数**: 3 件（うち MK/UT/PRレビュー検出: 1 件［No. 77 / #62］、横断コードレビュー検出: 2 件［No. 98: `R1-20`, No. 99: `R1-21`］、リリース後流出: 0 件 → **マイルストーン完了前 DRE: 100%**）
- **支援成果物不備件数**: 26 件（設計同期・OKF 15 件、テスト・IT 7 件、記録・規律・VRT衛生 4 件）
- **原因分類内訳（Milestone `v0.2` 単体 29 件）**: `D`: 19 件（製品 2 / 支援 17） / `L`: 1 件（製品 1 / 支援 0） / `S`: 2 件（製品 0 / 支援 2） / `A`: 7 件（製品 0 / 支援 7） / `B`: 0 件（計 29 件、Phase 3 からの累計 99 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **VRT 孤児スナップショット検知ガードの自動化（`R1-12` 再発防止）**: `test/vrt/vrt.spec.ts` において、`storybook-static/index.json` の対象ストーリー一覧と `test/vrt/snapshots/` 内 PNG 一覧の完全一致を機械検証し、削除・名称変更されたストーリーの孤児ファイル残存を CI で阻止。
  - **非同期永続化におけるエラー通知・ロールバック規律（`R1-20` 再発防止）**: 設定変更等の非同期保存処理において、失敗時に直前の state へロールバックし、画面上に `role="alert"` でエラーを明示する UI/Container 設計規律を確立。
  - **ルーティング同一パスガード規律（`R1-21` 再発防止）**: 同一ルートへの遷移要求において重複 `pushState` を抑止するガードを導入し、OS バックキー・直前画面復帰（`TR-12` 等）の履歴破壊を防止。

### Milestone `v0.3`: 検索/ランキング・先読みキャッシュ・更新チェック ＆ 実機基盤改善（対象 Issue: #78, #79, #80, #81, #82、記録 No. 100〜132）

- **アーカイブ記録**: [docs/quality/archive/v0.3-search-prefetch-log.md](archive/v0.3-search-prefetch-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.3-search-prefetch.md](reports/v0.3-search-prefetch.md)
- **製品コード不備件数**: 13 件（うち MK/UT/PRレビュー検出: 5 件［No. 108, 111, 112, 113, 117］、結合テスト段階検出: 3 件［No. 119, 120, 121］、PR レビュー検出: 1 件［No. 123］、横断レビュー検出: 4 件［No. 125, 126, 127, 128］、リリース後流出: 0 件 → **マイルストーン完了前 DRE: 100%**）
- **支援成果物不備件数**: 20 件（設計同期・OKF 13 件、テスト・IT 3 件、Storybook/定数テスト規律 4 件）
- **原因分類内訳（Milestone `v0.3` 単体 33 件）**: `D`: 21 件（製品 5 / 支援 16） / `L`: 4 件（製品 4 / 支援 0） / `S`: 3 件（製品 1 / 支援 2） / `A`: 4 件（製品 2 / 支援 2） / `B`: 1 件（製品 1 / 支援 0）（計 33 件、Phase 3 からの累計 132 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **実行時定数定義およびバレルエクスポートの1対1単体テスト配置規律徹底（`R1-09` 再発防止）**: `docs/guidelines/testing.md` §1 Rule 5 に、定数定義ファイル（`src/**/constants/*.ts`）やバレルファイル（`src/**/index.ts`）も 1対1 単体テスト（`*.test.ts`）必須であることを明記。
  - **Storybook ストーリー定義における日本語表示名（`name`）および JSDoc 義務化の徹底（`R1-08` 再発防止）**: `docs/guidelines/testing.md` §4.2 に Storybook ストーリー定義時の日本語 `name` プロパティおよび JSDoc 付与チェックリストを明確化。
  - **結合テスト（IT）新設時のシナリオ ID 衝突防止プロトコル（`R1-04` 再発防止）**: `docs/specs/screen-transitions.md` および `test/it/scenarios/` における一意採番（SCN-01〜SCN-04）を機械的に整合。
  - **非同期処理における多重呼び出しガードおよび関数型ステート更新（`R1-13`, `R1-20` 再発防止）**: 連続操作や並行処理時の `addingWorkId` 競合解除、一括キャッシュ時のフォールバックおよび中断制御の安全性を担保。
