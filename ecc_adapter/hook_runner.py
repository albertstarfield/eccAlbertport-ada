"""ECC hook runtime executor.

Reads hooks/hooks.json to determine which scripts to run for a given
event+matcher, spawns them with the tool input on stdin, and interprets
exit codes (0 = allow, non-zero = block).

AXIOM: hook scripts are Node.js; this runner spawns them; classification
of hook events goes through the Ada/SPARK core.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ECC_ROOT = Path("/Users/albertstarfield/.config/opencode/targetAdaptation/ecc")
HOOKS_JSON = ECC_ROOT / "hooks" / "hooks.json"
HOOKS_DIR = ECC_ROOT / "scripts" / "hooks"


def load_hooks_config():
    if not HOOKS_JSON.exists():
        return {}
    try:
        return json.loads(HOOKS_JSON.read_text())
    except Exception:
        return {}


def run_hook(script: str, tool_input: dict, timeout: int = 10) -> dict:
    """Run a single hook script. Returns {exit_code, stdout, stderr}."""
    script_path = HOOKS_DIR / script
    if not script_path.exists():
        # Maybe it's a path relative to ECC_ROOT
        script_path = ECC_ROOT / script
    if not script_path.exists():
        return {"exit_code": 0, "stdout": "", "stderr": f"script not found: {script}"}
    try:
        proc = subprocess.run(
            ["node", str(script_path)],
            input=json.dumps(tool_input),
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(ECC_ROOT),
        )
        return {
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"exit_code": 124, "stdout": "", "stderr": "timeout"}
    except Exception as exc:
        return {"exit_code": 1, "stdout": "", "stderr": str(exc)}


def applicable_hooks(event: str, tool: str) -> list:
    """Return list of script paths to run for event+tool from hooks.json."""
    cfg = load_hooks_config()
    hooks_cfg = cfg.get("hooks", {})
    entries = hooks_cfg.get(event, [])
    scripts = []
    for entry in entries:
        matcher = entry.get("matcher", "")
        if matcher and matcher != "*" and tool not in matcher.split("|"):
            # matcher may be a regex-ish like "Edit|Write" or "Bash"
            import re
            try:
                if not re.search(matcher, tool):
                    continue
            except re.error:
                if tool != matcher:
                    continue
        for h in entry.get("hooks", []):
            cmd = h.get("command", "")
            # Extract the trailing script path from the command string.
            # Commands look like: node -e "..." node scripts/hooks/foo.js
            # We look for 'scripts/hooks/...' or 'scripts/...' in the command.
            import re as _re
            m = _re.search(r"(scripts/[^\s\"']+\.js)", cmd)
            if m:
                scripts.append(m.group(1))
            elif h.get("command", "").endswith(".js"):
                scripts.append(h["command"])
    return scripts


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("usage: hook_runner.py <event> <tool> [json-input]", file=sys.stderr)
        return 1
    event = argv[1]
    tool = argv[2]
    tool_input = {}
    if len(argv) > 3:
        try:
            tool_input = json.loads(argv[3])
        except json.JSONDecodeError:
            tool_input = {"raw": argv[3]}
    tool_input.setdefault("tool_name", tool)
    tool_input.setdefault("hook_event_name", event)

    scripts = applicable_hooks(event, tool)
    results = []
    blocked = False
    for script in scripts:
        r = run_hook(script, tool_input)
        results.append({"script": script, **r})
        if r["exit_code"] != 0:
            blocked = True

    print(json.dumps({"event": event, "tool": tool, "blocked": blocked,
                      "scripts_run": len(scripts), "results": results}))
    return 1 if blocked else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
