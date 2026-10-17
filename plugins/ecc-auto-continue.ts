export const id = "local/eccAlbertPort-adaSpark-Hybrid-FuckYouJSStatusquo-arch-autocontinue"

const setup = async (ctx: any): Promise<() => void> => {
  const { execFileSync } = await import("child_process")
  const fs = await import("fs")
  const ADAPTER_DIR = "/Users/albertstarfield/.config/opencode/ecc_adapter"
  const LIB_PATH = `${ADAPTER_DIR}/lib/libEcc_Adapter.dylib`
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

  const LAZY_PHRASES = [
    "remaining", "i'll do later", "close enough", "good enough",
    "partially", "for now", "to be continued", "in a follow-up",
    "remaining work", "left to do", "not yet", "todo", "will finish",
    "next time", "later", "skipped", "deferred",
  ]

  const pending = new Set<string>()
  const lastMessage = new Map<string, string>()
  const retryCount = new Map<string, number>()
  const MAX_RETRIES = 100

  const getNeedle = (): string => {
    const needlePath = (process.cwd() || ".") + "/.ecc/needle"
    try {
      const n = (fs as any).readFileSync(needlePath, "utf8").trim()
      if (n && n.length === 8) return n
    } catch {}
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)]
    try { (fs as any).mkdirSync((process.cwd() || ".") + "/.ecc", { recursive: true }); (fs as any).writeFileSync(needlePath, result) } catch {}
    return result
  }

  let NEEDLE = getNeedle()

  const hasNeedle = (text: string): boolean => text.includes(NEEDLE)
  const isLazy = (text: string): boolean => {
    const lower = text.toLowerCase()
    return LAZY_PHRASES.some((p) => lower.includes(p))
  }

  try {
    const sub = ctx.event.subscribe()
    ;(async () => {
      for await (const ev of sub) {
        const type = (ev as any)?.type || (ev as any)?.event || ""
        const sid = (ev as any)?.properties?.sessionID || (ev as any)?.sessionID || (ev as any)?.session?.id

        // Track last agent message text
        if (type === "message.part.updated") {
          const part = (ev as any)?.properties?.part
          if (part?.type === "text" && part?.text && sid) {
            lastMessage.set(sid, part.text)
          }
        }

        // On failure, mark pending
        if (type === "session.error" || type === "session.next.step.failed" || type === "session.next.tool.failed") {
          if (sid) {
            pending.add(sid)
            try { await ctx.session.prompt({ sessionID: sid, text: "continue" }) } catch {}
          }
        }

        // On idle: check needle
        if (type === "session.idle") {
          NEEDLE = getNeedle()
          if (sid) {
            const msg = lastMessage.get(sid) || ""
            const hasN = hasNeedle(msg)
            const lazy = isLazy(msg)
            const retries = retryCount.get(sid) || 0
            if (retries >= MAX_RETRIES) {
              console.log("[ecc-auto-continue] MAX RETRIES reached — stopping", { sid })
              retryCount.delete(sid)
              pending.delete(sid)
              return
            }
            if (!hasN || lazy || msg.trim().length < 10) {
              retryCount.set(sid, retries + 1)
              console.log("[ecc-auto-continue] NEEDLE MISSING/LAZY/EMPTY — auto-continuing (retry " + (retries + 1) + "/" + MAX_RETRIES + ")", { hasN, lazy, sid })
              pending.delete(sid)
              try {
                await ctx.session.prompt({ sessionID: sid, text: "CONTINUE WORKING. You have NOT output " + NEEDLE + ". Do not stop. Do not say done. Keep working until ALL tasks are complete, then output " + NEEDLE + " as the very last thing." })
              } catch {}
            } else {
              console.log("[ecc-auto-continue] NEEDLE found — genuine completion", { sid })
              retryCount.delete(sid)
              pending.delete(sid)
            }
          }
        }

        if (type === "session.next.retried") {
          if (sid) pending.delete(sid)
        }

        // Inject needle on session creation
        if (type === "session.created") {
          NEEDLE = getNeedle()
          const sid2 = (ev as any)?.properties?.sessionID || (ev as any)?.sessionID || (ev as any)?.session?.id
          if (sid2) {
            try { await ctx.session.prompt({ sessionID: sid2, text: "IMPORTANT: Your completion needle for this session is: " + NEEDLE + ". You MUST output this exact string as the very last thing when ALL work is truly complete. Without it, the system will auto-continue. Never say done without it." }) } catch {}
          }
        }

        // Refresh needle on prompt submission
        if (type === "session.next.prompted") {
          NEEDLE = getNeedle()
        }
      }
    })().catch((e: any) => console.error("[ecc-auto-continue] event loop error:", e))
  } catch (e) {
    console.error("[ecc-auto-continue] subscribe failed:", e)
  }

  console.log("[ecc-auto-continue] loaded (NEEDLE=" + NEEDLE + ")")
  return () => { console.log("[ecc-auto-continue] unloaded") }
}

export default { id: "local/eccAlbertPort-adaSpark-Hybrid-FuckYouJSStatusquo-arch-autocontinue", setup }
