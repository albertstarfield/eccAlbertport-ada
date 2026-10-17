# eccAlbertport-ada — ECC Agent Harness (Ada/SPARK Port)

> **Everything Claude Code (ECC)** ported to an Ada/SPARK-first architecture with
> OpenCode integration.  The core logic is formally verified (Lean 4 + Rocq + GNATprove).
> JavaScript is banned as a source language; TypeScript is only used for the OpenCode
> plugin host API (sanctioned carve-out).

<p align="center">
  <img src="assets/hero.png" alt="ECC - the agent harness operating system" width="100%" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/Ada-2012-blue" alt="Ada 2012" />
  <img src="https://img.shields.io/badge/SPARK-2014-green" alt="SPARK 2014" />
  <img src="https://img.shields.io/badge/GNATprove-195%20checks-brightgreen" alt="GNATprove 195 checks" />
  <img src="https://img.shields.io/badge/Lean-4.35-purple" alt="Lean 4" />
  <img src="https://img.shields.io/badge/Rocq-8.18-orange" alt="Rocq" />
</p>

## What This Is

This is a port of [Everything Claude Code (ECC)](https://github.com/affaan-m/ECC) — the agent
harness performance system — to an **Ada/SPARK-first** architecture.  All business logic,
classification, gating, and state management live in formally verified Ada/SPARK packages.
Python is used **only** as an FFI wrapper layer.  TypeScript is used **only** for the
OpenCode plugin host API (sanctioned carve-out per platform requirements).

### Why Ada/SPARK?

- **Formal verification**: SPARK proves absence of runtime errors (AoRTE) and key
  integrity properties (Gold level).  195 checks proved, 0 unproved.
- **Memory safety**: Ada's type system eliminates buffer overflows, null dereferences,
  and use-after-free by construction.
- **Deterministic concurrency**: Ravenscar tasking profile guarantees race-free execution.
- **No JS slop**: The original ECC relies heavily on JavaScript/Node.js.  This port
  replaces all core logic with verified Ada/SPARK.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  OpenCode Plugin Host (TypeScript — sanctioned carve-out)   │
│  plugins/eccAlbertport-adaSpark-Hybrid-FuckYouJSStatusquo-arch.ts │
├─────────────────────────────────────────────────────────────┤
│  Python FFI Bridge (wrapper only — no business logic)       │
│  run.py, state_store.py, hook_runner.py, install_profiles.py │
├─────────────────────────────────────────────────────────────┤
│  C ABI Shim (SPARK_Mode => Off — trust boundary)            │
│  src/ecc_c_api.ads / .adb                                   │
├─────────────────────────────────────────────────────────────┤
│  Ada/SPARK Core (SPARK_Mode => On — formally verified)      │
│  Ecc_Types, Ecc_Agent_Map, Ecc_Effect, Ecc_Strings,          │
│  Ecc_Adapter, Ecc_Commands, Ecc_Hooks, Ecc_Memory,           │
│  Ecc_State, Ecc_Install, Ecc_Context, Ecc_Rules              │
└─────────────────────────────────────────────────────────────┘
```

### Embedded Python (CPython)

The Ada library now **embeds CPython** directly.  Ada is the host, Python is the guest
interpreter.  This eliminates the ctypes FFI overhead and keeps Python in-process.

- **Package**: `Ecc_Python_Embed` (SPARK_Mode => Off — FFI boundary to libpython)
- **Safety**: Every Python C API call is wrapped in GIL acquisition + exception handling
- **Venv**: Still generated and used (Python dependencies installed in `.venv/`)
- **Verified**: Build succeeds, links against libpython3.15, runtime test passes

### SPARK Mode Status

| Package | SPARK_Mode | Checks Proved |
|---|---|---|
| Ecc_Types | On | ✅ |
| Ecc_Agent_Map | On | ✅ |
| Ecc_Effect | On | ✅ |
| Ecc_Strings | On | ✅ |
| Ecc_Adapter | On | ✅ |
| Ecc_Commands | On | ✅ |
| Ecc_Hooks | On | ✅ |
| Ecc_Memory | On | ✅ |
| Ecc_State | On | ✅ |
| Ecc_Install | On | ✅ |
| Ecc_Context | On | ✅ |
| Ecc_Rules | On | ✅ |
| Ecc_C_Api | **Off** (FFI boundary) | N/A — trust boundary |

**Only `Ecc_C_Api` is SPARK_Mode Off** — it is the C ABI shim handling untrusted input
from ctypes.  This is the correct, minimal trust boundary.  All business logic is in
SPARK_Mode On packages.

### Formal Verification (Scratch Paper for ALL Languages)

Lean and Rocq are used as **formal scratch paper** to verify that theorems and logic are
correct — not hallucinated — across ALL implementation languages (Ada, Python, TypeScript, C).
GNATprove verifies the Ada/SPARK implementation. CrossHair + pyrefly + ruff verify Python.

| Verifier | Scope | File | Result |
|---|---|---|---|
| Lean 4.35 | Logic/theorems (ALL languages) | `proofs/lean/EccClassification.lean` | ✅ 6 theorems |
| Rocq 8.18 | Logic/theorems (ALL languages) | `proofs/rocq/EccClassification.v` | ✅ 8 lemmas |
| GNATprove | Ada/SPARK implementation | `src/*.adb` | ✅ 195/195 checks, 0 unproved |
| CrossHair | Python FFI boundary | `run.py` | Symbolic execution |
| pyrefly | Python type checking | `*.py` | Must pass |
| ruff | Python linting | `*.py` | Must pass |

**Proofs cover**: tool mapping correctness, effect gating safety (SE4 never auto-proceeds),
agent mode inference (only "orchestrator" is primary), command classification totality,
suffix matching correctness, deny-by-default policy.

**Verification workflow** (mandatory order):
1. First use Lean + Rocq as scratch paper to validate logic/theorems are sound BEFORE coding
2. Implement in Ada/SPARK
3. Prove with gnatprove (--mode=all --level=4)
4. Prove again with Lean + Rocq to confirm logic/theorems are valid
5. For Python FFI: pyrefly + ruff + CrossHair

## What's Inside

### Ada/SPARK Packages (13 files)

| Package | Purpose |
|---|---|
| `Ecc_Types` | Core types: Tool_Id, Agent_Mode, Effect_Class, Gate_Decision |
| `Ecc_Agent_Map` | Tool token → Tool_Id mapping, agent mode inference |
| `Ecc_Effect` | Effect class → gate decision (SE0-SE4) |
| `Ecc_Strings` | Bounded string comparison (no secondary stack) |
| `Ecc_Adapter` | Facade: Command_Category_Of, Hook_Event_Of, etc. |
| `Ecc_Commands` | Command classification by suffix convention |
| `Ecc_Hooks` | Hook event classification |
| `Ecc_Memory` | Memory kind/scope/status classification |
| `Ecc_State` | State section classification |
| `Ecc_Install` | Component family classification |
| `Ecc_Context` | Context mode classification |
| `Ecc_Rules` | Rule language classification |
| `Ecc_C_Api` | C ABI shim (SPARK_Off — FFI boundary) |

### OpenCode Assets (ported from ECC)

| Asset | Count | Location |
|---|---|---|
| Agents | 71 | `agents/ecc/` |
| Skills | 317 | `skills/` |
| Commands | 97 | `commands/ecc/` |
| Rules | 122 (22 dirs) | `rules/ecc/` |
| Hook scripts | 58 | `targetAdaptation/ecc/scripts/hooks/` |

### Plugins (TypeScript — OpenCode host API)

| Plugin | Purpose |
|---|---|
| `eccAlbertport-adaSpark-Hybrid-FuckYouJSStatusquo-arch` | Auto-build, venv bootstrap, selftest |
| `eccAlbertport-adaSpark-Hybrid-FuckYouJSStatusquo-arch-hooks` | Hook execution on tool events |
| `eccAlbertport-adaSpark-Hybrid-FuckYouJSStatusquo-arch-autocontinue` | Enforced continuation on unauthorized stop |

### Python FFI Bridge (wrapper only)

| File | Purpose |
|---|---|
| `run.py` | Library loading, dynamic GNAT discovery, tool calls |
| `state_store.py` | JSON state persistence |
| `hook_runner.py` | Hook script dispatch via hooks.json |
| `install_profiles.py` | Profile-driven module installation |

### MCP Servers

Configured in `opencode.jsonc`: context7, github, firecrawl.

## Install

### Prerequisites

- **GNAT/Alire**: Ada/SPARK toolchain (Alire 2.1.0+)
- **Python 3.10+**: For FFI bridge (isolated venv)
- **OpenCode**: Plugin host

### Quick Install

```bash
cd eccAlbertport-ada
./install.sh
```

This runs:
1. `alr build` — compile Ada/SPARK library
2. `gnatprove --level=4 --mode=all -j0` — formal verification
3. Python venv creation + dependency install
4. Selftest (library load + basic calls)

### Manual Steps

```bash
# Build Ada library
cd ecc_adapter && alr build

# Run formal verification
gnatprove -P ecc_adapter.gpr --mode=all --level=4 -j0

# Bootstrap Python venv
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Selftest
DYLD_LIBRARY_PATH=$(find_gnat_lib) .venv/bin/python run.py selftest
```

## Safety Nets

### Layer 1: FFI Boundary (Ecc_C_Api)
- Null pointer guard (`Addr = Null_Address → return 0`)
- Bounded input (`Max_Name_Length = 64`)
- NUL-termination check (stops at NUL or buffer end)
- Empty input guard (`Count = 0 → return -1`)
- Range validation (`Class not in SE0..SE4 → return -1`)
- Exception handlers (`when others => return -1`) on all 11 functions
- No secondary stack (byte-by-byte comparison)

### Layer 2: SPARK Cores
- Postconditions on all classify functions
- Deny-by-default (`Unknown → denied`)
- SE4 gate (destructive actions require confirmation)
- Loop invariants and termination proofs

### Layer 3: Python Bridge
- Dynamic GNAT discovery (no hardcoded paths)
- Library load fallback with error reporting
- Null-terminated buffers (`create_string_buffer`)
- Venv isolation (project-local only)

### Layer 4: Plugin
- Auto-build with error reporting
- Venv bootstrap + stale detection
- Selftest on load
- Hook timeout (10s per script)

### Layer 5: Formal Proofs (Scratch Paper for ALL Languages)
- Lean 4: 6 theorems — scratch paper for ALL languages (mapping, gating, mode, totality)
- Rocq: 8 lemmas — scratch paper for ALL languages (same + suffix matching)
- GNATprove: 195 checks, 0 unproved — Ada/SPARK implementation verification
- CrossHair: Python FFI boundary — symbolic execution (counterexamples, edge cases)
- pyrefly: Python type checking — type errors, missing annotations
- ruff: Python linting — style, security, best practices

## Key Concepts

### Agents
71 ECC agents converted to OpenCode paradigm (`agents/ecc/`).  Each agent has:
- YAML frontmatter (name, description, tools, mode)
- System prompt with role definition
- Mode: `primary` (orchestrator) or `subagent` (specialists)

### Skills
317 skills in `skills/` directory.  Each skill is a directory with `SKILL.md`.

### Hooks
58 hook scripts in `targetAdaptation/ecc/scripts/hooks/`.  Dispatched via
`hook_runner.py` based on `hooks/hooks.json` configuration.

### Rules
122 rule files across 22 directories in `rules/ecc/`.  Language-specific and
common guidelines.

### Commands
97 slash commands in `commands/ecc/`.  Maintained for backward compatibility.

## Platform Support

| Platform | Status |
|---|---|
| macOS (arm64) | ✅ Primary development platform |
| Linux | ✅ Supported |
| Windows (WSL) | ✅ Supported via WSL |

## Requirements

- **Alire** 2.1.0+ (Ada/SPARK toolchain)
- **GNAT** 16.1.0+ (Ada compiler)
- **GNATprove** 16.1.0+ (formal verification)
- **Python** 3.10+ (FFI bridge)
- **OpenCode** (plugin host)

## Security

- No hardcoded secrets, API keys, or credentials
- All external calls have exception handling
- FFI boundary validates all input before delegation
- SPARK proves absence of runtime errors on all core logic
- Formal verification (Lean + Rocq) confirms safety properties

## License

MIT — see [LICENSE](LICENSE).

## Credits

Ported from [Everything Claude Code (ECC)](https://github.com/affaan-m/ECC) by Affaan Mustafa.
Ada/SPARK port by Albert Starfield.
