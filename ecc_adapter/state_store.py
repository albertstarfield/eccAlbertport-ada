"""State-store persistence layer for the ECC adapter.

AXIOM: all section classification goes through the Ada/SPARK core (FFI);
       this module only performs file I/O and JSON (de)serialization.
"""
import json
import os
from pathlib import Path

from run import load_library, bind

_LIB = None


def _lib():
    global _LIB
    if _LIB is None:
        _LIB = load_library()
        bind(_LIB)
    return _LIB


def _gnat_lib():
    return os.environ.get("DYLD_LIBRARY_PATH", "")


def classify_section(name: str) -> int:
    lib = _lib()
    buf = name.encode("utf-8")
    import ctypes
    return lib.ecc_state_section(ctypes.create_string_buffer(buf))


def load_state(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    with p.open() as f:
        return json.load(f)


def save_state(path: str, state: dict) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        json.dump(state, f, indent=2)


def set_section(path: str, section: str, value) -> dict:
    pos = classify_section(section)
    if pos < 0:
        raise ValueError(f"unknown state section: {section!r}")
    state = load_state(path)
    state[section] = value
    save_state(path, state)
    return state


def get_section(path: str, section: str):
    state = load_state(path)
    return state.get(section)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("usage: state_store.py <path> [get|set] [section] [json-value]")
        sys.exit(1)
    path = sys.argv[1]
    if len(sys.argv) >= 3 and sys.argv[2] == "get":
        print(json.dumps(get_section(path, sys.argv[3]), indent=2))
    elif len(sys.argv) >= 4 and sys.argv[2] == "set":
        val = json.loads(sys.argv[4]) if len(sys.argv) > 4 else None
        set_section(path, sys.argv[3], val)
        print("ok")
    else:
        print(json.dumps(load_state(path), indent=2))
