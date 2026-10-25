---
name: ponytail
description: "Use when the user explicitly asks for Ponytail, YAGNI-focused implementation, or the simplest/minimal solution, or during TDD Green steps to avoid speculative over-engineering."
argument-hint: "[lite|full|ultra]"
license: MIT
---

# Ponytail

Adapted from the core skill at [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail/tree/main/skills/ponytail). The upstream README identified the reviewed release as v4.10.0 on 2026-09-25. See [LICENSE](LICENSE) for the required MIT notice. This version narrows activation to explicit use and preserves repository-required checks and user-requested explanations.

## Activation and Scope

- This skill is optional. Apply it when the user requests Ponytail, a YAGNI-focused approach, or a minimal solution, or when keeping TDD Green steps minimal.
- The default intensity is **full**. If the user supplies `lite`, `full`, or `ultra` as an argument to this skill, use that intensity for the current request.
- Apply it to the current task only. Do not claim it persists across turns or sessions after it is no longer active.
- If the user says "stop ponytail" or "normal mode," stop applying it. Do not promise an unsupported `/ponytail off` command.
- This skill governs implementation choices, not the user's requested scope, response format, or level of explanation.

## The Simplicity Ladder

After understanding the problem and tracing the relevant code path, stop at the first option that safely solves it:

1. **Does the change need to exist?** Avoid speculative work; explain when the request has no demonstrated need.
2. **Does the repository already provide it?** Reuse a suitable helper, type, or established pattern.
3. **Can the standard library do it?** Prefer a standard capability over custom code.
4. **Does the platform already provide it?** Prefer a native browser, runtime, database, or operating-system feature when it fits.
5. **Can an installed dependency solve it?** Do not add a dependency for a small capability already available in the project.
6. **Can the implementation be simpler without losing correctness?** Prefer a direct solution over unnecessary layers.
7. **Otherwise**, implement the smallest complete solution that meets the request.

The ladder is a decision aid, not a reason to research endlessly or skip understanding. When fixing a bug, trace relevant callers and address the shared root cause when that is the correct, smaller change.

## Rules

- Do not add unrequested abstractions, configuration, scaffolding, or speculative extension points.
- Prefer deletion and boring, readable solutions when they preserve required behavior.
- Keep the change focused, but do not choose a smaller patch that leaves the root problem or a sibling path broken.
- When a complex request admits a simpler option, explain the tradeoff and let the user choose; do not silently omit an explicit requirement.
- When equally small approaches differ in correctness, choose the one that handles relevant edge cases.
- If a deliberate simplification has a meaningful limitation, document the limitation and a concrete upgrade trigger where future maintainers will see it.

## Intensity

| Level     | Approach                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **lite**  | Fulfill the request and mention a simpler alternative when it materially matters.                                                       |
| **full**  | Prefer the simplest safe implementation that fully meets the request. This is the default.                                              |
| **ultra** | Apply YAGNI aggressively; surface any conflict between the requested scope and a smaller alternative instead of silently dropping work. |

## When Not to Simplify

- Do not remove input validation at trust boundaries, error handling that prevents data loss, security or privacy protections, accessibility, or reliability needed for the stated behavior.
- Do not omit requirements the user explicitly asked for or weaken repository instructions, CI gates, or required tests (such as the 3-layer adapter boundaries and 1-to-1 Story/UT rules in `docs/guidelines/testing.md`).
- For non-trivial logic, run the smallest relevant check and the quality gates required by the repository. A tiny self-check does not replace a required test suite.
- If the user requests a full explanation, report, or walkthrough, provide it. Concision is not a reason to withhold requested information.

The shortest path to completion is the simplest solution that remains correct, safe, testable, and complete.
