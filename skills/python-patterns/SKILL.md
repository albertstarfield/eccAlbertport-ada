---
name: python-patterns
description: Python FFI wrapper patterns for OpenCode/Ada-SPARK projects. Python is used ONLY as a foreign function interface (FFI) layer — never for business logic. Covers ctypes integration, venv isolation, pyrefly/ruff validation, and safe boundary handling. Use when writing or reviewing Python code that wraps Ada/SPARK libraries.
metadata:
  origin: ECC-OpenCode-AdaPort
---

> **OpenCode Paradigm (Ada/SPARK-First)**: This project uses Ada/SPARK as the primary
> implementation language.  Python is FFI-only (wrapper over Ada/SPARK C ABI).  JavaScript
> is BANNED.  TypeScript only for OpenCode plugin host API.  Validation: `gnatprove --level=4`,
> `pyrefly check .`, `ruff check .`.  Approval gates required before execution.

# Python FFI Wrapper Patterns (OpenCode Paradigm)

Python is used **exclusively** as an FFI wrapper layer.  All business logic, classification,
gating, and state management live in Ada/SPARK.  Python's job is to call the compiled Ada
library via ctypes and handle I/O at the boundary.

## Architecture

```
Python (FFI wrapper)  →  ctypes  →  C ABI (Ecc_C_Api)  →  Ada/SPARK Core
```

- **Ada/SPARK**: All logic, types, contracts, proofs
- **C ABI (Ecc_C_Api)**: Trust boundary — validates input, delegates to SPARK
- **Python**: Thin wrapper — loads library, calls functions, handles I/O

## When to Use Python

- Wrapping Ada/SPARK compiled libraries via ctypes
- File I/O at the system boundary (reading config, writing state)
- Subprocess orchestration (calling external tools)
- OpenCode plugin integration (TypeScript is preferred for plugins, Python for CLI)

## When NOT to Use Python

- Business logic, classification, gating → Ada/SPARK
- State management, data structures → Ada/SPARK
- Anything that needs formal verification → Ada/SPARK

## Venv Mandate (Non-Negotiable)

Every Python dependency lives in a project-local virtual environment:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

- NEVER install into global Python
- NEVER rely on system Python packages
- Auto-create venv if missing (in run.py / install.sh)
- Auto-rebuild venv if stale or broken

## Validation

```bash
# BOTH must pass — no exceptions
pyrefly check .
ruff check .
```

## FFI Pattern (ctypes)

```python
import ctypes
from ctypes import c_int, c_char_p, create_string_buffer

# Load the Ada library
lib = ctypes.CDLL("libecc_adapter.so")

# Declare function signatures
lib.Ecc_Tool_Id.argtypes = [c_char_p]
lib.Ecc_Tool_Id.restype = c_int

# Call with null-terminated buffer
buf = create_string_buffer(b"Read\0")
result = lib.Ecc_Tool_Id(buf)
```

### Key Rules
- Always use `create_string_buffer(b"...\0")` for string arguments
- Always declare `argtypes` and `restype` explicitly
- Never pass Python strings directly — always encode to bytes
- Handle return codes: -1 = error, 0+ = valid enum position

## Error Handling

```python
def call_ada_function(name: str) -> int:
    """Call Ada function with proper error handling."""
    try:
        buf = create_string_buffer(name.encode() + b"\0")
        result = lib.Ecc_Tool_Id(buf)
        if result < 0:
            raise RuntimeError(f"Ada function failed: {result}")
        return result
    except Exception as e:
        # Log full context
        print(f"ERROR: {e} when calling Ecc_Tool_Id with {name!r}")
        raise
```

## Safety Rules

- NEVER use `eval()` or `exec()` on external input
- NEVER use `os.system()` — use `subprocess.run()` with explicit args
- ALWAYS validate input before passing to Ada
- ALWAYS handle -1 return codes (error)
- ALWAYS use try/except around FFI calls
- NEVER suppress exceptions silently

## Anti-Patterns

- Implementing business logic in Python (must be Ada/SPARK)
- Using global Python packages (must use venv)
- Skipping pyrefly/ruff validation
- Passing unvalidated data across FFI boundary
- Using `subprocess.shell=True`

## Reference

- Ada core: `ecc_adapter/src/ecc_*.ads` / `.adb`
- C ABI: `ecc_adapter/src/ecc_c_api.ads` / `.adb`
- Python bridge: `ecc_adapter/run.py`
- Validation: `pyrefly check .` + `ruff check .` + `crosshair check`
