---
name: git-workflow
description: "Use when executing Git or GitHub operations, including branch management, Japanese Conventional Commits, pull request creation, independent PR review coordination, and verifying the 7-condition Task Completion Gate."
---

# Git / GitHub ワークフロー実行手順

このスキルは、ブランチ操作、コミットメッセージ、Pull Request 作成、および独立 AI レビュー（`pr-reviewer`）とのスレッド収束に関する実行手順を定めます。

フェーズごとの進行方式（Phase 1〜2 の直接コミット vs Phase 3 以降の Issue+PR）および **Task Completion Gate（7条件）** の正本は [docs/guidelines/workflow.md](../../../docs/guidelines/workflow.md) です。

---

## 1. ブランチ戦略

- **Phase 1〜2（準備・全体骨格設計期間）**:
  ユーザーと対話しながら `main` ブランチ（または作業ブランチ）へ直接コミットしてスピーディに構築します。
- **Phase 3（PoC）および Phase 4 以降（本開発期間）**:
  GitHub Flow を適用し、Issue（Sub-issue）ごとに最新の `main` から短命なトピックブランチを切って PR で統合します。
  - ブランチ命名規則（小文字 kebab-case）: `feat/issue-12-narou-parser`, `fix/issue-15-ruby-style`, `docs/issue-10-reader-spec`, `chore/setup-ci` 等。

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/issue-12-narou-parser
```

---

## 2. コミットメッセージ規約（日本語 Conventional Commits）

- **形式**: `<type>(<scope>): <日本語の要約>`
  - `type` と `scope` は英語小文字、要約と本文は日本語で記述します。
  - 主な `type`: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`, `chore`
  - 主な `scope` 例: `parser`, `storage`, `viewer`, `bridge`, `specs`, `guidelines`, `skills`, `ci`
- **TDD ステップ証跡**:
  MK（実装・単体テスト）では、[docs/guidelines/testing.md](../../../docs/guidelines/testing.md#4-tdd-サイクルとコミット規約) に従い、Red・Green・Refactor の各ステップでコミットを分けて履歴に残します：
  - `test(parser): なろう小説の目次抽出テストを追加（Red）`
  - `feat(parser): なろう小説の目次抽出処理を実装（Green）`
  - `refactor(parser): 日付パース処理を共通ヘルパーに抽出（Refactor）`

---

## 3. Pull Request 作成と Task Completion Gate（7条件）の実行手順

Phase 3 以降の PR 作業では、[.github/pull_request_template.md](../../pull_request_template.md) の全項目（目的、変更内容、検証チェックリスト、**不備記録ミニテーブル**、**申し送り事項 `HO-xx` ミニテーブル**）を漏れなく記入し、[docs/guidelines/workflow.md](../../../docs/guidelines/workflow.md#4-task-completion-gate7つの完了条件) に定められた以下の **7条件** を順番に完遂します。

1. **ローカル静的検査・自動テスト PASS**:
   `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:coverage`（C0/C1/Functions 100%）を実行し PASS を確認する。
2. **VRT スナップショット更新・検証 PASS**:
   UI コンポーネント（`*.tsx` / `*.stories.tsx`）の変更時は、`npm run test:vrt:update` および `npm run test:vrt`（1280px / 375px）を実行し PASS を確認する。
3. **PR 作成と Issue リンク設定**:
   - 個別 Issue / Sub-issue を完了する PR には **`Closes #N`** を記載する（1つの Issue を複数 PR に分割する途中段階の PR のみ `Refs #N` を使用する）。
   - **厳守事項**: AI は `gh issue close` 等で Issue を直接クローズしたり、`gh pr review --approve` で PR を自己承認してはならない。必ず PR マージによって Issue（または Sub-issue）が同期クローズされる仕組みを厳守する。
4. **GitHub Actions の PASS 確認**:
   push 後、リモート上の必須ワークフロー（CI / VRT / IT）がすべて PASS することを確認する。失敗した場合は原因を特定して修正 push する。
5. **独立 AI レビュー（`pr-reviewer`）の実施**:
   - 実装サブエージェントとは独立したコンテキストで [.github/agents/pr-reviewer.agent.md](../../agents/pr-reviewer.agent.md) の手順に従い PR レビューを実施し、[docs/guidelines/review-comment-format.md](../../../docs/guidelines/review-comment-format.md) の形式で PR にコメントを記録する。
6. **指摘是正 ＆ 独立レビュアー（`pr-reviewer`）による再レビュー解消確認（Resolve 収束）**:
   - 指摘事項（`[P0]`〜`[P3]`）がある場合、以下の 4 ステップを確実に実行する（**Main/Worker による自己判断での Gate 6 完了判定は厳禁**）：
     1. 修正コミットを作成し、静的検査・自動テストの PASS を確認する（原因が `D` の場合は同一 PR 内で `docs/specs/` も同時修正し、PR 本文・`bug-and-handover-log.md` に追記）。
     2. 各コメントスレッド / PR に修正コミット SHA と検証結果を返信する。
     3. 独立レビュアー（`pr-reviewer`）サブエージェントを再度起動し、Round 2+ 再レビューを依頼する。
     4. `pr-reviewer` が PR に全指摘の解消確認（Resolved）コメントを投稿したことを確認し、Gate 6 完了とする。
   - 指摘事項が 0 件の場合は、Gate 6 は自動的に完了（N/A）扱いとする。
7. **PR 種別に応じたマージ実行（👤 人間マージ待機 または 🤖 AI 自律マージ）**:
   上記 1〜6 がすべて完了した時点で、[docs/guidelines/workflow.md §4](../../../docs/guidelines/workflow.md#4-task-completion-gate7つの完了条件) の区分に従い以下のように完了処理を行う：
   - **👤 人間マージ待機とする PR**:
     - **Step 2（設計更新 PR / `Refs #親Issue`）**、**Step 4（最終 IT PR・親 Issue 完了 PR / `Closes #親Issue`）**、**Milestone Step 3（品質分析 Kaizen・ログアーカイブ・最終承認 PR / `Closes #MilestoneIssue`）**
     - または [docs/guidelines/workflow.md §4.1](../../../docs/guidelines/workflow.md#41-ai-自律マージの停止人間エスカレーション条件) のエスカレーション条件（外部仕様 `AC-xx` / `TR-xx` / DB スキーマ変更を伴う原因 `D`、新規依存パッケージ / Android 権限 / 外部通信先追加、ガバナンス・CI 定義自体の変更、3ラウンド以上のレビュー未収束、小規模要望での親 Issue クローズ統合 PR）に該当する場合。
     - **アクション**: Gate 1〜6 の完了（親 Issue 単位での実機検証対象時は「Android 実機検証試験項目表」、エスカレーション理由がある場合はその内容）を人間に報告し、人間の最終確認・マージを待つ。
   - **🤖 AI（Orchestrator）が自律マージする PR**:
     - **Step 3（MK Sub-issue PR / `Closes #Sub-issue`）** および **Milestone Step 2（横断レビュー指摘是正 PR / `Closes #Sub-issue`、実機不具合追加是正 PR 含む）** であり、上記エスカレーション条件のいずれにも該当しない場合。
     - **アクション**: メインエージェント（Orchestrator）が `gh pr merge <PR番号> --squash --delete-branch` を実行して PR をマージし、`git switch main && git pull --ff-only origin main` で最新化した上で、人間のマージ待ちを挟まずに直ちに次の Sub-issue（Milestone Step 2 完了時は実機検証試験項目表の提示）へ進む。

---

## 4. Worktree の安全な利用ルール

並行調査や一時検証で `git worktree` を使用する場合：

- 既存の作業ツリーと同一ブランチを重複チェックアウトしない。
- Worktree 内でテストや品質チェックを実行する際は、`node_modules` の解決を確認する。
- **Worktree 運用における環境変数管理ルール**:
  - 新規 Worktree を作成する際、ルートの `.env.example` を参考に必要な環境変数（`VITE_GOOGLE_CLIENT_ID` 等）を確認する。
  - `package.json` の `prepare` スクリプト等により、メイン Worktree（`/workspaces/Yommy/.env.local`）が存在しかつカレント Worktree に `.env.local` がない場合は自動コピーして引き継ぐ。
  - テストおよびビルドは `.env.local` の有無に関わらず 100% 決定論的に PASS することを保証する（DI モック分離・安全なフォールバック）。
- 作業完了後は `git status` で未コミット変更がないことを確認してから `git worktree remove <path>` で削除する（`--force` は使用しない）。
