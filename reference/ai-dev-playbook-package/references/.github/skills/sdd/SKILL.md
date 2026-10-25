---
name: sdd
description: "Use when the user explicitly requests Spec-Driven Development, a written feature specification, or a structured requirements and acceptance-criteria phase for a non-trivial change. Routine fixes do not require this skill."
---

# Spec-Driven Development

Use this workflow to make a non-trivial change's intended behavior explicit before implementation. Having this skill available does not make it mandatory; a project that requires it should say so in `AGENTS.md` or a project-specific agent.

## Workflow

1. **Set the scope**: Confirm the problem, intended users, desired outcome, constraints, and what is explicitly out of scope. Inspect existing behavior and project guidance first.
2. **Reuse project documentation**: Check for existing requirements, design records, issues, or specifications. Use the repository's established format and location; do not assume a `specs/` directory, issue tracker, or documentation template.
3. **Describe observable behavior**: Record only the details needed to guide implementation, such as acceptance criteria, interfaces or data changes, compatibility expectations, failure cases, and important risks.
4. **Resolve material ambiguity**: Ask the user about decisions that would change scope, compatibility, or acceptance. For non-blocking unknowns, state a reasonable assumption and proceed as requested.
5. **Align before implementation**: When the user asks for a spec-first workflow, present the requirements and acceptance criteria for agreement before implementing them. Otherwise, follow the requested level of formality and do not create ceremony for a routine change.
6. **Connect to verification**: Make each acceptance criterion verifiable. Use the optional [TDD skill](../tdd/SKILL.md) when test-first implementation is requested or required by the project.
7. **Keep the record current**: After implementation, update the existing requirement or design artifact if the project expects it. Report any criterion that remains unmet or could not be verified.

## Principles

- Requirements describe outcomes, not a predetermined implementation, unless an implementation constraint is intentional.
- Prefer a small, reviewable artifact over a comprehensive specification that adds no useful decisions.
- Do not require an issue, formal specification, or user approval for every change unless local project rules require it.
- Keep project-specific tools, paths, labels, and approval processes out of this reusable workflow.
