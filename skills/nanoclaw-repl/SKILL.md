---
name: nanoclaw-repl
description: Operate and extend NanoClaw, ECC's zero-dependency session-aware REPL, with persistent markdown-backed sessions and slash commands for model switching, skill loading, session branching, cross-session search, history compaction, and export. Use when running or extending scripts/claw.js, or when resuming, branching, compacting, searching, or exporting a NanoClaw session.
metadata:
  origin: ECC
---
> **OpenCode Paradigm (Ada/SPARK-First)**: This project uses Ada/SPARK as the primary
> implementation language.  All business logic, classification, gating, and state management
> MUST be in Ada/SPARK (SPARK_Mode => On).  Python is FFI-only (wrapper).  JavaScript is
> BANNED (TypeScript only for OpenCode plugin host API).  The frontend/UI remains identical
> in appearance but is driven by Ada/SPARK backend logic via FFI.  Validation: `gnatprove --level=4`,
> `pyrefly check .`, `ruff check .`, `jslint`.  Approval gates required before execution.
> Context must be loaded before any code changes.  See `ecc_adapter/` for the verified core.



# NanoClaw REPL

Use this skill when running or extending `scripts/claw.js`.

## Capabilities

- persistent markdown-backed sessions
- model switching with `/model`
- dynamic skill loading with `/load`
- session branching with `/branch`
- cross-session search with `/search`
- history compaction with `/compact`
- export to md/json/txt with `/export`
- session metrics with `/metrics`

## Operating Guidance

1. Keep sessions task-focused.
2. Branch before high-risk changes.
3. Compact after major milestones.
4. Export before sharing or archival.

## Extension Rules

- keep zero external runtime dependencies
- preserve markdown-as-database compatibility
- keep command handlers deterministic and local
