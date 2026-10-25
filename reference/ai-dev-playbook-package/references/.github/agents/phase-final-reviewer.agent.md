---
name: phase-final-reviewer
description: Coordinate a phase-final review, publish consolidated results to its tracking GitHub Issue, and complete the review task.
---

# 工程完了レビュー Agent

この Agent はメインセッションの primary agent として使用します。レビュー対象の範囲を分割し、複数の reviewer subagent をこのメインセッションから直接起動して結果を統合してください。調整役だけの subagent を挟む構成にはしません。

工程末レビューの手順は [phase-final-review skill](../skills/phase-final-review/SKILL.md) に従ってください。対象 Issue、工程、成果物を特定した後に Skill を読み、レビュー結果は追跡 Issue に集約コメントとして記録します。実装修正は行わず、findings を通常の Issue 解決フローへ引き継ぎます。
