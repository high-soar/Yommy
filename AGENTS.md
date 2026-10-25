# Project Agent Guidelines (Yommy)

Welcome to **Yommy**, an Android Web Novel Reader application built with **React (TypeScript / Vite) + Capacitor**.
This repository maintains a unified Single Source of Truth (SSOT) configuration for both **Google Antigravity** and **GitHub Copilot**.

---

## 1. Environment & Architecture

- **Environment**: VS Code DevContainer (Ubuntu-based)
- **Runtimes & Stack**: Node.js 24, npm, React, TypeScript, Vite, Tailwind CSS, Capacitor (`@capacitor/core`, `@capacitor-community/sqlite`)
- **CLI Tools**: GitHub CLI (`gh`), GitHub Copilot CLI (`@github/copilot`), ripgrep (`rg`), SQLite3 (`sqlite3`), Playwright (`@playwright/test` / Chromium)
- **System Fonts (Japanese VRT Parity)**: DejaVu Sans (`fonts-dejavu-core`), Noto CJK (`fonts-noto-cjk`), IPAex (`fonts-ipaexfont`), BIZ UD Mincho/Gothic (`fonts-morisawa-bizud-mincho`, `fonts-morisawa-bizud-gothic`), Klee (`fonts-klee`)
- **DevContainer vs. Host OS Boundary**:
  - Run Web builds, static checks, Vitest unit tests, Storybook VRT (1280px / 375px), Playwright IT, and `npx cap sync` inside the DevContainer.
  - Perform Android APK builds and emulator/device verification on the Host OS (Android Studio / `adb`) or GitHub Actions.

---

## 2. AI Configuration & SSOT Architecture

To prevent duplication between human rules and AI skills, and across AI assistants, this repository strictly separates responsibilities:

| Component                        | Source of Truth (SSOT)                 | Purpose & Integration                                                                                                                                                                                                                                                                                                                    |
| :------------------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Human & AI Shared Guidelines** | `docs/guidelines/*.md`                 | Canonical rules for workflow ([workflow.md](docs/guidelines/workflow.md)), 3-layer testing & TDD ([testing.md](docs/guidelines/testing.md)), and review formatting ([review-comment-format.md](docs/guidelines/review-comment-format.md)).                                                                                               |
| **Product Specifications (OKF)** | `docs/specs/*.md`                      | 2-Layer Living Documentation with OKF YAML frontmatter ([docs/index.md](docs/index.md)): **Canonical App Specs** (`requirements.md`, `architecture.md`, `db-schema.md`, `screen-transitions.md`, `features/*.md`, `parsers/*.md`) + **Per-Issue Delta Specs** (`changes/issue-XX-*.md`, archived to `changes/archive/` upon completion). |
| **Quality & Handover Log**       | `docs/quality/bug-and-handover-log.md` | Defect tracking (Production vs. Support, root causes `L`/`S`/`D`/`B`/`A`) and Handover items (`HO-xx`).                                                                                                                                                                                                                                  |
| **AI Root Constitution**         | `AGENTS.md` (this file)                | Loaded natively by Antigravity; bridged to GitHub Copilot via `.github/copilot-instructions.md`.                                                                                                                                                                                                                                         |
| **AI Workflow Skills**           | `.github/skills/<name>/SKILL.md`       | AI execution & subagent orchestration procedures referencing `docs/guidelines/`. Mapped for Antigravity via `.agents/skills.json`.                                                                                                                                                                                                       |
| **Custom Agents**                | `.github/agents/<name>.agent.md`       | Independent PR reviewer (`pr-reviewer`) and milestone final reviewer (`phase-final-reviewer`).                                                                                                                                                                                                                                           |

---

## 3. Core Development Rules & Issue-Driven Micro-Waterfall

Always read [docs/index.md](docs/index.md) and follow [docs/guidelines/workflow.md](docs/guidelines/workflow.md) and [docs/guidelines/testing.md](docs/guidelines/testing.md).

1. **Hybrid Phase Progression**:
   - **Phase 1 (AI Foundation) & Phase 2 (Core Specs)**: Collaborate with the user and commit directly to build the foundation and initial `docs/specs/` rapidly.
   - **Phase 3 (PoC / Walking Skeleton) & Phase 4+ (Iterative Feature Development)**: Follow the strict **Issue + PR + Independent AI Review (`pr-reviewer`) + Task Completion Gate (7 conditions)** workflow.
2. **Issue-Driven Micro-Waterfall (No Premature Coding)**:
   - Never jump straight into production code for a feature request.
   - Progress sequentially per feature: **① Open Questions Clarification → ② Design Update PR (create Delta Spec `docs/specs/changes/issue-XX-*.md` + update Canonical App Specs in `docs/specs/` in `Review` state + Sub-issue breakdown, merged by human to become `Approved`) → ③ MK PRs (TDD Red-Green-Refactor, 1-to-1 Story/UT, VRT) → ④ IT PR (Playwright `SCN-xx` system-wide regression, Handover resolution, and archiving the Delta Spec to `docs/specs/changes/archive/`)**.
   - Follow the [iterative GitHub task-management skill](.github/skills/iterative-github-task-management/SKILL.md).
3. **3-Layer Testing & Implementation Discipline**:
   - Follow [docs/guidelines/testing.md](docs/guidelines/testing.md) and the [C・UT workflow skill](.github/skills/c-ut-workflow/SKILL.md).
   - **Parser Layer**: Pure unit tests using local HTML fixtures (`__fixtures__/*.html`), zero live network calls.
   - **Storage Layer**: Abstract SQLite behind repository adapters; use deterministic in-memory DB initialized via `resetTestDb()` in UT/Storybook/IT.
   - **Viewer & Bridge Layer**: Enforce 1-to-1 `*.stories.tsx` and `*.test.tsx` (Portable Stories `composeStories`) for every `*.tsx`, strict parent-child test isolation, **100% C0/C1/Functions coverage**, and Storybook VRT (1280px / 375px including vertical writing `vertical-rl` and `<ruby>`).
   - **Japanese Naming & Commits**: Write Vitest `it` descriptions and Storybook display names/JSDoc in Japanese. Use English Conventional Commits types with Japanese summaries (e.g., `feat(parser): なろう小説のルビ抽出処理を実装`). Follow the [Git workflow skill](.github/skills/git-workflow/SKILL.md).
4. **Defect Recording & Design Sync (`D` Category)**:
   - Record defects found during TDD Green/Refactor, VRT/IT, or AI review in [docs/quality/bug-and-handover-log.md](docs/quality/bug-and-handover-log.md) and the PR body.
   - If a defect's root cause is **`D` (Design / Specification mismatch or omission)**, **never fix code alone**; update the corresponding `docs/specs/` document in the same PR and record both commits.

---

## 4. Context Management & Subagent Orchestration

- **Orchestrator vs. Worker Separation**:
  To prevent main session context exhaustion and compaction degradation, the main agent acts as an **orchestrator** (requirement analysis, task breakdown, subagent delegation, PR creation, and gate verification).
  Delegate heavy implementation, TDD Red-Green-Refactor cycles, test runs, and review fixes **sequentially** to general subagents (`self`) with explicit instructions to follow `.github/skills/c-ut-workflow/SKILL.md`.
- **Read-Only Research**:
  Use lightweight read-only `research` subagents (`flash` model when appropriate) for broad codebase or documentation surveys.
- **Compaction Recovery Protocol**:
  If context compaction occurs during a session, do not rely solely on the summary's `Next Steps`. Re-verify the current state against the **Task Completion Gate** below before reporting completion.

---

## 5. Task Completion Gate (7 Mandatory Conditions)

In Phase 3 and beyond, **never report a task or PR as complete merely upon creating a PR**. Every PR must pass all 7 gates defined in [docs/guidelines/workflow.md](docs/guidelines/workflow.md#4-task-completion-gate7つの完了条件):

1. **Static Checks & Automated Tests PASS**: `npm run typecheck`, `npm run lint`, `npm run format:check`, and required tests (`npm run test:unit`, `npm run test:coverage` with 100% C0/C1/Functions) PASS.
2. **VRT Parity PASS**: If UI/Storybook stories changed, VRT snapshots (1280px / 375px) are updated (`npm run test:vrt:update`) and verified (`npm run test:vrt`) PASS.
3. **PR Created with Issue Link**: PR includes the defect/handover mini-tables and `Closes #N` (`Refs #N` only for intermediate split PRs). **AI agents must never close issues directly or approve/merge PRs.**
4. **GitHub Actions PASS**: Required remote CI workflow (`quality-gate` covering static checks, UT, VRT, IT, and Build) PASS.
5. **Independent AI Review**: Conducted by the [PR reviewer agent](.github/agents/pr-reviewer.agent.md) adhering to [docs/guidelines/review-comment-format.md](docs/guidelines/review-comment-format.md).
6. **Review Thread Convergence**: All actionable review findings are fixed (including `docs/specs/` sync for cause `D`), re-verified, and resolved on the PR.
7. **Human Approval & Merge Awaited**: Report gate completion and wait for the human to review and merge.

---

## 6. Milestone Reviews & Continuous Improvement (Kaizen)

- At the end of Phase 3 (PoC) and each Mini-Release Milestone (`v0.1`, `v0.2`, etc.), run a cross-deliverable review using the [phase final reviewer agent](.github/agents/phase-final-reviewer.agent.md) and [phase-final-review skill](.github/skills/phase-final-review/SKILL.md), followed by quality metrics analysis (DRE, defect cause trends) and skill/guideline updates.
- **Multi-Model Orchestrator Reviews**: To leverage differing model perspectives (breadth, architectural depth, latent bug detection), running multiple orchestrators across different LLM models is supported. Each orchestrator verifies existing issue comments prior to posting, submits an independent follow-up comment thread identifying its model name, and maintains sequential, non-colliding finding IDs (`R1-01`, `R1-02`...).
- When modifying repository/AI configurations (`.devcontainer/`, `.agents/`, `.github/`, `AGENTS.md`), always follow the [repo-config-management skill](.github/skills/repo-config-management/SKILL.md).
- When a session experiences repeated rework or user corrections, use the [retrospective skill](.github/skills/retrospective/SKILL.md).
