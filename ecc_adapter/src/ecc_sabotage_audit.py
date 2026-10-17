#!/usr/bin/env python3
"""
ecc_sabotage_audit.py — Sabotage Verifier integration for the ECC adapter.

AXIOMS:
    1. The sabotage verifier at ~/.local/share/opencode/sabotage_verifier.py
       is a standalone Python module with no package structure.
    2. It must be loaded via importlib.util.spec_from_file_location.
    3. Its BASE_DIR must be repointed to the ecc_adapter project root.

THEORY:
    Loading an external module and repointing its BASE_DIR is sufficient
    to integrate it without modifying the original file.

APPLICATIONS:
    This module exposes audit_file() and audit_project() for use by
    run.py and the build pipeline.

CITATIONS:
    [sabotage_verifier.py - ~/.local/share/opencode/sabotage_verifier.py]
    [importlib - https://docs.python.org/3/library/importlib.html]
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path
from typing import Any

# ── Constants ──────────────────────────────────────────────────────────────

VERIFIER_PATH = Path.home() / ".local/share/opencode/sabotage_verifier.py"
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# ── Module Loading ─────────────────────────────────────────────────────────

_verifier_module: Any = None


def _load_verifier() -> Any:
    """Load the sabotage verifier module via importlib.

    AXIOMS:
        1. The verifier file exists at VERIFIER_PATH.
        2. importlib.util.spec_from_file_location can load it as a module.
        3. module.BASE_DIR must be repointed to PROJECT_ROOT.

    Returns:
        The loaded module object.

    Raises:
        FileNotFoundError: If the verifier file does not exist.
        ImportError: If the module cannot be loaded.
    """
    global _verifier_module
    if _verifier_module is not None:
        return _verifier_module

    if not VERIFIER_PATH.exists():
        raise FileNotFoundError(
            f"Sabotage verifier not found at {VERIFIER_PATH}"
        )

    spec = importlib.util.spec_from_file_location(
        "sabotage_verifier", str(VERIFIER_PATH)
    )
    if spec is None or spec.loader is None:
        raise ImportError(
            f"Cannot create module spec for {VERIFIER_PATH}"
        )

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    # Repoint BASE_DIR to the ecc_adapter project root.
    # The verifier uses BASE_DIR for link cache, self-test venv, and
    # project_root detection in some patterns.
    module.BASE_DIR = str(PROJECT_ROOT)

    _verifier_module = module
    return module


# ── Public API ─────────────────────────────────────────────────────────────


def audit_file(
    filepath: str | Path,
    severity_filter: str | None = None,
) -> list[dict[str, Any]]:
    """Audit a single file for sabotage patterns.

    Args:
        filepath: Path to the file to audit.
        severity_filter: Optional severity filter (CRITICAL, HIGH, MEDIUM, LOW).

    Returns:
        List of violation dicts with keys: filepath, line, severity,
        category, message, standard, code_snippet, counterexample.

    Raises:
        FileNotFoundError: If the verifier module cannot be loaded.
    """
    module = _load_verifier()
    path = str(Path(filepath).resolve())

    violations = module.run_sabotage_audit(
        path, severity_filter=severity_filter
    )

    return [
        {
            "filepath": v.filepath,
            "line": v.line,
            "severity": v.severity.value if hasattr(v.severity, "value") else str(v.severity),
            "category": v.category,
            "message": v.message,
            "standard": v.standard,
            "code_snippet": v.code_snippet,
            "counterexample": v.counterexample,
        }
        for v in violations
    ]


def audit_project(
    severity_filter: str | None = None,
    extensions: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Audit the entire ecc_adapter project for sabotage patterns.

    Args:
        severity_filter: Optional severity filter.
        extensions: Optional list of file extensions to audit.
            Defaults to ['.py', '.adb', '.ads', '.c', '.h'].

    Returns:
        List of violation dicts.
    """
    module = _load_verifier()

    if extensions is None:
        extensions = [".py", ".adb", ".ads", ".c", ".h"]

    violations = module.audit_directory(
        str(PROJECT_ROOT),
        extensions=extensions,
        severity_filter=severity_filter,
    )

    return [
        {
            "filepath": v.filepath,
            "line": v.line,
            "severity": v.severity.value if hasattr(v.severity, "value") else str(v.severity),
            "category": v.category,
            "message": v.message,
            "standard": v.standard,
            "code_snippet": v.code_snippet,
            "counterexample": v.counterexample,
        }
        for v in violations
    ]


def get_severity_counts(violations: list[dict[str, Any]]) -> dict[str, int]:
    """Count violations by severity level.

    Args:
        violations: List of violation dicts from audit_file or audit_project.

    Returns:
        Dict mapping severity name to count.
    """
    counts: dict[str, int] = {}
    for v in violations:
        sev = v["severity"]
        counts[sev] = counts.get(sev, 0) + 1
    return counts


def format_report(violations: list[dict[str, Any]]) -> str:
    """Format violations as a human-readable report.

    Args:
        violations: List of violation dicts.

    Returns:
        Formatted report string.
    """
    if not violations:
        return "CLEAN: No sabotage patterns detected."

    lines = [f"SABOTAGE AUDIT REPORT — {len(violations)} violation(s) found"]
    lines.append("=" * 70)

    for i, v in enumerate(violations, 1):
        lines.append(f"\n[{i}] {v['severity']} — {v['category']}")
        lines.append(f"    File: {v['filepath']}:{v['line']}")
        lines.append(f"    Message: {v['message']}")
        if v["standard"]:
            lines.append(f"    Standard: {v['standard']}")
        if v["code_snippet"]:
            lines.append(f"    Code: {v['code_snippet']}")
        if v["counterexample"]:
            lines.append(f"    Counterexample: {v['counterexample']}")

    counts = get_severity_counts(violations)
    lines.append("\n" + "=" * 70)
    lines.append("SUMMARY:")
    for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        if sev in counts:
            lines.append(f"  {sev}: {counts[sev]}")

    return "\n".join(lines)


# ── CLI ────────────────────────────────────────────────────────────────────


def main() -> int:
    """CLI entry point for standalone sabotage audit.

    Usage:
        python3 src/ecc_sabotage_audit.py [file_or_dir] [--severity SEV] [--json]

    Returns:
        Exit code: 0 if clean, 1 if violations found.
    """
    args = sys.argv[1:]
    severity_filter = None
    as_json = False
    target = None

    i = 0
    while i < len(args):
        if args[i] == "--severity" and i + 1 < len(args):
            severity_filter = args[i + 1]
            i += 2
        elif args[i] == "--json":
            as_json = True
            i += 1
        elif args[i] == "--verbose":
            module = _load_verifier()
            module.set_verbose(True)
            i += 1
        else:
            target = args[i]
            i += 1

    if target is None:
        violations = audit_project(severity_filter=severity_filter)
    else:
        violations = audit_file(target, severity_filter=severity_filter)

    if as_json:
        print(json.dumps(violations, indent=2))
    else:
        print(format_report(violations))

    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
