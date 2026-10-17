---
name: crosshair-verification
description: CrossHair symbolic execution for Python FFI wrappers in OpenCode/Ada-SPARK projects. Verifies Python boundary code (ctypes calls, error handling, input validation) finds counterexamples to contracts. Use when verifying Python FFI wrapper correctness, finding edge cases in Python boundary code, or supplementing Ada/SPARK formal verification with Python-side property checking.
metadata:
  origin: ECC-OpenCode-AdaPort
---

> **OpenCode Paradigm (Ada/SPARK-First)**: This project uses Ada/SPARK as the primary
> implementation language.  Python is FFI-only (wrapper over Ada/SPARK C ABI).  CrossHair
> verifies Python-side boundary code only — business logic is verified in Ada/SPARK via
> gnatprove + Lean + Rocq.  Validation: `crosshair check`, `pyrefly check .`, `ruff check .`.

# CrossHair Verification for Python FFI Wrappers

CrossHair uses symbolic execution to find counterexamples to Python function contracts.
In this project, it verifies that Python FFI wrappers correctly handle all inputs,
errors, and edge cases at the Python→Ada boundary.

## What CrossHair Verifies (Python side only)

- FFI wrapper functions never crash on valid inputs
- Error handling paths are reachable (return codes, exceptions)
- Input validation catches malformed data before it reaches Ada
- Resource cleanup happens on all paths (no leaks)
- Type contracts hold (preconditions/postconditions on Python functions)

## What CrossHair Does NOT Verify

- Business logic (verified in Ada/SPARK via gnatprove)
- Formal properties (verified via Lean 4 + Rocq)
- Ada/SPARK contracts (verified via GNATprove)

## Installation

```bash
# Install into project venv
.venv/bin/pip install crosshair-tool  # Requires Python 3.10-3.13

# Verify installation
.venv/bin/crosshair  # or use global: /usr/local/EnvironmentalAwareReferentialUnit/.venv/bin/crosshair --version
```

## Usage

### Check a Python module
```bash
# Check all functions in a module
.venv/bin/crosshair  # or use global: /usr/local/EnvironmentalAwareReferentialUnit/.venv/bin/crosshair check run.py

# Check with timeout
.venv/bin/crosshair  # or use global: /usr/local/EnvironmentalAwareReferentialUnit/.venv/bin/crosshair check run.py --per_path_timeout 30

# Check specific function
.venv/bin/crosshair  # or use global: /usr/local/EnvironmentalAwareReferentialUnit/.venv/bin/crosshair check run.py --functions call_tool_id
```

### Writing CrossHair-Compatible Contracts
Use Python type hints and assertions as contracts:

```python
def call_tool_id(name: str) -> int:
    """Call Ada Ecc_Tool_Id via FFI.

    Pre:  name is a non-empty string, len(name) <= 64
    Post: result >= -1 (valid position or error)
    """
    if not name or len(name) > 64:
        raise ValueError("name must be 1-64 chars")
    buf = create_string_buffer(name.encode() + b"\0")
    result = lib.Ecc_Tool_Id(buf)
    assert result >= -1, "Ada returned invalid code"
    return result
```

### CrossHair with pytest
```bash
# Run CrossHair as part of test suite
.venv/bin/crosshair  # or use global: /usr/local/EnvironmentalAwareReferentialUnit/.venv/bin/crosshair check run.py --per_path_timeout 60

# In CI
.venv/bin/crosshair  # or use global: /usr/local/EnvironmentalAwareReferentialUnit/.venv/bin/crosshair check run.py --per_path_timeout 120 --report_all
```

## Integration with Ada/SPARK Verification

```
┌─────────────────────────────────────────────────────┐
│  Python FFI Wrapper  →  CrossHair (symbolic exec)   │
│       ↓                                              │
│  C ABI (Ecc_C_Api)   →  GNATprove (SPARK proofs)   │
│       ↓                                              │
│  Ada/SPARK Core      →  Lean 4 + Rocq (theorems)    │
└─────────────────────────────────────────────────────┘
```

CrossHair and GNATprove are **complementary**:
- CrossHair finds Python-side edge cases and contract violations
- GNATprove proves Ada-side absence of runtime errors
- Together they cover the full FFI boundary

## Safety Rules

- CrossHair verifies Python code only — never claim it verifies Ada
- Always run CrossHair on FFI wrapper functions
- Use `--per_path_timeout` to avoid infinite symbolic execution
- Review counterexamples manually — not all are real bugs
- CrossHair is a supplement, not a replacement for GNATprove

## Reference

- CrossHair docs: https://github.com/pschanely/CrossHair
- Ada core: `ecc_adapter/src/ecc_*.ads` / `.adb`
- Python bridge: `ecc_adapter/run.py`
- Validation: `crosshair check` + `pyrefly check .` + `ruff check .`
