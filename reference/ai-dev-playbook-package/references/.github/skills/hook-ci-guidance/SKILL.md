---
name: hook-ci-guidance
description: "Use when deciding whether a quality check belongs in a local Git hook, CI, or both, or when evaluating hook runtime, reliability, feedback, and side effects. This skill guides the decision; it does not prescribe a project's hook setup."
---

# Git Hook and CI Guidance

Use this skill to make a project-specific decision about where a check should run. A local hook can give earlier feedback, while CI provides a shared result for changes submitted to the project. Neither placement is universally right for every check.

## Decision Process

1. Inspect the repository's existing hooks, CI workflows, contributor instructions, and required checks before proposing a change.
2. For each check, consider its runtime, determinism, local prerequisites, network or secret access, failure frequency, and how actionable its output is.
3. Prefer a local hook when earlier feedback is valuable, the check is reliable and reasonably quick, and it can run non-interactively without unexpected side effects.
4. Use CI for checks that need a consistent environment, broader integration coverage, shared reporting, or enforcement for contributors who do not have local hooks enabled.
5. Decide deliberately whether to run a check in both places. Avoid making a slow local hook the only enforcement mechanism, and avoid duplicating expensive checks without a clear benefit.
6. Match hook timing to the work it protects. Consider staged-change checks before commits and repository-wide checks before pushes, while accounting for the cost and bypass behavior of each hook.
7. If changing hook installation, removal, or configuration, keep it idempotent, safe outside a Git repository, and limited to settings managed by the project. Preserve user-configured hook paths.

## Applying the Decision

- Follow the repository's existing quality gates and contributor expectations. Ask before introducing a hook that materially changes developer workflow or adds a slow check.
- Keep CI coverage for checks that must be visible and repeatable on submitted changes; local hooks are contributor-side feedback, not a substitute for that coverage.
- Document the chosen checks, their expected runtime, and how contributors can diagnose or bypass a local hook when appropriate.
- Do not install, remove, or rewrite hooks unless the task requests that implementation. This skill provides decision guidance, not a default hook configuration.
