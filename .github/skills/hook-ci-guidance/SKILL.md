---
name: hook-ci-guidance
description: "Use when deciding whether a quality check belongs in a local Git hook (.githooks/), CI (.github/workflows/), or both, or when evaluating hook runtime, reliability, feedback, and side effects."
---

# Git Hook and CI Guidance

Use this skill (primarily from Phase 3 onward) to make a project-specific decision about where a quality check should run. A local hook gives fast contributor-side feedback, while CI provides a shared, reproducible gate on pull requests.

## Decision Process

1. Inspect the repository's existing hooks (`.githooks/`), CI workflows (`.github/workflows/`), [docs/guidelines/workflow.md](../../../docs/guidelines/workflow.md), and [docs/guidelines/testing.md](../../../docs/guidelines/testing.md).
2. For each check (`typecheck`, `lint`, `format:check`, `test:unit`, `test:coverage`, `test:vrt`, `test:it`, Android APK build), evaluate its runtime, determinism, local prerequisites, and how actionable its output is.
3. Prefer a local hook (`pre-commit` / `pre-push`) when earlier feedback is valuable, the check is reliable and fast (e.g., `format:check`, `lint`, `typecheck`, `test:unit`), and it runs non-interactively without unexpected side effects.
4. Use CI for checks that require a consistent environment, heavier browser/snapshot verification (`test:vrt`, `test:it`), or enforcement across all pull requests as part of the **Task Completion Gate**.
5. Decide deliberately whether to run a check in both places. Avoid making slow checks (such as full Storybook VRT or Playwright E2E) block every `git commit`, while keeping `pre-push` or CI responsible for full verification.
6. Keep hook installation idempotent (`git config --local core.hooksPath .githooks`), safe outside a Git repository, and limited to settings managed by the project.

## Applying the Decision

- Follow the repository's quality gates in [docs/guidelines/workflow.md](../../../docs/guidelines/workflow.md#4-task-completion-gate7つの完了条件).
- Keep CI coverage for all checks required by the Task Completion Gate; local hooks are early feedback, not a substitute for CI verification.
- Document the chosen hooks and CI workflows clearly when introducing or updating them in Phase 3.

