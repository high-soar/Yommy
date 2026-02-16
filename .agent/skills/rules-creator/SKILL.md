---
name: rules-creator
description: Guide for creating and refining Agent Rules (Agents.md, CLAUDE.md) and Workflows. Use this skill when users want to customize agent behavior, ensure project context is understood, or automate repetitive tasks.
---

# Rules Creator Skill

This skill provides comprehensive guidance on creating and managing **Agent Rules** and **Workflows**. These are powerful mechanisms to customize the agent's behavior and efficiency.

## 1. Agent Rules (Agents.md / CLAUDE.md)

**Rules** act as the agent's long-term memory and project map. They provide persistent context about the project's purpose, structure, and constraints.

### Key Principles
- **Context is King**: The agent treats every interaction as a fresh start. Rules provide the necessary "who, what, and how" validation.
- **Conciseness**: Keep the file under **300 lines** (ideally 60-100 lines). The agent has an "Instruction Budget" (~150-200 instructions).
- **Progressive Disclosure**: Don't dump everything in one file. Link to external specialized docs (e.g., `docs/schema.md`) for detailed specs.

### File Structure (The Golden Ratio)
Organize your `Agents.md` (or `CLAUDE.md`) into these three sections:

#### 1. WHAT (Overview & Structure)
- **Project One-Liner**: e.g., "Next.js payment portal."
- **Tech Stack**: Languages, frameworks, key libs.
- **Directory Map**: High-level layout of where things are.

#### 2. WHY (Architecture & Design)
- **Design Philosophy**: usage of specific patterns.
- **Component Roles**: Why components exist and how they interact.

#### 3. HOW (Verification & Commands)
- **Commands**: Build, test, lint, DB migration.
- **Focus**: "How to verify correctness," not just "how to implementations."

### Anti-Patterns (What to Avoid)
- **Code Style/Formatting**: Leave this to linters (ESLint, Prettier).
- **Transient Info**: Hardcoded file paths or line numbers that change often.
- **Excessive Detail**: Full API specs or DB dumps.
- **Raw Templates**: Always prune auto-generated templates.

### Scopes & Locations
| Type | Scope | Location |
| :--- | :--- | :--- |
| **Global Rules** | All Workspaces | `~/.gemini/GEMINI.md` |
| **Workspace Rules** | Current Project | Project Root (`.agent/rules/` or root `Agents.md`) |

### Activation Methods
- **Manual**: `@mentions` in chat.
- **Always On**: Constant background context.
- **Model Decision**: Agent decides based on description.
- **Glob**: Triggers on specific file patterns (e.g., `**/*.ts`).

---

## 2. Workflows

**Workflows** are for structured, repetitive tasks (e.g., "Deploy to Code Sandbox", "Review PR"). Unlike Rules (context), Workflows are **instructions** (action).

### Characteristics
- **Format**: Markdown with steps.
- **Files**: Stored in `.agent/workflows/`.
- **Naming**: Uppercase/Lowercase with dashes (e.g. `deploy-prod.md`).
- **Limit**: Max 12,000 characters.

### How to Create
1. **Identify Repetition**: Look for tasks done manualy > 3 times.
2. **Draft Steps**: Write down the exact commands and logical checks.
3. **Agent-Generation**: Ask the agent to "Create a workflow from our last session" after successfully completing a task.

### Execution
- **Slash Command**: `/workflow-name`
- **Nesting**: Workflows can call other workflows.

---

## Template: Ideal Agents.md

```markdown
# [Project Name]
[Brief description: e.g. Next.js and Supabase task manager]

## Tech Stack
- Frontend: Next.js 14, TailwindCSS
- Backend: Supabase
- Test: Vitest

## Architecture
- src/app: App Router pages
- src/components: Reusable UI
- src/lib: Utilities/DB clients

## Commands
- Dev: `pnpm dev`
- Test: `pnpm test`
- Lint: `pnpm lint`

## Critical Rules
- Auth: Must use Supabase Auth.
- UI: Use shadcn/ui components.
- Schema: See `docs/database.md`.
```
