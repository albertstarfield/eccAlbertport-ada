---
name: python-testing
description: Testing Python FFI wrappers for OpenCode/Ada-SPARK projects. Tests verify the Python→Ada boundary (ctypes calls, error handling, venv isolation) — NOT business logic (that's tested in Ada/SPARK). Covers pytest, mocking, parametrization, and coverage for FFI wrappers. Use when writing or reviewing Python tests for FFI wrapper code.
metadata:
  origin: ECC-OpenCode-AdaPort
---

> **OpenCode Paradigm (Ada/SPARK-First)**: This project uses Ada/SPARK as the primary
> implementation language.  Python tests verify the FFI boundary only — business logic
> is tested in Ada/SPARK (gnattest + gnatprove).  Validation: `pyrefly check .` + `ruff check .` + `crosshair check`.
> Approval gates required before execution.

# Python FFI Testing (OpenCode Paradigm)

Python tests verify the **FFI boundary** — that Python correctly calls Ada/SPARK functions
via ctypes, handles errors, and manages resources.  Business logic is tested in Ada/SPARK.

## What Python Tests Cover

- ctypes call correctness (argtypes, restype, buffer handling)
- Error handling (return codes, exceptions, null pointers)
- Venv isolation (dependencies available in .venv)
- Resource cleanup (library handles, file descriptors)
- Input validation at the Python boundary

## What Python Tests Do NOT Cover

- Business logic (tested in Ada/SPARK via gnattest)
- Classification/gating (tested in Ada/SPARK via gnatprove)
- Formal properties (tested via Lean/Rocq)

## Test Framework

```bash
# Run tests
.venv/bin/python -m pytest tests/ -v

# With coverage
.venv/bin/python -m pytest tests/ --cov=run --cov-report=term-missing

# Validation (BOTH must pass)
pyrefly check .
ruff check .
```

## Test Patterns

### Basic FFI Call Test
```python
import ctypes
from ctypes import create_string_buffer
import pytest

def test_tool_id_read():
    """Verify Read maps to correct Tool_Id position."""
    lib = load_library()
    buf = create_string_buffer(b"Read\0")
    result = lib.Ecc_Tool_Id(buf)
    assert result >= 0  # Valid position
    assert result != -1  # Not an error

def test_tool_id_unknown():
    """Verify unknown token returns Unknown position."""
    lib = load_library()
    buf = create_string_buffer(b"foobar\0")
    result = lib.Ecc_Tool_Id(buf)
    assert result >= 0  # Unknown is a valid enum value
```

### Error Handling Test
```python
def test_null_pointer():
    """Verify null pointer returns -1 (error)."""
    lib = load_library()
    result = lib.Ecc_Tool_Id(None)
    assert result == -1

def test_empty_string():
    """Verify empty string returns -1 (error)."""
    lib = load_library()
    buf = create_string_buffer(b"\0")
    result = lib.Ecc_Tool_Id(buf)
    assert result == -1
```

### Fixtures
```python
import pytest
import ctypes

@pytest.fixture
def lib():
    """Load the Ada library for testing."""
    lib = ctypes.CDLL("libecc_adapter.so")
    lib.Ecc_Tool_Id.argtypes = [ctypes.c_char_p]
    lib.Ecc_Tool_Id.restype = ctypes.c_int
    return lib

@pytest.fixture
def ada_lib_path():
    """Find the Ada library path dynamically."""
    import os, glob
    # Search common locations
    candidates = glob.glob("**/libecc_adapter*", recursive=True)
    assert candidates, "Ada library not found — run 'alr build' first"
    return candidates[0]
```

### Parametrized Tests
```python
@pytest.mark.parametrize("input_str,expected_valid", [
    ("Read", True),
    ("Write", True),
    ("Edit", True),
    ("Bash", True),
    ("foobar", True),  # Unknown is valid enum
    ("", False),       # Empty → error
])
def test_tool_id(lib, input_str, expected_valid):
    buf = create_string_buffer((input_str + "\0").encode())
    result = lib.Ecc_Tool_Id(buf)
    if expected_valid:
        assert result >= 0
    else:
        assert result == -1
```

## Mocking

```python
from unittest.mock import patch, MagicMock

def test_wrapper_handles_ada_failure():
    """Verify Python wrapper raises on Ada error."""
    with patch("run.lib.Ecc_Tool_Id", return_value=-1):
        with pytest.raises(RuntimeError):
            call_tool_id("Read")
```

## Coverage Requirements

- FFI wrapper functions: 100% coverage
- Error paths: all tested
- Edge cases: null, empty, oversized, malformed

## Safety Rules for Tests

- NEVER test business logic in Python (that's Ada/SPARK)
- NEVER skip tests with `pass` — use `@pytest.mark.skip(reason="...")`
- ALWAYS verify both success and failure paths
- ALWAYS clean up resources (file handles, library references)
- NEVER use global Python state in tests

## Reference

- Ada tests: `ecc_adapter/test/` (gnattest)
- Ada proofs: `ecc_adapter/proofs/` (Lean + Rocq)
- Python tests: `ecc_adapter/tests/` (pytest)
- Validation: `pyrefly check .` + `ruff check .` + `crosshair check`
