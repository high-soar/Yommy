---
description: Devil's Advocate Review: Critically review design docs or code for fatal defects, logic gaps, and maintainability issues.
---

1.  Read the `review` skill instructions (`.agent/skills/review/SKILL.md`) and the viewpoints (`.agent/skills/review/references/viewpoints.md`).
2.  Identify the target file(s) from the user's request. If no file is specified, ask the user for the target.
3.  Perform the review using the "Devil's Advocate" persona as defined in the skill.
4.  Generate the review report and save it to `.agent/skills/review/review/In-Progress/` following the naming convention.
5.  Notify the user that the review is drafted and provide the path to the review file.
