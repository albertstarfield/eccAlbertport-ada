export const id = "local/eccAlbertPort-adaSpark-Hybrid-FuckYouJSStatusquo-arch-autocontinue"

function generateNeedle(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
const NEEDLE = generateNeedle()
const LAZY_PHRASES = [
  "remaining", "i'll do later", "close enough", "good enough",
  "partially", "for now", "to be continued", "in a follow-up",
  "remaining work", "left to do", "not yet", "todo", "will finish",
  "next time", "later", "skipped", "deferred",
]

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

  const pending = new Set<string>()
  const lastMessage = new Map<string, string>()
  const retryCount = new Map<string, number>()
  const MAX_RETRIES = 10

  const hasNeedle = (text: string): boolean => {
    return text.includes(NEEDLE)
  }

  const isLazy = (text: string): boolean => {
    const lower = text.toLowerCase()
    return LAZY_PHRASES.some((p) => lower.includes(p))
  }

  try {
    const sub = ctx.event.subscribe()
    ;(async () => {
      for await (const ev of sub) {
        const type = (ev as any)?.type || (ev as any)?.event || ""
        const sid = (ev as any)?.sessionID || (ev as any)?.session?.id

        // Track last agent message
        if (type === "message.created" || type === "assistant.message" || type === "message.assistant") {
          const text = (ev as any)?.text || (ev as any)?.content || (ev as any)?.message?.content || ""
          if (sid && text) lastMessage.set(sid, text)
        }

        // On failure, mark pending
        if (type === "session.execution.failed" || type === "session.step.failed") {
          if (sid) { pending.add(sid); try { await ctx.session.prompt({ sessionID: sid, text: "continue" }) } catch {} }
        }

        // On idle: check needle
        if (type === "session.idle") {
          if (sid) {
            const msg = lastMessage.get(sid) || ""
            const hasN = hasNeedle(msg)
            const lazy = isLazy(msg)
            const retries = retryCount.get(sid) || 0
            if (retries >= MAX_RETRIES) {
              console.log("[ecc-auto-continue] MAX RETRIES reached — stopping auto-continue", { sid })
              retryCount.delete(sid)
              pending.delete(sid)
              return
            }
            if (!hasN || lazy || msg.trim().length < 10) {
              retryCount.set(sid, retries + 1)
              console.log("[ecc-auto-continue] NEEDLE MISSING/LAZY/EMPTY — auto-continuing (retry " + (retries + 1) + "/" + MAX_RETRIES + ")", { hasN, lazy, sid })
              pending.delete(sid)
              try { await ctx.session.prompt({ sessionID: sid, text: "CONTINUE WORKING. You have NOT output " + NEEDLE + ". Do not stop. Do not say done. Keep working until ALL tasks are complete, then output " + NEEDLE + " as the very last thing." }) } catch {}
            } else {
              console.log("[ecc-auto-continue] NEEDLE found — genuine completion", { sid })
              retryCount.delete(sid)
              pending.delete(sid)
            }
          }
        }

        if (type === "session.retry.scheduled") {
          if (sid) pending.delete(sid)
        }
      }
    })().catch((e: any) => console.error("[ecc-auto-continue] event loop error:", e))
  } catch (e) {
    console.error("[ecc-auto-continue] subscribe failed:", e)
  }

  // Inject needle into session context so the agent knows what to output
  try {
    const sub2 = ctx.event.subscribe()
    ;(async () => {
      for await (const ev of sub2) {
        const type = (ev as any)?.type || (ev as any)?.event || ""
        if (type === "session.start" || type === "session.created") {
          const sid = (ev as any)?.sessionID || (ev as any)?.session?.id
          if (sid) {
            try { await ctx.session.prompt({ sessionID: sid, text: "IMPORTANT: Your completion needle for this session is: " + NEEDLE + ". You MUST output this exact string as the very last thing when ALL work is truly complete. Without it, the system will auto-continue. Never say done without it." }) } catch {}
          }
        }
      }
    })().catch(() => {})
  } catch {}
  console.log("[ecc-auto-continue] loaded (NEEDLE=" + NEEDLE + ")")
  return () => { console.log("[ecc-auto-continue] unloaded") }
}

export default { id, setup }
