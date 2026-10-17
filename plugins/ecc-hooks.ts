export const id = "local/eccAlbertPort-adaSpark-Hybrid-FuckYouJSStatusquo-arch-hooks"

const setup = async (ctx: any): Promise<() => void> => {
  const { execFileSync } = await import("child_process")
  const fs = await import("fs")
  const ADAPTER_DIR = "/Users/albertstarfield/.config/opencode/ecc_adapter"
  const LIB_PATH = `${ADAPTER_DIR}/lib/libEcc_Adapter.dylib`
  const VENV_PY = `${ADAPTER_DIR}/.venv/bin/python3`
  const RUN_PY = `${ADAPTER_DIR}/run.py`
  const findGnatLib = (): string => {
    const home = process.env.HOME || ""
    const base = home + "/.local/share/alire/toolchains"
    try {
      const dirs = (fs as any).readdirSync(base).filter((d: string) => d.startsWith("gnat_native_"))
      if (dirs.length === 0) return ""
      const toolRoot = base + "/" + dirs.sort().pop()
      const walk = (dir: string): string => {
        let res = ""
        try {
          for (const e of (fs as any).readdirSync(dir, { withFileTypes: true })) {
            const full = dir + "/" + e.name
            if (e.isDirectory()) {
              if (e.name === "adalib") {
                try {
                  if ((fs as any).readdirSync(full).some((f: string) => f.startsWith("libgnat"))) return full
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

  // Auto-build if missing
  if (!(fs as any).existsSync(LIB_PATH)) {
    try { execFileSync("alr", ["-n", "build"], { cwd: ADAPTER_DIR, stdio: "inherit", env: ENV }) } catch (e) { console.error("[ecc-hooks] build failed:", e) }
  }

  const callAda = (cmd: string, arg: string): string => {
    const py = (fs as any).existsSync(VENV_PY) ? VENV_PY : "python3"
    try { return execFileSync(py, [RUN_PY, cmd, arg], { cwd: ADAPTER_DIR, encoding: "utf8", env: ENV }).trim() } catch (e: any) { return "" }
  }

  const runHook = (event: string, tool: string, input: any): any => {
    const py = (fs as any).existsSync(VENV_PY) ? VENV_PY : "python3"
    const HOOK_RUNNER = ADAPTER_DIR + "/hook_runner.py"
    try {
      const out = execFileSync(py, [HOOK_RUNNER, event, tool, JSON.stringify(input || {})], { cwd: ADAPTER_DIR, encoding: "utf8", env: ENV })
      return JSON.parse(out)
    } catch (e: any) {
      try { return JSON.parse(e?.stdout || "{}") } catch { return { blocked: false } }
    }
  }

  // Subscribe to events and classify
  try {
    const sub = ctx.event.subscribe()
    ;(async () => {
      for await (const ev of sub) {
        const type = (ev as any)?.type || (ev as any)?.event || ""
        if (typeof type === "string" && type.toLowerCase().includes("tool")) {
          const name = (ev as any)?.tool || (ev as any)?.name || ""
          const input = (ev as any)?.input || (ev as any)?.args || {}
          if (name) {
            const evtClass = callAda("hook", name)
            const result = runHook("PreToolUse", name, input)
            if (result?.blocked) {
              console.log("[ecc-hooks] BLOCKED:", name, result)
            } else {
              console.log("[ecc-hooks] allowed:", name, evtClass)
            }
          }
        }
      }
    })().catch((e: any) => console.error("[ecc-hooks] event loop error:", e))
  } catch (e) {
    console.error("[ecc-hooks] subscribe failed:", e)
  }

  console.log("[ecc-hooks] loaded")
  return () => { console.log("[ecc-hooks] unloaded") }
}

export default { id, setup }
