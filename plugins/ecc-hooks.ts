const setup = async (ctx: any): Promise<() => void> => {
  const { execFileSync } = await import("child_process")
  const fs = await import("fs")
  const ADAPTER_DIR = "/Users/albertstarfield/.config/opencode/ecc_adapter"
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

  const LIB_PATH = `${ADAPTER_DIR}/lib/libEcc_Adapter.dylib`
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

  const GOALS_DIR = (process.env.HOME || "") + "/.config/opencode/goals"
  const GOALS_STATE = GOALS_DIR + "/state.json"

  function ensureGoalsDir() {
    if (!(fs as any).existsSync(GOALS_DIR)) (fs as any).mkdirSync(GOALS_DIR, { recursive: true })
  }

  function loadState(): any {
    ensureGoalsDir()
    if ((fs as any).existsSync(GOALS_STATE)) {
      try { return JSON.parse((fs as any).readFileSync(GOALS_STATE, "utf8")) } catch {}
    }
    return { version: 1, goals: {} }
  }

  function saveState(state: any) {
    ensureGoalsDir()
    try { (fs as any).writeFileSync(GOALS_STATE, JSON.stringify(state, null, 2)) } catch {}
  }

  function generateNeedle(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)]
    return result
  }

  function promptToChecklist(prompt: string): string[] {
    const items: string[] = []
    const lines = prompt.split(/\n|;|\.\s+/).map((s: string) => s.trim()).filter((s: string) => s.length > 5)
    for (const line of lines) {
      const cleaned = line.replace(/^[\d\.\-\*\)]+\s*/, "").trim()
      if (cleaned.length > 5) items.push(cleaned)
    }
    if (items.length === 0) items.push(prompt.slice(0, 120))
    if (items.length === 1 && prompt.length > 120) {
      const parts = prompt.split(/\s+and\s+|\s+then\s+|\s*,\s*/).map((s: string) => s.trim()).filter((s: string) => s.length > 5)
      if (parts.length > 1) return parts
    }
    return items
  }

  const needle = generateNeedle()

  // Event loop
  try {
    const sub = ctx.event.subscribe()
    ;(async () => {
      for await (const ev of sub) {
        const type = (ev as any)?.type || (ev as any)?.event || ""

        // Auto-generate goal checklist from user prompt
        if (type === "message.updated" || type === "user.message" || type === "prompt.submitted") {
          const sid = (ev as any)?.sessionID || (ev as any)?.session?.id || (ev as any)?.properties?.sessionID
          const text = (ev as any)?.text || (ev as any)?.content || (ev as any)?.properties?.info?.content || (ev as any)?.properties?.part?.text || ""
          if (sid && text && text.length > 5) {
            try {
              const state = loadState()
              const objective = text.slice(0, 120)
              const checklist = promptToChecklist(text)
              if (!state.goals[sid] || state.goals[sid].objective === "ECC session active") {
                state.goals[sid] = {
                  id: "goal-" + Date.now(),
                  sessionID: sid,
                  objective,
                  status: "active",
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  tokensUsed: 0,
                  timeUsedMs: 0,
                  accountedAssistantTokens: {},
                  needle,
                  checklist,
                  checkedItems: [],
                }
              } else {
                const existing = state.goals[sid].checklist || []
                const newItems = checklist.filter((c: string) => !existing.includes(c))
                if (newItems.length > 0) {
                  state.goals[sid].checklist = [...existing, ...newItems]
                  state.goals[sid].updatedAt = Date.now()
                }
              }
              saveState(state)
              // Write checklist.md
              try {
                const cl = state.goals[sid].checklist || []
                const checked = state.goals[sid].checkedItems || []
                let md = "# ECC Goal Checklist\n\n"
                for (let i = 0; i < cl.length; i++) {
                  const done = checked.includes(cl[i])
                  md += (done ? "✓ " : "○ ") + (i + 1) + ". " + cl[i] + "\n"
                }
                md += "\nNeedle: " + needle + "\n"
                ;(fs as any).writeFileSync((process.env.HOME || "") + "/.config/opencode/goals/checklist.md", md)
              } catch {}
              console.log("[ecc-hooks] goal checklist:", state.goals[sid].checklist)
            } catch (e: any) { console.error("[ecc-hooks] goal gen failed:", e?.message) }
          }
        }

        // Memory persistence: SessionStart
        if (typeof type === "string" && (type === "session.start" || type === "session.created" || type === "sessionStart")) {
          try {
            const out = execFileSync("/Users/albertstarfield/.nvm/versions/node/v22.23.0/bin/node", [ADAPTER_DIR + "/../targetAdaptation/ecc/scripts/hooks/session-start.js"], { cwd: ADAPTER_DIR + "/../targetAdaptation/ecc", encoding: "utf8", env: ENV, timeout: 10000 })
            console.log("[ecc-hooks] session-start:", (out || "").slice(0, 200))
          } catch (e: any) { console.error("[ecc-hooks] session-start failed:", e?.message) }
        }

        // Memory persistence: SessionEnd
        if (typeof type === "string" && (type === "session.end" || type === "session.ended" || type === "sessionEnd")) {
          try {
            const out = execFileSync("/Users/albertstarfield/.nvm/versions/node/v22.23.0/bin/node", [ADAPTER_DIR + "/../targetAdaptation/ecc/scripts/hooks/session-end.js"], { cwd: ADAPTER_DIR + "/../targetAdaptation/ecc", encoding: "utf8", env: ENV, timeout: 10000 })
            console.log("[ecc-hooks] session-end:", (out || "").slice(0, 200))
          } catch (e: any) { console.error("[ecc-hooks] session-end failed:", e?.message) }
        }

        // Tool events
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

  console.log("[ecc-hooks] loaded (NEEDLE=" + needle + ")")
  return () => { console.log("[ecc-hooks] unloaded") }
}

export default { id: "local/eccAlbertPort-adaSpark-Hybrid-FuckYouJSStatusquo-arch-hooks", setup }
