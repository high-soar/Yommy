# Project Agent Guidelines

Welcome to `react-practice-notes`, a React and TypeScript learning repository based on `dev-template`. It retains the development environment and AI tooling for both **Google Antigravity** and **GitHub Copilot**.

## 1. Environment & Architecture

- **Environment**: VS Code DevContainer (Debian/Ubuntu based)
- **Runtimes**: Node.js 24, npm
- **CLI Tools**: GitHub CLI (`gh`), GitHub Copilot CLI (`@github/copilot`), ripgrep (`rg`), Playwright (`@playwright/test` / Chromium)
- **System Packages / Fonts**: DejaVu Sans (`fonts-dejavu-core` for VRT rendering parity with GitHub Actions)
- **AI Tooling**: Google Antigravity extension, GitHub Copilot Chat

---

## 2. AI Configuration & SSOT (Single Source of Truth) Architecture

To avoid duplication across AI assistants, this repository follows a unified configuration strategy:

| Component                | Source of Truth (SSOT)           | Antigravity Integration             | GitHub Copilot Integration                       |
| :----------------------- | :------------------------------- | :---------------------------------- | :----------------------------------------------- |
| **Rules / Instructions** | `AGENTS.md` (this file)          | Natively loaded from workspace root | Referenced via `.github/copilot-instructions.md` |
| **Skills**               | `.github/skills/<name>/SKILL.md` | Mapped via `.agents/skills.json`    | Natively loaded from `.github/skills/`           |
| **Custom Agents**        | `.github/agents/<name>.agent.md` | Accessible as agent templates/rules | Natively loaded from `.github/agents/`           |

---

## 3. General Development Rules

- **Coding Conventions**: Follow standard clean-code principles, TypeScript/JavaScript best practices where applicable. Write unit test descriptions (`it`) and Storybook story display names/descriptions in Japanese, adhering to the [C・UT workflow skill](.github/skills/c-ut-workflow/SKILL.md).
- **Git Commits**: Use English Conventional Commits types with Japanese summaries and bodies (e.g., `feat: ログイン処理を追加`). Follow the [Git/GitHub workflow skill](.github/skills/git-workflow/SKILL.md) for the commit template and default workflow.
- **Pull Request Reviews & Completion Gate**: Report only actionable, evidence-based findings, ordered by impact and grounded in specific changed code. Format review comments according to [docs/review-comment-format.md](docs/review-comment-format.md). Keep review findings and author responses on the PR, and re-review fixes until actionable comment threads converge. For individual task issues, configure PRs with `Closes #N` so that when a human approves and merges the PR, the issue closes in synchronization, serving as human approval of issue completion. AI agents must not close issues directly via commands or approve/merge PRs; those decisions remain with a human. Use `Refs #N` only when intentionally splitting work across multiple PRs where the current PR does not complete the issue. Follow the [Git/GitHub workflow skill](.github/skills/git-workflow/SKILL.md) and, for waterfall work, the [waterfall task-management skill](.github/skills/waterfall-github-task-management/SKILL.md). Do not report task completion upon mere PR creation. An individual task issue is complete only after passing the **Task Completion Gate**:
  1. Static checks (`npm run typecheck`, `npm run lint`, `npm run format:check`) and automated tests for the active waterfall phase PASS. For individual C・UT issues, this means `npm run test:unit` and repository tests; IT runs become blocking in the IT phase.
  2. If Storybook stories were added/modified, VRT snapshots are updated (`npm run test:vrt:update`) and verified (`npm run test:vrt`) PASS.
  3. PR is created with `Closes #N`.
  4. GitHub Actions required for the active phase (CI and VRT; IT when the IT phase begins) PASS.
  5. Independent PR Review is conducted by the [PR reviewer agent](.github/agents/pr-reviewer.agent.md).
  6. All actionable review threads are fixed, re-reviewed, and resolved.
  7. Human approval & merge awaited.
- **Context Management & Subagent Orchestration**: To prevent main session context exhaustion and compaction degradation, the main agent should act as an orchestrator (task breakdown, subagent delegation, result aggregation, PR creation, and review coordination). Delegate bulk implementation, TDD Red-Green cycles, heavy test runs, and review fixes to general subagents (`self`) referencing the relevant skills (e.g., `c-ut-workflow`). Do not define redundant dedicated agent files for coding/testing; leverage `self` with explicit skill instructions to maintain SSOT and minimize configuration maintenance costs. By default, delegate sequentially to avoid test interference and Git lock contention in shared workspaces; if parallelizing, isolate workspaces or strictly scope test execution to target files.
- **Compaction Recovery Protocol**: When context compaction occurs during a long-running session, the agent must not rely solely on the generated summary's `Next Steps`. Instead, re-verify the current progress against the **Task Completion Gate** above to identify any omitted workflow steps before declaring completion.
- **Phase Final Reviews**: For a broad cross-deliverable review before closing a waterfall phase, use the [phase final reviewer agent](.github/agents/phase-final-reviewer.agent.md) and the [phase-final-review skill](.github/skills/phase-final-review/SKILL.md). It coordinates bounded read-only reviewers, verification resources, and consolidated reporting on the tracking issue in accordance with [docs/review-comment-format.md](docs/review-comment-format.md); only a human approves the phase.
- **Configuration Maintenance**: When modifying or adding configurations (`.devcontainer/`, `.agents/`, `.github/`, `AGENTS.md`), always consult the **`repo-config-management`** skill.

## 4. Waterfall Development Workflow

Follow the workflow and document structure in [docs/README.md](docs/README.md) and the [waterfall task-management skill](.github/skills/waterfall-github-task-management/SKILL.md).

- Follow ED → ID → C・UT → IT → PT in order. Review and approve each phase's deliverables before starting the next phase.
- Before starting a phase, read `docs/README.md` and the relevant approved design documents.
- **Artifact Status Lifecycle**: 成果物の状態は `Draft (Step N)`、`Review (Step N)`、`Approved (Step N)` で管理します。前 Step で承認された成果物は新 Step 開始時点では `Approved (Step N-1)` のベースラインを維持し、現 Step 未改修であることを明示します。個別タスク Issue および PR は成果物を `Review (Step N)` 状態（決して `Approved` にしない）で完了します。フェーズ全体の工程承認 Issue において人間承認を受けた段階で、対象工程の全成果物を一括で `Approved (Step N)` に昇格します。ただし、承認済み成果物に対する手戻り是正 PR は、人間による PR レビュー・マージ（局所的再承認）をもって即座に `Approved (Step N)` に復帰します。
- Do not start C・UT until the relevant ID design documents are approved. Treat unresolved requirements or API contracts as open questions instead of inventing assumptions.
- In the C・UT phase, follow the [C・UT workflow skill](.github/skills/c-ut-workflow/SKILL.md) for TDD workflow, test co-location, MSW mock guidelines, and UT/IT boundaries.
- **Quality Analysis, Defect Recording & Design Sync**: In testing phases (C・UT, IT, PT), track defects identified during AI work in dedicated evidence sheets (`docs/<phase>/evidence/*-bug-record.md`) separating production code from supporting artifacts. In each phase-approval issue, generate a comprehensive quality analysis report (`docs/<phase>/quality/stepN.md`) measuring defect density and cross-phase Defect Removal Efficiency (DRE). When a defect is categorized as `D` (Design / Specification defect), **never fix code alone; synchronize the fix to the relevant design documents (ED/ID/OpenAPI)** and record both code and design correction commits/PRs in the bug record sheet. Conduct impact analysis across upstream and downstream deliverables and notify related issues.
- **IT Scenario Design & System-wide Regression Guarantee**: In the integration test (IT) phase of each Step, test scenarios must not only verify new or modified features in isolation, but must encompass and evolve all previously developed features to conform to the current Step's architecture (e.g. authentication, common layout, data model), forming a unified test suite (`SCN-01` onward) that guarantees end-to-end behavior and regression protection across the entire system. Previous IT tests must not be isolated under separate prefixes or left failing; all tests in `test/it/` must 100% PASS upon completion of the IT phase.
- Treat AI-generated requirements, designs, code, and tests as drafts until reviewed by a human. Do not approve a phase on the user's behalf.
