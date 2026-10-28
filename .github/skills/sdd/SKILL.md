---
name: sdd
description: "Use when writing, updating, or validating OKF (Open Knowledge Format) specifications, guidelines, or quality documents in docs/ prior to or during implementation."
---

# Spec-Driven Development & OKF (Open Knowledge Format) Management

Use this workflow to author, update, and mechanically validate documentation in `docs/` as an **OKF (Open Knowledge Format) Knowledge Bundle**, following the canonical rules in [docs/index.md](../../../docs/index.md) and [docs/guidelines/workflow.md](../../../docs/guidelines/workflow.md).

---

## 1. Workflow

1. **Set the scope**:
   - Confirm the user's goal, target screens (`SCR-xx`) or novel sites, constraints, and what is out of scope. Inspect existing Canonical App Specs in `docs/specs/` first.
2. **Maintain 2-Layer Specifications (`docs/specs/`)**:
   - **Per-Issue Delta Spec (`docs/specs/changes/issue-XX-<slug>.md`, `type: spec-delta`)**: In Phase 4+, create a Delta Spec for the Feature Request Issue detailing why the change is needed, what changes across the layers, the UT/VRT/IT test plan, Sub-issue breakdown, and Handover items (`HO-xx`).
   - **Canonical App Specs (`docs/specs/*.md`, `features/*.md`, `parsers/*.md`)**: In the **same Design Update PR**, reflect the changes into the Canonical App Specs with `status: Review (#Issue番号)` so the canonical files always represent the complete, up-to-date system specification.
3. **Apply OKF YAML Frontmatter (No Markdown Metadata Tables)**:
   - Every `.md` file under `docs/` (except the reserved bundle index `docs/index.md`) must begin with an OKF YAML frontmatter block as defined in [docs/index.md §4](../../../docs/index.md#4-okfopen-knowledge-formatyaml-フロントマター規約):
     - Required fields: `type`, `title`, `description`, `status`, `updated` (`"YYYY-MM-DD"`), `tags`, `related_specs`, `related_tests` (plus `issue: "#N"` for `spec-delta`).
     - **Quote strings containing colons or symbols**: Always enclose values in double quotes (`"..."`) if they contain `: ` (e.g. `title: "本棚画面仕様書（SCR-01: Bookshelf）"`), `#` (e.g. `status: "Review (#50)"`), or YAML reserved characters to prevent YAML syntax parsing errors.
   - Never place legacy Markdown metadata tables at the top of the document body.
4. **Describe observable behavior & contracts**:
   - Define verifiable Acceptance Criteria (`AC-xx`), Screen Transitions (`TR-xx`), interface/SQLite schema changes, component responsibilities (parent vs. child), and UT/VRT/IT test perspectives.
5. **Resolve material ambiguity (Open Questions)**:
   - Never invent unspoken product rules. Ask the user with clear options when edge cases, error recovery, or UI behaviors are ambiguous.
6. **Keep specifications in sync & archive upon completion**:
   - If implementation or testing reveals a design flaw (defect cause `D`), update **both** the active Delta Spec and the Canonical App Specs in the same PR.
   - In the final PR that closes the parent Issue (`Closes #XX`), update the Delta Spec's frontmatter `status` to `Completed (Archived)` and move it to `docs/specs/changes/archive/issue-XX-<slug>.md`.
7. **Run Mechanical OKF Validation (Mandatory)**:
   - After creating or editing any file in `docs/`, always run the bundled validator script before committing or opening a PR:
     ```sh
     node .github/skills/sdd/scripts/validate-okf.mjs
     ```
   - Fix any reported frontmatter, taxonomy, status lifecycle, or broken link errors until the validator exits with `0`.
