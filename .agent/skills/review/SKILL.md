---
name: review
description: Acts as a Devil's Advocate to critically review design documents and code. Focuses on fatal defects, logical contradictions, and lack of concreteness. Manages the lifecycle of review comments.
---

# Review Skill

This skill manages a structured code/document review process with two distinct roles: **Reviewer** and **Reviewee**.

## Roles

Each role is defined in a separate file. **Read only the role file relevant to the current step.**

| Role | File | When to Read |
|------|------|-------------|
| Reviewer | [reviewer.md](references/roles/reviewer.md) | Step 1 (レビュー依頼), Step 3 (修正確認) |
| Reviewee | [reviewee.md](references/roles/reviewee.md) | Step 2 (レビュー修正) |

## Review Viewpoints

See [viewpoints.md](references/viewpoints.md) for detailed review criteria and categories:

1. **Fatal Defect (致命的な欠陥)**
2. **Logical Contradiction (論理的矛盾)**
3. **Lack of Concreteness (具体性の欠如)**

## Directory Structure

Review comments are project assets stored at the **project root**:

```
<project_root>/
└── review/
    ├── Pending/        # Step 1: レビュー指摘（未修正）
    ├── In-Progress/    # Step 2: 修正済み（確認待ち）
    └── Complete/       # Step 3: 完了
```

## Workflow

### Step 1: レビュー依頼（Reviewer）

**Role**: [reviewer.md](references/roles/reviewer.md) を読み込む。

1. レビュー対象ファイルを精読する。
2. [viewpoints.md](references/viewpoints.md) のレビュー観点を確認する。
3. Gitリポジトリ内であれば `git rev-parse HEAD` で Commit ID を取得する。
4. Devil's Advocateペルソナで分析し、レビューコメントを生成する。
5. コメントファイルを `review/Pending/` に保存する。
   - ファイル名: `review_<対象ファイル名>_<YYYYMMDD_HHmmss>.md`

### Step 2: レビュー修正（Reviewee）

**Role**: [reviewee.md](references/roles/reviewee.md) を読み込む。

1. `review/Pending/` からレビューファイルを読む。
2. 対象ファイルを修正する。
3. レビューファイルを更新する（Response, 水平展開を記入）。
4. レビューファイルを `review/In-Progress/` に移動する。
5. レビュアーに修正完了を通知する。

### Step 3: 修正確認（Reviewer）

**Role**: [reviewer.md](references/roles/reviewer.md) を読み込む。

1. `review/In-Progress/` からレビューファイルを読む。
2. 修正内容と水平展開の妥当性を確認する。
3. `Reviewer Verification` セクションを記入する。
4. 判定:
   - **全コメントOK** → Status を Resolved に変更。ファイルを `review/Complete/` に移動。
   - **NGあり** → 再コメントを記載。ファイルを `review/Pending/` に移動。Step 2 に戻す。

**IMPORTANT**: レビューファイル以外のファイルを修正してはならない。

## Review File Format

```markdown
# Review Report

*   **Target File**: <Absolute Path to File>
*   **Review Date**: <YYYY-MM-DD HH:mm:ss>
*   **Commit ID**: <Commit ID or "Uncommitted">

## Comments

### 1. <Title of the Issue>
*   **Category**: <Fatal Defect / Logical Contradiction / Lack of Concreteness>
*   **Location**: <Line Number or Section>
*   **Critique**:
    <Critical comment content>
*   **Status**: Open
*   **Response**:
    （レビューイが記入: 修正内容の説明、または反論の理由）
*   **Horizontal Deployment (水平展開)**:
    *   **Required**: Yes / No
    *   **Details**: （Yes: 対象ファイルと変更内容 / No: 不要の理由）
*   **Reviewer Verification (修正確認)**:
    *   **Fix Result**: OK / NG
    *   **Horizontal Deployment Check**: OK / NG / N/A
    *   **Re-comment**: （NGの場合の再コメント）

### 2. <Title of the Issue>
...
```

## Instructions for Claude

- ステップに応じて対応するロールファイルのみを読み込むこと。
- レビュー時は厳格かつ徹底的に批評すること。
- **出力言語**: レビューコメントは **日本語** で記述すること。
- Step 1 では `review/Pending/` にファイルを保存すること。
- Step 3 で全コメントが Resolved の場合のみ `review/Complete/` に移動すること。
