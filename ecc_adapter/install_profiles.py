"""Install-profile executor for the ECC adapter.

Reads manifests/install-profiles.json and manifests/install-modules.json,
then copies the selected module's assets (by paths) into OpenCode locations.

AXIOM: classification/validation goes through the Ada core where applicable;
       this script only performs file I/O.
"""
import json
import shutil
import sys
from pathlib import Path

ECC_ROOT = Path("/Users/albertstarfield/.config/opencode/targetAdaptation/ecc")
OC_ROOT = Path("/Users/albertstarfield/.config/opencode")
PROFILES = json.loads((ECC_ROOT / "manifests" / "install-profiles.json").read_text())
MODULES_RAW = json.loads((ECC_ROOT / "manifests" / "install-modules.json").read_text())
MODULES = {m["id"]: m for m in MODULES_RAW["modules"]}


def list_profiles():
    for name, p in PROFILES["profiles"].items():
        print(f"  {name}: {p['description']}")


def module_applies_to_opencode(mod: dict) -> bool:
    return "opencode" in (mod.get("targets") or [])


def apply_module(mod: dict, dry_run: bool = False):
    mid = mod["id"]
    kind = mod.get("kind", "")
    paths = mod.get("paths", [])
    for rel in paths:
        src = ECC_ROOT / rel
        if not src.exists():
            continue
        # Map ECC paths to OpenCode locations.
        if rel.startswith("agents/"):
            dst = OC_ROOT / "agents" / "ecc" / src.name
        elif rel.startswith("skills/"):
            dst = OC_ROOT / "skills" / Path(rel).name
        elif rel.startswith("rules/"):
            dst = OC_ROOT / "rules" / "ecc" / Path(rel).relative_to("rules")
        elif rel.startswith("commands/"):
            dst = OC_ROOT / "commands" / "ecc" / Path(rel).relative_to("commands")
        elif rel.startswith("scripts/"):
            dst = OC_ROOT / "scripts" / "ecc" / Path(rel).relative_to("scripts")
        else:
            dst = OC_ROOT / "ecc_assets" / rel
        if dry_run:
            print(f"    [dry] {src} -> {dst}")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)


def apply_profile(profile_name: str, dry_run: bool = False):
    if profile_name not in PROFILES["profiles"]:
        print(f"unknown profile: {profile_name}", file=sys.stderr)
        return 1
    modules = PROFILES["profiles"][profile_name]["modules"]
    # Resolve dependencies.
    resolved = set()
    def resolve(mid):
        if mid in resolved:
            return
        mod = MODULES.get(mid)
        if not mod:
            return
        for dep in mod.get("dependencies", []):
            resolve(dep)
        resolved.add(mid)
    for m in modules:
        resolve(m)
    # Filter to opencode-applicable modules.
    applicable = [MODULES[m] for m in resolved if m in MODULES and module_applies_to_opencode(MODULES[m])]
    print(f"Applying profile '{profile_name}': {len(applicable)} modules (of {len(resolved)} resolved)")
    for mod in applicable:
        print(f"  module {mod['id']} ({mod.get('kind')})")
        apply_module(mod, dry_run=dry_run)
    print("profile applied" + (" (dry-run)" if dry_run else ""))
    return 0


def main(argv):
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print("usage: install_profiles.py <profile> [--dry-run]  OR  --list")
        if "--list" in argv:
            list_profiles()
        return 0
    if argv[1] == "--list":
        list_profiles()
        return 0
    dry = "--dry-run" in argv
    return apply_profile(argv[1], dry_run=dry)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
