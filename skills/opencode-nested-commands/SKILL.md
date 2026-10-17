---
name: opencode-nested-commands
description: "Use when invoking OpenCode slash commands from a subdirectory like commands/ecc/ — nested paths use / separators (e.g. /ecc/plan not /ecc plan)"
metadata:
  origin: auto-extracted
---

# OpenCode Nested Command Invocation

**Extracted:** 2026-10-17
**Context:** OpenCode command discovery from nested directories

## Problem
Commands placed in subdirectories (e.g., `commands/ecc/plan.md`) are not invoked with a space separator (`/ecc plan`). OpenCode interprets that as a literal prompt, not a command.

## Solution
Nested command paths use `/` as the separator. A file at `commands/ecc/plan.md` becomes the command `/ecc/plan`. Similarly, `commands/ecc/code-review.md` → `/ecc/code-review`.

## When to Use
- When commands are organized in subdirectories under `commands/`
- When a slash command with a space is being interpreted as a prompt instead of executing
- When setting up or documenting OpenCode command structures
