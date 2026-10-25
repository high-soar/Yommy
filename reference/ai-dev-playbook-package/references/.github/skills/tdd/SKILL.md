---
name: tdd
description: "Use when the user explicitly requests Test-Driven Development, test-first implementation, or Red-Green-Refactor, or when repository guidance requires that workflow. It is not a blanket requirement for every change."
---

# Test-Driven Development

Use this workflow when test-first development is requested or required. Having this skill available does not make it mandatory; a project that requires it should say so in `AGENTS.md` or a project-specific agent.

## Workflow

1. **Inspect the local test practice**: Read repository instructions, nearby tests, and the existing test command. Reuse the current framework, helpers, naming, and test location.
2. **Choose observable behavior**: Turn the requirement or reproducible bug into the smallest focused test that checks the expected behavior, including a relevant edge case when needed.
3. **Red**: Run the focused test before implementation. Confirm it fails for the intended behavioral reason, not because of a broken test, missing dependency, or unrelated environment problem.
4. **Green**: Make the smallest implementation change that satisfies the test. Avoid unrelated refactoring and speculative behavior.
5. **Refactor**: Improve the changed code only while preserving the passing behavior. Keep tests focused on the contract rather than private implementation details.
6. **Verify**: Rerun the focused test, then run the broader checks required by the repository and appropriate to the change. Use the project's commands; do not impose a framework or language-specific command.
7. **Report**: State which checks passed and disclose tests or gates that were unavailable. Never claim Red or Green was verified if the corresponding run did not complete.

## Boundaries

- Respect explicit user requirements and repository-specific quality gates; a small test must not replace a required suite.
- If the behavior cannot be meaningfully tested or the test environment is unavailable, explain the limitation and use the narrowest valid alternative without claiming full TDD verification.
- Do not add a test framework, dependency, or test-only abstraction when the repository already provides a suitable way to verify the behavior.
