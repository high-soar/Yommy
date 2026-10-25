# AI駆動開発プレイブック ＆ 他プロジェクト適応手引きパッケージ

本アーカイブには、以下2つのディレクトリが含まれています。

## 1. `playbook/`（説明書 ＆ 他プロジェクト適応手引き本編）
まずは `playbook/00-index.md` からお読みください。
- `00-index.md`: 全体目次・エグゼクティブサマリー・早見表
- `01-waterfall-process-and-refinement.md`: 第1部：段階的詳細化とワークフロー設計
- `02-ai-orchestration-and-governance.md`: 第2部：AI設定のSSOTとマルチエージェント・ガバナンス
- `03-engineering-and-testing-practices.md`: 第3部：各工程の技術プラクティス（TDD・画面テスト・モック戦略）
- `04-quality-analysis-and-kaizen-loop.md`: 第4部：品質分析・申し送り事項・継続的改善（Kaizen）ループ
- `05-iterative-adaptation-guide.md`: 第5部：他プロジェクト（イテレーティブ／Issue駆動開発）への適応手引き
- `06-starter-templates-and-checklists.md`: 第6部：他プロジェクト導入用スターターテンプレート＆チェックリスト集

## 2. `references/`（本リポジトリの実物設定・スキル・設計書・品質レポート参考資料）
他プロジェクトへ流用・カスタマイズする際のベースとしてそのまま活用できる実物ファイル群です。

### AI 設定・スキル・エージェント定義
- `references/AGENTS.md`: プロジェクト全体の AI ガイドライン正本（SSOT）
- `references/.agents/skills.json`: Google Antigravity 用スキルマッピング定義
- `references/.github/copilot-instructions.md`: GitHub Copilot 用ブリッジ定義
- `references/.github/skills/`: 各専門スキル定義（`c-ut-workflow`, `waterfall-github-task-management`, `phase-final-review`, `git-workflow`, `retrospective`, `hook-ci-guidance`, `repo-config-management` 等）
- `references/.github/agents/`: カスタムエージェント定義（`pr-reviewer.agent.md`, `phase-final-reviewer.agent.md` 等）

### ドキュメント規約・レビュー基準
- `references/docs/README.md`: 設計書ライフサイクル（`Draft`/`Review`/`Approved`）、手戻り是正・局所的再承認ルール
- `references/docs/review-comment-format.md`: レビューコメント記述基準（`[P0]`〜`[P3]` ＋ 4要素フォーマット）

### 段階的詳細化（RD → ED → ID）の実例サンプル
- `references/docs/rd/step3.md`: 要件定義書の実例
- `references/docs/ed/`: 外部設計書（`01-system-overview.md`, `02-screen-list.md`, `03-screen-transition.md`, `screens/ticket-create.md`, `api/openapi.yaml`）
- `references/docs/id/`: 内部設計書（`01-frontend-architecture.md`, `state-management.md`, `test-design.md`, `screens/ticket-create.md`）

### 品質分析レポート・バグ記録票・テスト仕様書の実例サンプル
- `references/docs/c-ut/`: 単体テスト工程計画、バグ密度実験計画、バグ記録票（`evidence/ut-bug-record.md`）、品質分析レポート（`quality/step2.md`, `quality/step3.md`）
- `references/docs/it/`: 結合テスト計画、結合テストシナリオ（`test-scenario.md`）、バグ記録票（`evidence/it-bug-record.md`）、品質分析・DREレポート（`quality/step2.md`）
- `references/docs/pt/`: 総合テスト計画（`test-plan.md`）、バグ記録票（`evidence/pt-bug-record.md`）、品質分析・Total-DREレポート（`quality/step2.md`）
- `references/docs/vrt/operation-guide.md`: VRT（視覚的回帰テスト）運用手順書
