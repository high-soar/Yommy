---
name: sdd
description: "Use when writing or updating feature specifications, parser specifications, or architecture/DB contracts in docs/specs/ prior to implementation."
---

# Spec-Driven Development (2-Layer Living Documentation)

Use this workflow to make a change's intended behavior explicit in `docs/specs/` before writing production code, following [docs/README.md](../../../docs/README.md) and [docs/guidelines/workflow.md](../../../docs/guidelines/workflow.md).

## Workflow

1. **Set the scope**: Confirm the user's goal, target screens (`SCR-xx`) or novel sites, constraints, and what is out of scope. Inspect existing Canonical App Specs in `docs/specs/` first.
2. **Maintain 2-Layer Specifications (`docs/specs/`)**:
   - **Per-Issue Delta Spec (`docs/specs/changes/issue-XX-<slug>.md`)**: In Phase 4+, create a Delta Spec for the Feature Request Issue detailing why the change is needed, what changes across the layers, the UT/VRT/IT test plan, Sub-issue breakdown, and Handover items (`HO-xx`).
   - **Canonical App Specs (`docs/specs/*.md`, `features/*.md`, `parsers/*.md`)**: In the **same Design Update PR**, reflect the changes into the Canonical App Specs with status `Review (#Issue番号)` so the canonical files always represent the complete, up-to-date system specification.
3. **Describe observable behavior & contracts**:
   - Define verifiable Acceptance Criteria (`AC-xx`), Screen Transitions (`TR-xx`), interface/SQLite schema changes, component responsibilities (parent vs. child), and UT/VRT/IT test perspectives.
4. **Resolve material ambiguity (Open Questions)**:
   - Never invent unspoken product rules. Ask the user with clear options when edge cases, error recovery, or UI behaviors are ambiguous.
5. **Align before implementation**:
   - In Phase 2, iterate with the user until the core Canonical App Specs are approved.
   - In Phase 4+, submit the Design Update PR (Delta Spec + Canonical Spec updates) and wait for human merge (`Approved`) before starting MK implementation.
6. **Keep specifications in sync & archive upon completion**:
   - If implementation or testing reveals a design flaw (defect cause `D`), update **both** the active Delta Spec and the Canonical App Specs in the same PR.
   - In the final PR that closes the parent Issue (`Closes #XX`), move the completed Delta Spec to `docs/specs/changes/archive/issue-XX-<slug>.md`.
