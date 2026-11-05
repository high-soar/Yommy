---
name: phase-final-review
description: "Use when orchestrating a cross-deliverable review at the end of a Phase (e.g., Phase 3 PoC) or Mini-Release Milestone (v0.1, v0.2...); split the review among read-only subagents without anchoring, verify findings, record on the tracking Issue, and lead into quality analysis (Kaizen)."
---

# 節目・ミニリリース Milestone 全体横断レビューのオーケストレーション手順

このスキルは、Phase 完了時（Phase 3 PoC 完了等）やミニリリース Milestone（`v0.1`, `v0.2` 等）の完了節目に実施する **全体横断レビューおよび品質分析（Kaizen）連携のオーケストレーション手順** を定めます。

3段階ゲート運用およびレビューコメント集約フォーマットの正本（SSOT）は以下を参照してください：

- [docs/guidelines/workflow.md](../../../docs/guidelines/workflow.md#5-ミニリリース-milestone-と品質改善kaizenループ)
- [docs/guidelines/review-comment-format.md](../../../docs/guidelines/review-comment-format.md#5-節目横断レビューphase--ミニmilestone-完了レビューの集約形式)

---

## 1. 基本オーケストレーションモデル

- **メインセッションが Coordinator**:
  メインセッションでレビュー範囲を重複しない 2〜3 の観点に分割し、複数の読み取り専用サブエージェント（Google Antigravity では `research`、GitHub Copilot では Read-only / Explore 等）を直接起動します（孫サブエージェントのネスト起動は行わない）。
- **マルチモデル・複数オーケストレーターの並行運用**:
  モデルごとの推論特性や深さ（網羅性・アーキテクチャ・潜在リスク等）の差異を活かすため、オーケストレーター自体を異なるモデル（例: Gemini Flash, Gemini Pro, Claude 等）で複数起動して横断レビューを並行実施することを推奨します。各オーケストレーターは独立した追記スレッドとしてレビュー結果を投稿し、モデル別の着眼点を可視化します。
- **アンカリング防止（独立性の担保）**:
  各 reviewer サブエージェントには「対象 SHA」「参照すべき正本（`docs/specs/`, `docs/guidelines/`）」「担当観点と対象ファイル」のみを渡し、過去の指摘やメインエージェントが疑っている具体的な箇所は事前に共有しません。

---

## 2. 横断レビュー実行手順（Step 1）

1. **対象と完了条件・SHA の固定**:
   - 対象 Milestone（または Phase）の追跡 Issue、含まれる要望 Issue 一覧、および現在の `HEAD` コミット SHA（`git rev-parse HEAD`）を確認し、`git status` がクリーンであることを確認する。
   - **実施タイミングの鉄則**: 品質分析レポート（`docs/quality/reports/*.md`）を作成する **前** に Round 1 横断レビューおよび Step 2 の指摘是正・Android 実機検証を実施する。これにより、横断レビューおよび実機検証で摘出された不備をすべて `docs/quality/bug-and-handover-log.md` に漏れなく算入した上で、Step 3 にて正確なバグ密度・DRE を一度で算出・アーカイブできる。
2. **観点の分割と読み取り専用サブエージェントの起動**:
   対象範囲に応じて、以下の 3 観点に分割して読み取り専用サブエージェントを起動する：
   - **観点 A（仕様・設計正本とトレーサビリティ）**: `docs/specs/` 間の整合性（`requirements.md`, `architecture.md`, `db-schema.md`, `screen-transitions.md`, `features/*.md`, `parsers/*.md`）、受け入れ条件（`AC-xx`）・画面遷移（`TR-xx`）の双方向リンク、未消化の申し送り事項（`HO-xx`）の有無。
   - **観点 B（3層実装と単体テスト・VRT 規律）**: `src/` 配下の実装が `docs/specs/` の契約に 1対1 準拠しているか、`docs/guidelines/testing.md`（1対1 Story/UT、親子分離、C0/C1 100%、不正な `v8 ignore` がないか、縦書き/ルビ VRT 網羅）を満たしているか。
   - **観点 C（結合テスト回帰保証と品質記録の整合性）**: `test/it/` の `SCN-01`〜 が過去機能を含め最新仕様を網羅しているか、`docs/quality/bug-and-handover-log.md` に原因 `D` の設計同期漏れがないか。

   各サブエージェントへの指示プロンプトには以下を明記する：

   ```text
   - レビュー対象 SHA: <commit-sha>
   - 参照正本: docs/guidelines/testing.md, docs/guidelines/workflow.md, docs/specs/
   - 担当観点と対象ファイル: <観点 A / B / C の範囲>
   - 制約: 読み取り専用（ファイル編集・コミット・GitHub コメント投稿は禁止）
   - 出力形式: docs/guidelines/review-comment-format.md に従い、[P0]〜[P3] の重要度と 4要素（Location, Problem, Impact, Recommendation）で報告すること（指摘なしの場合も確認範囲を報告）。
   ```

3. **メインセッションでの事実検証と品質ゲート実行**:
   - 全サブエージェントの応答完了後、サブエージェントを明示的に終了（`manage_subagents` の `kill` / `kill_all`）する。
   - 報告された候補をメインセッションで実際のコード・正本と照合し、誤検知を除外して重複を整理する。
   - メインセッションで一通りの検証コマンド（`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:coverage`, `npm run test:vrt`, `npm run test:it`）を実行し、100% PASS することを確認する。
4. **追跡 Issue 既存コメントの確認と連番追記（Pre-post Conflict Check）**:
   - コメント投稿前に、必ず追跡 Issue の既存コメントを確認する：
     ```bash
     gh issue view <issue-number> --comments
     ```
   - **既存コメントの存在有無に応じた採番規律**:
     - **先行コメントが存在しない場合**: `R1-01` から採番して集約コメントを投稿する。
     - **先行コメント（別モデル/別オーケストレーター）が既に存在する場合**:
       1. 先行コメントの最終指摘 ID（例: `R1-16`）を確認する。
       2. 自身が発見した指摘のうち、先行指摘と同一内容のものは「先行指摘 `R1-xx` を追認・補強」として言及する。
       3. 自身が独自に発見した新規指摘については、**先行コメントの最終連番に続く連続した ID（例: `R1-17`, `R1-18`...）を付与する（ID の重複を厳禁）**。
       4. 使用モデル名やレビュー観点を明記した **独立した追記コメント（スレッド）** として投稿し、モデル別の着眼点・レビュー差分が把握できるようにする。
   - コメントフォーマットは [docs/guidelines/review-comment-format.md](../../../docs/guidelines/review-comment-format.md#5-節目横断レビューphase--ミニmilestone-完了レビューの集約形式) のテンプレートに従う。

---

## 3. 横断レビュー指摘是正・Android 実機検証（Step 2）から品質分析・アーカイブ・最終承認（Step 3）への進行

全モデルの Round 1 横断レビューが完了し、人間から Step 2 開始指示を受けた後、以下の手順で **Step 2（横断レビュー指摘是正 PR の AI 自律マージ ＋ Android 実機検証試験項目表の提示と実機収束）** から **Step 3（品質分析レポート・再発防止 Kaizen・バグ＆申し送りログアーカイブ・正本一括 Approved 化の最終承認 PR）** までを進めます。

1. **横断レビュー指摘の是正 PR 作成と AI 自律マージ（Step 2-1）**:
   - Sub-issue を起票し、Round 1 で検出された全指摘（`R1-xx`）を修正して [docs/quality/bug-and-handover-log.md](../../../docs/quality/bug-and-handover-log.md) に記録する（原因 `D` は `docs/specs/` も同時修正。規模に応じて複数の Sub-issue PR に分割可）。
   - Step 2 の指摘是正 PR（`Closes #Sub-issue`）で Task Completion Gate 条件 1〜6 を完遂した後、[docs/guidelines/workflow.md §4](../../../docs/guidelines/workflow.md#4-task-completion-gate7つの完了条件) に従い **メインエージェントが `gh pr merge --squash --delete-branch` で自律マージ** する。
2. **Android 実機検証試験項目表の提示と実機確認・是正収束（Step 2-2）**:
   - 指摘是正 PR の自律マージ完了後、AI は直ちに [docs/guidelines/workflow.md §2.2](../../../docs/guidelines/workflow.md#22-android-実機検証の実施判断基準と試験項目表フォーマット) に従い、未消化の申し送り事項（`HO-xx`）および横断レビューでの修正箇所を網羅した **構造化された「Android 実機検証試験項目表」（項番・確認項目・具体的な操作手順・期待される結果・一筆書き確認ルート）** を人間に提示する。
   - 人間による実機検証で不具合が発見された場合、AI は追加是正 PR（TDD 修正・設計同期・`bug-and-handover-log.md` への記録・Gate 1〜6 検証）を作成して自律マージし、実機再確認で全項目 OK（未解決 `HO-xx` 0 件）となるまで収束させる。
3. **Round 2 収束確認・品質分析レポート（Kaizen）・バグ記録アーカイブ・正本一括 `Approved` 化（Step 3：人間最終承認ゲート）**:
   - 横断レビュー是正および Android 実機検証がすべて完了・収束した後、追跡 Issue 上で全指摘および実機検証の収束（Round 2 残存指摘 0 件・未解決 `HO-xx` 0 件）をコメント報告する。
   - 続けて、Milestone 承認 Issue をクローズする **最終承認 PR（`Closes #Milestone承認Issue`）** を作成し、同一 PR 内で以下の ①〜④ を一括実施する：
     1. **品質分析・Kaizen レポートの作成（`docs/quality/reports/<milestone>.md`）**:
        - 当該 Milestone（または Phase 3）における製品コード不備件数、支援成果物不備件数、テストケースあたり/KLoC あたりバグ密度、欠陥除去率（DRE）、原因分類（`L`/`S`/`D`/`B`/`A`）の傾向、および精算済み実機申し送り（`HO-xx`）を確定値で集計・分析する（フロントマター `status: "Approved"`）。あわせて `docs/quality/bug-and-handover-log.md` §4 サマリーに追記する。
     2. **再発防止策（Kaizen）の反映**:
        - 多発した原因や IT・横断レビュー・実機検証まで流出した不備について、再発防止策として **`docs/guidelines/testing.md` や `.github/skills/*/SKILL.md` のチェック項目・規約を直接アップデート** し、同一 PR に含める。
     3. **バグ記録・解決済み申し送り事項のアーカイブ化**:
        - 当該 Milestone で検出された全バグ記録（No. xx〜yy）および解決済み（`Resolved`）の申し送り事項（`HO-xx`）を `docs/quality/archive/<milestone>-log.md`（OKF `type: quality-log`, `status: "Completed (Archived)"`）へ切り出し、`docs/quality/bug-and-handover-log.md` には未解決（`Open`）の申し送りと次期マイルストーン用の記録枠のみを残す（`docs/index.md` のディレクトリツリーにも登録する）。
     4. **正本仕様書の一括 `Approved` 化**:
        - `docs/specs/` 配下の正本仕様書フロントマター `status` を一括で `"Approved"` に揃える。
   - Step 3 PR で Gate 1〜6 を完遂した上で人間に報告し、**人間による本 PR のマージをもって Milestone を完了** とする。
