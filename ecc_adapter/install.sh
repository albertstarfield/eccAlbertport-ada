#!/usr/bin/env bash
# install.sh — bootstrap the ECC Ada/SPARK adapter for OpenCode.
# AXIOM: every step is idempotent; re-running is safe.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "[1/4] Building Ada/SPARK library (alr)..."
alr -n build

echo "[2/4] Formal verification (gnatprove --level=4)..."
gnatprove -P ecc_adapter.gpr --level=4 --mode=all -j0

echo "[3/4] Bootstrapping Python venv..."
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install --upgrade pip >/dev/null
if [ -f requirements.txt ]; then
  .venv/bin/pip install -r requirements.txt
fi

echo "[4/4] Self-test via FFI..."
GNAT_LIB="/Users/albertstarfield/.local/share/alire/toolchains/gnat_native_16.1.0_657cf254/lib/gcc/aarch64-apple-darwin24.6.0/16.1.0/adalib"
DYLD_LIBRARY_PATH="$GNAT_LIB" MACOSX_DEPLOYMENT_TARGET=14.0 .venv/bin/python run.py selftest

echo "INSTALL OK"
