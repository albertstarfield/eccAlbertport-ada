#!/usr/bin/env bash
# build.sh — build the Ada/SPARK core, fix the macOS rpath, run the verifier.
#
# AXIOMS:
#   * The Ada/SPARK core is the primary implementation; Python is FFI only.
#   * The sabotage verifier runs BEFORE the proof pipeline and blocks builds
#     containing known sabotage patterns.
#   * Every external call is checked; no silent failures.
#
# CITATIONS:
#   [alire - https://alire.ada.dev/]
#   [sabotage_verifier.py - ~/.local/share/opencode/sabotage_verifier.py]
set -euo pipefail

cd "$(dirname "$0")"

echo "==> alr build"
alr -n build

LIB="lib/libEcc_Adapter.dylib"
if [ ! -f "$LIB" ]; then
    echo "error: expected $LIB after alr build" >&2
    exit 1
fi
echo "==> built $LIB"

# ── Fix the macOS rpath ───────────────────────────────────────────────────
# gprbuild emits LC_RPATH entries with a lower-cased /users/ prefix and a
# relative @loader_path form; on a case-sensitive macOS volume neither
# resolves, so libgnat-16.dylib is "not loaded".  Add the real absolute
# path so dyld can find the GNAT runtime.  [is_not_what_they_said — the
# recorded rpath is a claim; the filesystem is the reality.]
fix_rpath() {
    local lib="$1"
    local gnatlib
    gnatlib="$(dirname "$(find "$HOME/.local/share/alire/toolchains" \
        -name 'libgnat-16.dylib' -not -path '*.dSYM*' 2>/dev/null \
        | head -n 1)")"
    if [ -z "$gnatlib" ]; then
        echo "warning: libgnat-16.dylib not found; rpath not fixed" >&2
        return 0
    fi
    install_name_tool -add_rpath "$gnatlib" "$lib"
    echo "==> rpath fixed: $gnatlib"
}
fix_rpath "$LIB"

echo "==> sabotage verifier gate"
python3 run.py audit
