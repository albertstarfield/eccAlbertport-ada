export const id = "local/eccAlbertPort-adaSpark-Hybrid-FuckYouJSStatusquo-arch"

const setup = async (ctx: any): Promise<() => void> => {
  const { execFileSync } = await import("child_process")
  const fs = await import("fs")
  const ADAPTER_DIR = "/Users/albertstarfield/.config/opencode/ecc_adapter"
  const LIB_PATH = `${ADAPTER_DIR}/lib/libEcc_Adapter.dylib`
  const VENV_DIR = `${ADAPTER_DIR}/.venv`
  const VENV_PY = `${VENV_DIR}/bin/python3`
  const RUN_PY = `${ADAPTER_DIR}/run.py`
  // Dynamically discover the GNAT adalib directory (no hardcoded version path).
  const findGnatLib = (): string => {
    const home = process.env.HOME || ""
    const base = home + "/.local/share/alire/toolchains"
    try {
      const fs2 = require("fs")
      const dirs = fs2.readdirSync(base).filter((d: string) => d.startsWith("gnat_native_"))
      if (dirs.length === 0) return ""
      const latest = dirs.sort().pop()
      // search adalib under it
      const toolRoot = base + "/" + latest
      const walk = (dir: string): string => {
        let res = ""
        try {
          for (const e of fs2.readdirSync(dir, { withFileTypes: true })) {
            const full = dir + "/" + e.name
            if (e.isDirectory()) {
              if (e.name === "adalib") {
                try {
                  if (fs2.readdirSync(full).some((f: string) => f.startsWith("libgnat"))) return full
                } catch {}
              }
              const r = walk(full)
              if (r) return r
            }
          }
        } catch {}
        return res
      }
      return walk(toolRoot)
    } catch { return "" }
  }
  const GNAT_LIB = findGnatLib() || process.env.GNAT_LIB || ""
  const ENV = { ...process.env, DYLD_LIBRARY_PATH: GNAT_LIB + (process.env.DYLD_LIBRARY_PATH ? ":" + process.env.DYLD_LIBRARY_PATH : ""), MACOSX_DEPLOYMENT_TARGET: "14.0" }

  // 1. Auto-compile the Ada/SPARK core if the library is missing.
  if (!fs.existsSync(LIB_PATH)) {
    try {
      execFileSync("alr", ["-n", "build"], { cwd: ADAPTER_DIR, stdio: "inherit", env: ENV })
    } catch (e) {
      console.error("[ecc-adapter] auto-build failed:", e)
    }
  }

  // 2. Bootstrap an isolated Python venv (no global installs) and install requirements.
  if (!fs.existsSync(VENV_PY)) {
    try {
      execFileSync("python3", ["-m", "venv", VENV_DIR], { cwd: ADAPTER_DIR, stdio: "inherit" })
      execFileSync(VENV_PY, ["-m", "pip", "install", "--upgrade", "pip"], { cwd: ADAPTER_DIR, stdio: "inherit", env: ENV })
      execFileSync(VENV_PY, ["-m", "pip", "install", "-r", "requirements.txt"], { cwd: ADAPTER_DIR, stdio: "inherit", env: ENV })
    } catch (e) {
      console.error("[ecc-adapter] venv bootstrap failed:", e)
    }
  }

  // 3. Verify the FFI bridge end-to-end and surface status.
  const py = fs.existsSync(VENV_PY) ? VENV_PY : "python3"
  try {
    const out = execFileSync(py, [RUN_PY, "selftest"], { cwd: ADAPTER_DIR, encoding: "utf8", env: ENV })
    console.log("[ecc-adapter] selftest OK:\n" + out)
  } catch (e: any) {
    console.error("[ecc-adapter] selftest failed:", e?.stderr || e?.message || e)
  }

  return () => {}
}

export default { id, setup }
