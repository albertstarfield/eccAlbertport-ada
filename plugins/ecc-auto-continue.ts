export const id = "local/eccAlbertPort-adaSpark-Hybrid-FuckYouJSStatusquo-arch-autocontinue"

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

  if (!(fs as any).existsSync(LIB_PATH)) {
    try { execFileSync("alr", ["-n", "build"], { cwd: ADAPTER_DIR, stdio: "inherit", env: ENV }) } catch (e) { console.error("[ecc-auto-continue] build failed:", e) }
  }

  // Auto-continue logic: on session.idle with pending work, send "continue".
  const pending = new Set<string>()
  try {
    const sub = ctx.event.subscribe()
    ;(async () => {
      for await (const ev of sub) {
        const type = (ev as any)?.type || (ev as any)?.event || ""
        if (type === "session.execution.failed" || type === "session.step.failed") {
          const sid = (ev as any)?.sessionID || (ev as any)?.session?.id
          if (sid) { pending.add(sid); try { await ctx.session.prompt({ sessionID: sid, text: "continue" }) } catch {} }
        }
        if (type === "session.idle") {
          const sid = (ev as any)?.sessionID || (ev as any)?.session?.id
          if (sid && pending.has(sid)) {
            pending.delete(sid)
            try { await ctx.session.prompt({ sessionID: sid, text: "continue" }) } catch {}
          }
        }
        if (type === "session.retry.scheduled") {
          const sid = (ev as any)?.sessionID || (ev as any)?.session?.id
          if (sid) pending.delete(sid)
        }
      }
    })().catch((e: any) => console.error("[ecc-auto-continue] event loop error:", e))
  } catch (e) {
    console.error("[ecc-auto-continue] subscribe failed:", e)
  }

  console.log("[ecc-auto-continue] loaded (ECC-enforced continue)")
  return () => { console.log("[ecc-auto-continue] unloaded") }
}

export default { id, setup }
