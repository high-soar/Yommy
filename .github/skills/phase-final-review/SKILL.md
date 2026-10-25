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
- **アンカリング防止（独立性の担保）**:
  各 reviewer サブエージェントには「対象 SHA」「参照すべき正本（`docs/specs/`, `docs/guidelines/`）」「担当観点と対象ファイル」のみを渡し、過去の指摘やメインエージェントが疑っている具体的な箇所は事前に共有しません。

---

## 2. 横断レビュー実行手順（Step 1）

1. **対象と完了条件・SHA の固定**:
   - 対象 Milestone（または Phase）の追跡 Issue、含まれる要望 Issue 一覧、および現在の `HEAD` コミット SHA（`git rev-parse HEAD`）を確認し、`git status` がクリーンであることを確認する。
   - **実施タイミングの鉄則**: 品質分析レポート（`docs/quality/reports/*.md`）を作成する **前** に Round 1 横断レビューを実施する。これにより、横断レビューで摘出された不備も `docs/quality/bug-and-handover-log.md` に漏れなく算入した上で正確なバグ密度・DRE を算出できる。
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
4. **追跡 Issue への集約コメント記録（Round N）**:
   - [docs/guidelines/review-comment-format.md](../../../docs/guidelines/review-comment-format.md#5-節目横断レビューphase--ミニmilestone-完了レビューの集約形式) のテンプレートに従い、ラウンドプレフィックス付き ID（初回は `R1-01`, `R1-02`...、2回目は新規のみ `R2-01`、未解消再掲は `R1-01` 維持）を採番して追跡 Issue にコメント投稿する。

---

## 3. 指摘是正・品質分析レポート作成（Kaizen PR：Step 2）への連携

Round 1 横断レビュー完了後、以下の手順で Step 2（Sub-issue による是正＆品質分析・スキル改善 PR）を進めます。

1. **是正とバグ記録の最終集約**:
   - Round 1 で検出された指摘（`R1-xx`）をすべて修正し、[docs/quality/bug-and-handover-log.md](../../../docs/quality/bug-and-handover-log.md) に記録する（原因 `D` は `docs/specs/` も同時修正）。
2. **品質分析・Kaizen レポートの作成（`docs/quality/reports/<milestone>.md`）**:
   - 当該 Milestone（または Phase 3）における製品コード不備件数、支援成果物不備件数、テストケースあたり/KLoC あたりバグ密度、単体テスト段階の欠陥除去率（$\text{DRE} = \frac{\text{MK/UT/PRレビュー検出製品不備}}{\text{全検出製品不備}} \times 100\%$）、および原因分類（`L`/`S`/`D`/`B`/`A`）の傾向を分析する。
   - 多発した原因や IT/横断レビューまで流出した不備について、再発防止策として **`docs/guidelines/` や `.github/skills/*/SKILL.md` のチェック項目・規約を直接アップデート（Kaizen）** し、同一 PR に含める。
3. **Round 2 収束確認と人間承認（Step 3）**:
   - Kaizen PR がマージされた後、追跡 Issue 上で全指摘の解消（Round 2 指摘なし）をコメント報告し、人間による Milestone 最終承認を待つ。
