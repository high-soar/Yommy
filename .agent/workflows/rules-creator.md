---
description: Interactive guide to creating and refining Agent Rules (Agents.md / CLAUDE.md)
---

# Rules Creator Workflow

This workflow helps you create or update `Agents.md` (or `CLAUDE.md`) and other agent rules using the `rules-creator` skill.

1.  **Load the Skill**:
    I will load the `rules-creator` skill to access the best practices and templates.
    // turbo
    - [ ] Read `.agent/skills/rules-creator/SKILL.md`

2.  **Analyze Current State**:
    - [ ] Check if `Agents.md` or `CLAUDE.md` already exists in the workspace root or global config.
    - [ ] If it exists, read its content to understand the current context.

3.  **User Consultation**:
    - [ ] Ask the user: "What is the goal of these rules? (e.g., New project setup, defining coding standards, specific workflow automation)"
    - [ ] Ask for any specific constraints or technologies that should be emphasized.

4.  **Drafting Rules**:
    Based on the users input and the `rules-creator` skill guidelines:
    - [ ] Draft the content for the rule file.
    - [ ] Ensure it follows the **WHAT / WHY / HOW** structure.
    - [ ] Keep it concise (< 300 lines).

5.  **Review and Save**:
    - [ ] Present the draft to the user for review.
    - [ ] Upon approval, save the file to the appropriate location (`.agent/rules/` for workspace, or `~/.gemini/GEMINI.md` for global).

6.  **Verification**:
    - [ ] Verify the file is created and contains the correct content.
