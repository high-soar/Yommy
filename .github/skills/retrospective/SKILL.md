---
name: retrospective
description: "Use this skill when a session had repeated failed attempts, user corrections or negative feedback, or an explicit request for a retrospective; skip routine lint, test, type-check, hook, or CI failures resolved by existing safeguards."
---

# セッション振り返り（Retrospective & Kaizen）

セッション中の事実を確認し、再発防止につながる問題だけを分類して `docs/guidelines/`、`AGENTS.md`、または `.github/skills/*/SKILL.md` の改善へつなげます。振り返りの目的は失敗を列挙することではなく、次回の作業を変えられる具体的な改善点を見つけることです。

---

## 1. 実行条件と事前切り分け

次のいずれかに該当するときに実行します（通常の TDD ループ内の Red や、既存の lint/typecheck/テストが一発で検出してその場で直せた通常の失敗では実行しません）。

- ユーザーが明示的に振り返りを依頼した。
- ユーザーが誤解、不要な変更、説明不足、規約違反（例: いきなり実装を始めた、親子分離違反、原因 `D` の設計書未同期など）を指摘し、作業をやり直した。
- 同じ調査や編集を複数回やり直した、または誤った仮説から抜け出すために大きな手戻りが発生した。
- 既存の `docs/guidelines/` や `SKILL.md` の記述不足により、再発可能な問題が見つかった。

---

## 2. 振り返り手順

### Step 1: 範囲と事実の特定

- 対象ブランチ、Issue/PR、問題が発生した作業・変更ファイル・コマンド、およびユーザーの指摘内容を特定する（推測で事実を作らない）。
- セッション履歴やサブエージェントを起動していた場合は、期待された結果と実際の結果、見落としや誤った仮説を整理する。

### Step 2: 根本原因の整理

各問題について以下を明確化する：

- **事実**: 何が起きたか（失敗コマンド、再編集、ユーザー指摘）。
- **影響**: 余計にかかった手戻り作業や見落とした検証。
- **根本原因**: `docs/guidelines/` のルール未読、スキル手順の不備、3層境界や Capacitor 仕様の誤認、検証抜けなど。
- **具体策**: 「次回から注意する」といった精神論ではなく、**どのファイル（`docs/guidelines/*.md`, `AGENTS.md`, `.github/skills/<name>/SKILL.md` 等）のどの手順・チェックリストをどう変えるか** まで具体化する。

### Step 3: 3分類と反映判断

1. **分類 1: 本リポジトリ（Yommy）に反映すべき問題**:
   - Yommy 固有のガイドライン（`docs/guidelines/`）、仕様書（`docs/specs/`）、スキル（`.github/skills/`）、またはテスト/CI 設定に原因がある問題。
2. **分類 2: 汎用プレイブック・テンプレートにも反映すべき問題**:
   - 共通の AI 設定、汎用スキル（`git-workflow`, `phase-final-review`, `repo-config-management` 等）、または DevContainer 構成に原因があり、他リポジトリでも再発し得る問題。
   - 必要に応じて `.github/retrospective/TEMPLATE_RETROSPECTIVE_HANDOFF.md` に自己完結した引継ぎメモを作成できる（恒久ログとしては残さず、処理後に削除し `.gitkeep` のみ残す）。
3. **分類 3: 反映不要**:
   - 一時的な外部ネットワーク障害や再現性のない偶発事象、すでに解決済みで規約追加がノイズになるもの。

### Step 4: 正本・スキルの更新（二重管理の防止）

ユーザーが「反映して」「改善して」と指示した場合（または Milestone 末の Kaizen タスク内である場合）、以下の方針でファイルを更新します：

- **人間も共有すべき開発ルール・テスト基準の改善**: `docs/guidelines/workflow.md` または `docs/guidelines/testing.md` を更新する。
- **AI 固有のオーケストレーション・実行手順の改善**: `.github/skills/<name>/SKILL.md` または `AGENTS.md` を更新する（`.agents/skills/` には重複ファイルを作らない）。

---

## 3. 出力形式

振り返り結果は次の順序で簡潔に報告します：

1. **対象**: ブランチ、対象タスク、確認範囲
2. **事実と根本原因**: 起きた事象、手戻りの影響、根本原因
3. **分類結果と改善案**: 分類（1 / 2 / 3）、変更対象ファイル、具体的な追記・修正内容
4. **反映と検証**: 実施したファイル変更（または提案）と確認結果
