---
description: Critically review design docs or code for fatal defects, logic gaps, and maintainability issues.
---

1.  Read the `review` skill instructions (`.agent/skills/review/SKILL.md`).
2.  Identify the target file(s) from the user's request. If no file is specified, ask the user for the target.
3.  Read the reviewer role definition (`.agent/skills/review/references/roles/reviewer.md`) and the viewpoints (`.agent/skills/review/references/viewpoints.md`).
4.  Perform the review using the "Devil's Advocate" persona as defined in the role.
5.  Generate the review report and save it to `review/Pending/` following the naming convention.
6.  Notify the user that the review is drafted and provide the path to the review file.