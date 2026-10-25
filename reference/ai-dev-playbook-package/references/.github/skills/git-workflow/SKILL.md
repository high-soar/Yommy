---
name: git-workflow
description: "Use when planning Git or GitHub work, including branch strategy, commit messages, worktrees, pull requests, or hook and CI placement."
---

# Git / GitHub ワークフロー

このスキルは、リポジトリ固有の `AGENTS.md`、`CONTRIBUTING.md`、GitHub のブランチ保護設定やチーム方針がない場合の既定ルールを示す。明示されたリポジトリの規則がある場合は、そちらを優先する。

## ブランチ戦略

- GitHub Flow を基本とし、既定ブランチ（このテンプレートでは `main`）を常に共有可能な状態に保つ。既定ブランチ上で直接作業したり、直接 push したりせず、変更ごとに topic branch を作って PR で統合する。
- 1つのブランチでは、レビューとリリースを独立して扱える1つの目的に集中する。無関係な変更は別ブランチに分け、ブランチは短命に保つ。
- ブランチ名は短く内容が分かる小文字の kebab-case にする。例: `feat/add-search`、`fix/login-timeout`、`docs/update-setup`、`chore/refresh-deps`。Issue 番号を含める場合は、リポジトリの既存形式に合わせる。
- 作業開始時に最新の既定ブランチからブランチを作成する。

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/add-search
```

- 作業をリモートに初めて push するときは upstream を設定する。

```sh
git push -u origin feat/add-search
```

- すでに他の人と共有したブランチの履歴を書き換えない。履歴の書き換えや force push が必要な場合は、先に共同作業者とリポジトリのルールを確認する。
- 可能であれば、GitHub のブランチ保護または ruleset で PR と必要な status checks を要求する。設定の変更はリポジトリ管理者が行う。

## コミットメッセージ

Conventional Commits を使い、type と scope は英語、要約と本文は日本語にする。scope は必要な場合に付ける。

```text
<type>(<scope>): <日本語の要約>

<必要な場合のみ、変更の背景や理由を日本語で記載>

<必要な場合のみ footer>
```

よく使う type は `feat`（機能追加）、`fix`（不具合修正）、`docs`（文書）、`test`（テスト）、`refactor`（リファクタリング）、`perf`（性能改善）、`ci`（CI）、`build`（ビルド）、`chore`（その他の保守作業）。変更の性質に合うものを選び、無関係な変更を1つのコミットに混ぜない。

```text
feat(auth): ログイン処理を追加
fix(api): 空の応答を処理
docs(setup): 初期設定手順を更新
```

- 要約は変更の目的が伝わる短い文にする。本文は要約だけでは分からない背景・理由・影響を説明し、単なる差分の言い換えは避ける。
- 破壊的変更は type の直前に `!` を付けるか、footer に `BREAKING CHANGE: <日本語での説明>` を記載する。例: `feat(api)!: 認証 API を変更`。
- Issue をマージ時に閉じる場合は footer に `Closes #123` を記載する。関連を示すだけで閉じない場合は `Refs #123` などを使う。

## Worktree

Worktree は、現在の作業ディレクトリを切り替えずに別ブランチの作業場所を追加したい場合に使う。並行作業、レビュー、緊急修正などに便利だが、必須の手順ではない。

```sh
git fetch origin
git worktree add -b feat/add-search ../project-add-search origin/main
git worktree list
```

既存ブランチを別の作業場所で開く場合は `git worktree add <path> <branch>` を使う。`origin/main` は実際の既定ブランチに合わせる。

- Worktree ごとに作業ファイル、index、`HEAD` は分かれているが、Git のオブジェクトやブランチ参照は共有される。
- 1つのブランチを同時に複数の worktree で checkout することはできない。Git が拒否した場合は、別のブランチを作るか、既存の worktree を使う。
- 不要になった worktree は、未コミット変更がないことを確認してから `git worktree remove <path>` で削除する。未コミット変更を残したまま強制削除するために `--force` を付けない。
- `git worktree remove` が削除するのは作業場所であり、ブランチは残る。PR のマージと作業内容の保持を確認してからブランチを別途整理する。Squash merge 後に `git branch -d` が未マージと判定する場合があるため、理由を確認せず `-D` で強制削除しない。

## Pull Request

- PR は1つの目的に絞り、変更の背景と影響がレビューできる大きさに保つ。作業中に早めの相談が必要なら Draft PR として開き、レビューを正式に依頼できる状態になってから Ready for review にする。
- PR の base branch が意図した対象（通常は既定ブランチ）であることを確認する。タイトルと説明は日本語を標準とする。Squash merge を使う場合は、タイトルを squash commit に再利用できる Conventional Commits 形式にする。
- 本文には目的、主な変更、実行した検証を記載する。個別作業 Issue に対する PR では、原則として `Closes #123` を記載する。人間レビュアーが PR を承認・マージすることで Issue が連動してクローズされ、これが人間による Issue 完了承認となる（AI はコマンド等で直接 Issue をクローズしない）。設計書内に将来の課題や保留事項が記録されていても、その Issue の作業範囲（設計書の初版作成など）が完了していれば `Closes #123` とする。`Refs #123` は、1つの Issue を意図的に複数 PR に分割して作業しており、当該 PR 単体では Issue 完了とならない場合に限って使用する。

```markdown
## 目的

この変更が必要な理由

## 変更内容

- 主な変更点

## 検証

- 実行したテストやチェック

Closes #123
```

### Issue 対応とレビューコメントの収束（タスク完了ゲート）

- Issue 対応は「Issue の完了条件を確認 → 実装・テスト → PR 作成 → PR reviewer agent によるレビュー → コメントへの対応と返信 → 再レビュー・スレッド解決 → 人間承認待ち」の順で進めます。PR を作成した時点では作業完了とはならず、以下の **タスク完了ゲート** をすべて満たした時点で作業完了報告を行います：
  1. **静的検査・工程別自動テスト**: `npm run typecheck`、`npm run lint`、`npm run format:check` と、現在のウォーターフォール工程で必須のテストが PASS していること。C・UT 個別課題では `npm run test:unit` とリポジトリテストを必須とし、`npm run test:it` は IT 工程開始後に必須化する。全工程の集約確認には `npm test` を使用する。
  2. **VRT 整合性**: Storybook ストーリーを追加・変更した場合、`npm run test:vrt:update` でスナップショットを生成し、`npm run test:vrt` が PASS していること。
  3. **PR 作成**: 原則 `Closes #N` を明記して作成すること。
  4. **GitHub Actions**: リモート上で現在の工程に必要な CI および VRT ワークフローがすべて PASS していること。IT ワークフローは IT 工程開始後に必須化する。
  5. **独立レビュー**: [PR reviewer agent](../../agents/pr-reviewer.agent.md) による独立コードレビューを実施し、指摘事項が PR に記録されていること。
  6. **指摘是正・スレッド収束**: 指摘に対する修正コミットを行い、再レビューを経てすべての指摘コメントスレッドが解決（Resolved）されていること。
  7. **人間承認待ち**: AI は Issue の直接クローズや PR の承認・マージを行わず、人間のマージを待機すること。
- reviewer agent は指摘を該当差分のインラインコメントとして投稿します。差分行に結び付けられない場合、または指摘がない場合は、PR に通常のレビューコメントを投稿します。コメント投稿権限がない場合は未投稿であることを明示し、記録済みと扱いません。
- 実装者は各指摘に対し、修正コミット・検証結果または対応しない理由を元のコメントスレッドに返信します。reviewer agent は最新差分を再確認し、同じスレッドで解消確認または未解決理由を返します。修正を確認できたスレッドだけを解決し、ブロッカーや合意待ちを黙って閉じません。
- 対応可能な指摘が解消し、必要なチェックが通るまでコメントのやり取りを続けます。作業分割により後続 PR が必要な場合を除き、PR 本文には `Closes #N` を設定して人間のマージによる同期クローズを待機します。未解決の受け入れ条件が残り PR を分割する場合は `Refs` を用いて Issue を開いたままにします。
- reviewer agent はコメントの投稿・返信・確認済みスレッドの解決を行えますが、PR の承認・マージは行いません。最終承認とマージは人が判断します。

- リポジトリで要求される review、status checks、会話の解決などを確認してからマージする。CI が失敗した場合は原因を確認して修正し、失敗を無視して進めない。
- マージ方式はリポジトリ設定とチーム方針を優先する。特に指定がなければ、PR 単位で履歴を追いやすい Squash merge を推奨する。Squash commit のメッセージも日本語の Conventional Commits 形式にする。
- マージ後は不要になったリモート topic branch を削除する。Worktree を使っていた場合は、作業が不要であることを確認して `git worktree remove <path>` で片付ける。
- PR の承認やマージに関する権限・ルールはリポジトリの指示に従う。このスキルは、それらの操作を許可するものではない。

## Hooks と CI

Git hook は速く、安定し、ローカルで早く結果を得る価値があるチェックに使う。CI は全コントリビューターに対する共有・再現可能な確認や、マージ前に必須とするチェックに使う。必須チェックをローカル hook だけに依存させず、両方で実行する場合は速度と重複コストを考慮する。

どのチェックを hook、CI、または両方で実行するかは、[Git Hook and CI Guidance](../hook-ci-guidance/SKILL.md) に従って判断する。このスキルだけを根拠に hook の導入、既存 hook の変更、CI の追加を行わない。

## 参考資料

- [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [Pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests)
- [Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request)
- [Merging a pull request](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request)
- [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [git-worktree](https://git-scm.com/docs/git-worktree)
