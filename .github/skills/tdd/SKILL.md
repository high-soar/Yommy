---
name: tdd
description: "Use when performing Test-Driven Development (Red-Green-Refactor). For Yommy's project-specific 3-layer TDD rules, coverage standards, and commit conventions, combine this with docs/guidelines/testing.md and c-ut-workflow."
---

# Test-Driven Development (Core Cycle)

Use this workflow as the foundational Red-Green-Refactor discipline. In the Yommy repository, always apply this together with [docs/guidelines/testing.md](../../../docs/guidelines/testing.md) and the [c-ut-workflow skill](../c-ut-workflow/SKILL.md).

## Workflow

1. **Inspect the specification and test rules**: Read the approved specification in `docs/specs/` and the layer-specific rules in [docs/guidelines/testing.md](../../../docs/guidelines/testing.md).
2. **Choose observable behavior**: Turn the acceptance criterion (`AC-xx`) or reproducible bug into a focused unit test (or Storybook story + Portable Story test) that checks expected behavior and boundary conditions.
3. **Red**: Run the focused test before implementation. Confirm it fails for the intended behavioral reason, not because of syntax errors or broken setup. Commit the failing test (`test(<scope>): ...（Red）`).
4. **Green**: Make the smallest implementation change that satisfies the test (YAGNI). Run the test to confirm it passes, and commit (`feat(<scope>): ...（Green）` or `fix(<scope>): ...（Green）`).
5. **Refactor**: Improve structure, readability, and type safety while preserving the passing behavior. Rerun the test and commit (`refactor(<scope>): ...（Refactor）`).
6. **Verify**: Run the full required suite (`typecheck`, `lint`, `format:check`, `test:coverage` for 100% C0/C1/Functions, and `test:vrt` when UI changes).
7. **Report & Record**: State which checks passed and record any defects discovered after initial Red in [docs/quality/bug-and-handover-log.md](../../../docs/quality/bug-and-handover-log.md). Never claim Red or Green was verified if the corresponding run did not complete.
