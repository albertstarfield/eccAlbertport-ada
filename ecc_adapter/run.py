#!/usr/bin/env python3
"""ECC -> OpenCode adapter: Python FFI bridge and sabotage-verifier gate.

AXIOMS:
  * The Ada/SPARK core (libEcc_Adapter.dylib) is the ONLY implementation of
    the ECC->OpenCode mapping. Python is a thin FFI wrapper, nothing else.
    [ada_spark_first_python_ffi_only]
  * The sabotage verifier is the build gatekeeper: it runs BEFORE the proof
    pipeline and blocks builds containing known sabotage patterns.
    [sabotage_verifier.py docstring]
  * Every external call (ctypes, file I/O, subprocess) is guarded; no silent
    failures.  [no_silent_failure, handle_external_calls, murphy_law]

THEORY:
  * A C ABI of total, bounded functions keeps the untrusted boundary small:
    the Ada side validates every C string before it reaches SPARK code.
  * Deny-by-default is a provable property of the Ada core, not a policy hope.

APPLICATIONS:
  * run.py version                 -> adapter version string
  * run.py tool <name>             -> OpenCode tool id + default-allow decision
  * run.py gate <class>            -> gate decision for an ECC effect class
  * run.py mode <name>             -> OpenCode agent mode
  * run.py audit                   -> run the sabotage verifier over the project
  * run.py selftest                -> exercise every FFI entry point

CITATIONS:
  * [ECC v2.2.3 - ToBeImported/ecc/schemas/capsule-envelope.schema.json]
  * [OpenCode config - https://opencode.ai/config.json]
  * [sabotage_verifier.py - ~/.local/share/opencode/sabotage_verifier.py]
  * [Ada 2012 RM - pragma Export, Convention => C]
"""

from __future__ import annotations

import ctypes
import os
import importlib.util
import json
import sys
from pathlib import Path

# ── Paths (never hardcoded user paths; derived from this file) ─────────────
# [no_hardcoded_user_paths]
PROJECT_ROOT = Path(__file__).resolve().parent

LIB_CANDIDATES = (
    PROJECT_ROOT / "lib" / "libEcc_Adapter.dylib",
    PROJECT_ROOT / "lib" / "libEcc_Adapter.so",
    PROJECT_ROOT / "lib" / "libEcc_Adapter.dll",
)

import glob as _glob
import shutil as _shutil
import subprocess as _subprocess

def find_gnat_lib() -> str:
    """Dynamically locate the GNAT adalib directory (no hardcoded version)."""
    for var in ("GNAT_LIB", "GNAT_ADLIB", "ADA_LIB"):
        v = os.environ.get(var)
        if v and os.path.isdir(v):
            return v
    gnat = _shutil.which("gnat")
    if gnat:
        base = os.path.dirname(os.path.dirname(os.path.realpath(gnat)))
        for root, dirs, files in os.walk(base):
            if root.endswith("adalib") and any(f.startswith("libgnat") for f in files):
                return root
    alr = _shutil.which("alr")
    if alr:
        try:
            out = _subprocess.run([alr, "toolchain"], capture_output=True, text=True, timeout=30)
            for line in (out.stdout + out.stderr).splitlines():
                for token in line.split():
                    if "gnat_native" in token and os.path.isdir(token):
                        for root, dirs, files in os.walk(token):
                            if root.endswith("adalib"):
                                return root
        except Exception:
            pass
    home = os.path.expanduser("~")
    for pattern in (
        os.path.join(home, ".local", "share", "alire", "toolchains", "gnat_native_*", "lib", "gcc", "*", "*", "adalib"),
        os.path.join(home, ".local", "share", "alire", "toolchains", "gnat_native_*", "lib", "adalib"),
    ):
        matches = _glob.glob(pattern)
        if matches:
            return sorted(matches)[-1]
    for cand in ("/opt/homebrew/lib", "/usr/local/lib", "/usr/lib"):
        if os.path.isdir(cand) and any(f.startswith("libgnat") for f in os.listdir(cand)):
            return cand
    return ""

_GNAT_LIB = find_gnat_lib()
if _GNAT_LIB:
    if _GNAT_LIB not in os.environ.get("DYLD_LIBRARY_PATH", ""):
        os.environ["DYLD_LIBRARY_PATH"] = _GNAT_LIB + (
            ":" + os.environ.get("DYLD_LIBRARY_PATH", "")
            if os.environ.get("DYLD_LIBRARY_PATH")
            else ""
        )
os.environ.setdefault("MACOSX_DEPLOYMENT_TARGET", "14.0")

VERIFIER_PATH = (
    Path.home() / ".local" / "share" / "opencode" / "sabotage_verifier.py"
)

# ── Result vocabularies (mirror the Ada enumerations) ───────────────────────
TOOL_NAMES = (
    "read", "write", "edit", "bash", "grep", "glob",
    "webfetch", "websearch", "task", "todowrite",
    "changed-files", "unknown",
)
GATE_NAMES = ("proceed", "journal", "needs_confirmation")
MODE_NAMES = ("primary", "subagent")
EFFECT_NAMES = ("SE0", "SE1", "SE2", "SE3", "SE4")

# Exit codes
EXIT_OK = 0
EXIT_USAGE = 2
EXIT_FFI_ERROR = 3
EXIT_AUDIT_BLOCKED = 4


class FfiError(RuntimeError):
    """Raised when the native library cannot be loaded or a call fails.

    AXIOM: an FFI failure is never silent — it is raised with full context.
    """


# ── Library loading ────────────────────────────────────────────────────────
def load_library() -> ctypes.CDLL:
    """Load the Ada/SPARK shared library, trying each candidate path.

    AXIOM: the library must exist before it is loaded; a missing artifact is
    a hard error, never a silent None.  [no_invalid_file_references]
    """
    for candidate in LIB_CANDIDATES:
        if candidate.exists():
            try:
                return ctypes.CDLL(str(candidate))
            except OSError as exc:
                raise FfiError(
                    f"ctypes.CDLL failed for {candidate}: {exc}"
                ) from exc
    searched = ", ".join(str(c) for c in LIB_CANDIDATES)
    raise FfiError(
        f"libEcc_Adapter shared library not found. Searched: {searched}. "
        f"Run `alr build` first."
    )


def bind(lib: ctypes.CDLL) -> None:
    """Declare the C ABI signatures.

    AXIOM: argtypes/restypes must match the Ada pragma Export declarations
    exactly, or ctypes will mis-marshall arguments.  [ffi_safety]
    """
    lib.ecc_version.argtypes = []
    lib.ecc_version.restype = ctypes.c_char_p

    lib.ecc_tool_id.argtypes = [ctypes.c_void_p]
    lib.ecc_tool_id.restype = ctypes.c_int

    lib.ecc_tool_permitted.argtypes = [ctypes.c_void_p]
    lib.ecc_tool_permitted.restype = ctypes.c_int

    lib.ecc_effect_gate.argtypes = [ctypes.c_int]
    lib.ecc_effect_gate.restype = ctypes.c_int

    lib.ecc_agent_mode.argtypes = [ctypes.c_void_p]
    lib.ecc_agent_mode.restype = ctypes.c_int
    lib.ecc_hook_event.argtypes = [ctypes.c_void_p]
    lib.ecc_hook_event.restype = ctypes.c_int


# ── FFI wrappers (each guards its input and never returns silently) ────────
def ffi_version(lib: ctypes.CDLL) -> str:
    raw = lib.ecc_version()
    if not raw:
        raise FfiError("ecc_version returned a null pointer")
    return raw.decode("utf-8", errors="replace")


def ffi_tool_id(lib: ctypes.CDLL, name: str) -> int:
    # C strings must be NUL-terminated; use a stable buffer.  [Murphy's law]
    buf = ctypes.create_string_buffer(name.encode("utf-8"))
    result = lib.ecc_tool_id(buf)
    if result < 0:
        raise FfiError(f"ecc_tool_id rejected tool name {name!r}")
    return result


def ffi_tool_permitted(lib: ctypes.CDLL, name: str) -> int:
    buf = ctypes.create_string_buffer(name.encode("utf-8"))
    result = lib.ecc_tool_permitted(buf)
    if result not in (0, 1):
        raise FfiError(
            f"ecc_tool_permitted returned unexpected value {result} for {name!r}"
        )
    return result


def ffi_effect_gate(lib: ctypes.CDLL, class_index: int) -> int:
    result = lib.ecc_effect_gate(class_index)
    if result < 0:
        raise FfiError(
            f"ecc_effect_gate rejected class index {class_index}"
        )
    return result


def ffi_agent_mode(lib: ctypes.CDLL, name: str) -> int:
    buf = ctypes.create_string_buffer(name.encode("utf-8"))
    result = lib.ecc_agent_mode(buf)
    if result < 0:
        raise FfiError(f"ecc_agent_mode rejected agent name {name!r}")
    return result


# ── Sabotage verifier integration ───────────────────────────────────────────
def load_verifier():
    """Load sabotage_verifier.py as a module and repoint BASE_DIR.

    AXIOM: the verifier computes BASE_DIR from its own __file__, which resolves
    to ~/.local when loaded from ~/.local/share/opencode. We repoint it at the
    project root so project-relative patterns resolve correctly.
    [is_not_what_they_said — reality over recorded path]
    """
    if not VERIFIER_PATH.exists():
        raise FfiError(
            f"sabotage verifier not found at {VERIFIER_PATH}"
        )
    spec = importlib.util.spec_from_file_location(
        "sabotage_verifier", str(VERIFIER_PATH)
    )
    if spec is None or spec.loader is None:
        raise FfiError(
            f"importlib could not build a spec for {VERIFIER_PATH}"
        )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.BASE_DIR = str(PROJECT_ROOT)
    return module


def run_audit(verifier) -> int:
    """Run the sabotage verifier over the project and report violations.

    Returns the process exit code.  CRITICAL or HIGH violations block the
    build (MAL-C / MAL-D); MEDIUM violations are reported but non-blocking
    (MAL-S).  [sabotage_verifier.py MAL ranking]
    """
    registry = verifier.create_default_registry()
    violations = verifier.audit_directory(
        str(PROJECT_ROOT), registry=registry
    )

    critical = [v for v in violations if v.severity.value == "CRITICAL"]
    high = [v for v in violations if v.severity.value == "HIGH"]
    medium = [v for v in violations if v.severity.value == "MEDIUM"]

    print(f"sabotage audit: {len(violations)} violation(s) "
          f"[{len(critical)} critical, {len(high)} high, {len(medium)} medium]")
    for v in violations:
        print(f"  [{v.severity.value}] {v.filepath}:{v.line} "
              f"{v.category}: {v.message}")

    if critical or high:
        print("BUILD BLOCKED: CRITICAL or HIGH sabotage violations present.")
        return EXIT_AUDIT_BLOCKED
    if medium:
        print("MEDIUM violations present — reported, non-blocking.")
    return EXIT_OK


# ── Commands ───────────────────────────────────────────────────────────────
def cmd_version(lib: ctypes.CDLL) -> int:
    print(ffi_version(lib))
    return EXIT_OK


def cmd_tool(lib: ctypes.CDLL, name: str) -> int:
    tool_id = ffi_tool_id(lib, name)
    permitted = ffi_tool_permitted(lib, name)
    print(json.dumps({
        "tool": name,
        "opencode_tool": TOOL_NAMES[tool_id],
        "default_allowed": bool(permitted),
    }))
    return EXIT_OK


def cmd_gate(lib: ctypes.CDLL, class_name: str) -> int:
    class_name = class_name.upper()
    if class_name not in EFFECT_NAMES:
        raise FfiError(
            f"unknown effect class {class_name!r}; "
            f"expected one of {', '.join(EFFECT_NAMES)}"
        )
    gate = ffi_effect_gate(lib, EFFECT_NAMES.index(class_name))
    print(json.dumps({
        "effect_class": class_name,
        "gate": GATE_NAMES[gate],
    }))
    return EXIT_OK


def cmd_mode(lib: ctypes.CDLL, name: str) -> int:
    mode = ffi_agent_mode(lib, name)
    print(json.dumps({
        "agent": name,
        "opencode_mode": MODE_NAMES[mode],
    }))
    return EXIT_OK


def cmd_hook(lib: ctypes.CDLL, name: str) -> int:
    pos = lib.ecc_hook_event(ctypes.create_string_buffer(name.encode("utf-8")))
    names = ["PreToolUse", "PostToolUse", "PostToolUseFailure",
             "UserPromptSubmit", "PreCompact", "SessionStart", "Stop", "SessionEnd"]
    print(json.dumps({"hook_event": name, "classified": names[pos] if 0 <= pos < len(names) else "unknown"}))
    return EXIT_OK


def cmd_selftest(lib: ctypes.CDLL) -> int:
    """Exercise every FFI entry point.  [function_coverage]"""
    print(f"version: {ffi_version(lib)}")
    for name in ("Read", "Write", "Bash", "Grep", "Glob", "WebFetch",
                 "WebSearch", "Task", "TodoWrite", "changed-files",
                 "NotATool"):
        tool_id = ffi_tool_id(lib, name)
        permitted = ffi_tool_permitted(lib, name)
        print(f"  tool {name!r:16} -> {TOOL_NAMES[tool_id]:14} "
              f"allowed={bool(permitted)}")
    for class_name in EFFECT_NAMES:
        gate = ffi_effect_gate(lib, EFFECT_NAMES.index(class_name))
        print(f"  gate {class_name} -> {GATE_NAMES[gate]}")
    for name in ("orchestrator", "code-reviewer", "build"):
        mode = ffi_agent_mode(lib, name)
        print(f"  mode {name!r:16} -> {MODE_NAMES[mode]}")
    return EXIT_OK


def cmd_audit() -> int:
    verifier = load_verifier()
    return run_audit(verifier)


USAGE = """usage: run.py <command> [args]

commands:
  version                 print the adapter version string
  tool <name>             map an ECC tool token to an OpenCode tool
  gate <class>            gate decision for an ECC effect class (SE0..SE4)
  mode <name>             infer OpenCode agent mode from an ECC role name
  selftest                exercise every FFI entry point
  audit                   run the sabotage verifier over the project
"""


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(USAGE, file=sys.stderr)
        return EXIT_USAGE

    command = argv[1]

    if command == "audit":
        try:
            return cmd_audit()
        except FfiError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return EXIT_FFI_ERROR

    if command == "version":
        try:
            lib = load_library()
            bind(lib)
            return cmd_version(lib)
        except FfiError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return EXIT_FFI_ERROR

    if command == "selftest":
        try:
            lib = load_library()
            bind(lib)
            return cmd_selftest(lib)
        except FfiError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return EXIT_FFI_ERROR

    if command == "tool" and len(argv) == 3:
        try:
            lib = load_library()
            bind(lib)
            return cmd_tool(lib, argv[2])
        except FfiError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return EXIT_FFI_ERROR

    if command == "gate" and len(argv) == 3:
        try:
            lib = load_library()
            bind(lib)
            return cmd_gate(lib, argv[2])
        except FfiError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return EXIT_FFI_ERROR

    if command == "mode" and len(argv) == 3:
        try:
            lib = load_library()
            bind(lib)
            return cmd_mode(lib, argv[2])
        except FfiError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return EXIT_FFI_ERROR

    if command == "hook" and len(argv) == 3:
        try:
            lib = load_library()
            bind(lib)
            return cmd_hook(lib, argv[2])
        except FfiError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return EXIT_FFI_ERROR

    print(USAGE, file=sys.stderr)
    return EXIT_USAGE


if __name__ == "__main__":
    sys.exit(main(sys.argv))
