---
name: repo-config-management
description: "Use this skill when modifying, adding, or maintaining repository configurations, including .devcontainer/, .agents/, .github/, .githooks/, AGENTS.md, docs/guidelines/, skills, agents, Git hooks, or AI tool coexistence settings."
---

# Repository Configuration & AI Coexistence Management

This skill defines the operational standards and procedures for maintaining configurations in the **Yommy** repository, ensuring seamless coexistence between **Google Antigravity** and **GitHub Copilot** with a strict Single Source of Truth (SSOT).

---

## 1. Architecture Overview (SSOT Policy)

To prevent configuration drift and duplication between human documentation and AI skills:

1. **Human & AI Shared Rules live in `docs/guidelines/`**:
   Workflow rules (`workflow.md`), testing/TDD/VRT rules (`testing.md`), and review formats (`review-comment-format.md`) are maintained in `docs/guidelines/`.
2. **AI Execution & Orchestration Skills live in `.github/skills/`**:
   Skill files (`SKILL.md`) reference `docs/guidelines/` and describe AI-specific step-by-step procedures and subagent delegation. Never duplicate skills under `.agents/skills/`; use `.agents/skills.json` for mapping.

```text
/
├── AGENTS.md                             # [SSOT] Project AI constitution & environment overview
├── docs/
│   └── guidelines/                       # [SSOT] Canonical workflow, testing, and review rules
├── .agents/
│   └── skills.json                       # [Mapping] Configures Antigravity to load skills from .github/skills
├── .githooks/                            # [Tracked] Repository-shared Git hook scripts (added in Phase 3)
└── .github/
    ├── copilot-instructions.md           # [Bridge] Copilot instruction wrapper pointing to AGENTS.md & docs/guidelines/
    ├── ISSUE_TEMPLATE/
    │   └── feature_request.md            # [Template] Feature request issue template with AI checklist
    ├── pull_request_template.md          # [Template] PR template with defect & handover mini-tables
    ├── retrospective/
    │   └── .gitkeep                      # [Temp] Handoff directory for template retrospectives
    ├── agents/
    │   └── *.agent.md                    # [SSOT] Custom Agent definitions (pr-reviewer, phase-final-reviewer)
    └── skills/
        └── <skill-name>/
            └── SKILL.md                  # [SSOT] Skill instructions with YAML frontmatter
```

---

## 2. Configuration Maintenance Procedures

### A. Modifying Development Workflow, Testing, or Review Rules
1. **Target Files**: `docs/guidelines/workflow.md`, `docs/guidelines/testing.md`, or `docs/guidelines/review-comment-format.md`.
2. **Action**: Update the canonical guideline in `docs/guidelines/` first. Only update `AGENTS.md` or `.github/skills/<name>/SKILL.md` if AI orchestration steps or high-level summaries also need adjustment.

### B. Adding or Updating a Skill
1. **Target Directory**: `.github/skills/<skill-name>/SKILL.md`
2. **Requirements**:
   - Include valid YAML frontmatter (`name` and `description`).
   - Reference `docs/guidelines/` for shared rules rather than copy-pasting long rule tables.
   - Verify `.agents/skills.json` maps `{"path": ".github/skills"}`.

### C. Modifying DevContainer or Fonts
1. **Target Files**: `.devcontainer/Dockerfile`, `.devcontainer/devcontainer.json`.
2. **Requirements**:
   - Preserve Japanese font packages (`fonts-noto-cjk`, `fonts-ipaexfont`, `fonts-morisawa-bizud-mincho`, `fonts-morisawa-bizud-gothic`, `fonts-klee`, `fonts-dejavu-core`) required for Storybook VRT rendering parity with GitHub Actions.
   - Preserve AI history volume mounts for both Antigravity (`/home/vscode/.gemini`) and GitHub Copilot (`/home/vscode/.copilot` and `github.copilot-chat`).
   - Update `AGENTS.md` §1 if runtime versions or system packages change.

### D. Adding or Modifying Git Hooks (Phase 3+)
1. Consult the [hook-ci-guidance skill](../hook-ci-guidance/SKILL.md) to decide what runs in `.githooks/` vs. `.github/workflows/`.
2. Keep shared hook scripts under `.githooks/` with executable permissions (`chmod +x`) and configure `core.hooksPath` idempotently via `npm run prepare`.

---

## 3. Verification Checklist

Whenever configuration changes are made:
- [ ] **JSON Syntax**: Confirm `.devcontainer/devcontainer.json` and `.agents/skills.json` are valid JSON.
- [ ] **OKF & Markdown Links**: Run `node .github/skills/sdd/scripts/validate-okf.mjs` and confirm all OKF frontmatter rules and relative links across `AGENTS.md`, `docs/`, and `.github/` pass.
- [ ] **No Duplicate Skills**: Confirm no skill files are duplicated under `.agents/skills/`.

