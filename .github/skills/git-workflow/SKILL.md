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
   - **厳守事項**: AI は `gh issue close` 等で Issue を直接クローズしたり、`gh pr review --approve` / `gh pr merge` で PR を承認・マージしてはならない。人間が PR をマージすることで Issue が同期クローズされる。
4. **GitHub Actions の PASS 確認**:
   push 後、リモート上の必須ワークフロー（CI / VRT / IT）がすべて PASS することを確認する。失敗した場合は原因を特定して修正 push する。
5. **独立 AI レビュー（`pr-reviewer`）の実施**:
   - 実装サブエージェントとは独立したコンテキストで [.github/agents/pr-reviewer.agent.md](../../agents/pr-reviewer.agent.md) の手順に従い PR レビューを実施し、[docs/guidelines/review-comment-format.md](../../../docs/guidelines/review-comment-format.md) の形式で PR にコメントを記録する。
6. **指摘是正・設計同期・スレッド収束（Resolve）**:
   - 指摘事項（`[P0]`〜`[P3]`）がある場合、修正コミット（および [docs/quality/bug-and-handover-log.md](../../../docs/quality/bug-and-handover-log.md) と PR 本文のバグ記録表への追記）を行う。
   - **原因が `D`（設計・仕様不備）の場合は、必ず同一 PR 内で `docs/specs/` の設計書も同時修正する**。
   - 各コメントスレッドに修正コミット SHA と検証結果を返信し、`pr-reviewer` による再確認を経て全スレッドを Resolve する。
7. **人間への完了報告とマージ待機**:
   上記 1〜6 がすべて完了したことを人間に報告し、人間の最終確認・マージを待つ。

---

## 4. Worktree の安全な利用ルール

並行調査や一時検証で `git worktree` を使用する場合：

- 既存の作業ツリーと同一ブランチを重複チェックアウトしない。
- Worktree 内でテストや品質チェックを実行する際は、`node_modules` の解決を確認する。
- 作業完了後は `git status` で未コミット変更がないことを確認してから `git worktree remove <path>` で削除する（`--force` は使用しない）。
