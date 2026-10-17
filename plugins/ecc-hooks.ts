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

  const GOALS_DIR = (process.cwd() || ".") + "/.ecc"
  const GOALS_STATE = GOALS_DIR + "/state.json"
  const CHECKLIST_FILE = GOALS_DIR + "/checklist.md"

  function ensureDir() {
    if (!(fs as any).existsSync(GOALS_DIR)) (fs as any).mkdirSync(GOALS_DIR, { recursive: true })
  }

  function loadState(): any {
    ensureDir()
    if ((fs as any).existsSync(GOALS_STATE)) {
      try { return JSON.parse((fs as any).readFileSync(GOALS_STATE, "utf8")) } catch {}
    }
    return { version: 1, goals: {} }
  }

  function saveState(state: any) {
    ensureDir()
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

  // Track current item index per session
  const currentIndex = new Map<string, number>()
  const checklistItems = new Map<string, string[]>()
  const checkedItems = new Map<string, string[]>()
  const lastMessage = new Map<string, string>()

  function getNextItem(sid: string): string | null {
    const items = checklistItems.get(sid) || []
    const checked = checkedItems.get(sid) || []
    for (let i = 0; i < items.length; i++) {
      if (!checked.includes(items[i])) return items[i]
    }
    return null
  }

  function markChecked(sid: string, item: string) {
    if (!checkedItems.has(sid)) checkedItems.set(sid, [])
    const checked = checkedItems.get(sid)!
    if (!checked.includes(item)) checked.push(item)
  }

  function allChecked(sid: string): boolean {
    const items = checklistItems.get(sid) || []
    const checked = checkedItems.get(sid) || []
    return items.length > 0 && items.every((item: string) => checked.includes(item))
  }

  function writeChecklistFile(sid: string) {
    const items = checklistItems.get(sid) || []
    const checked = checkedItems.get(sid) || []
    let md = "# ECC Goal Checklist\n\n"
    for (let i = 0; i < items.length; i++) {
      const done = checked.includes(items[i])
      md += (done ? "✓ " : "○ ") + (i + 1) + ". " + items[i] + "\n"
    }
    md += "\nNeedle: " + needle + "\n"
    md += "Status: " + (allChecked(sid) ? "ALL DONE — output needle" : "IN PROGRESS") + "\n"
    try { (fs as any).writeFileSync(GOALS_DIR + "/checklist.md", md) } catch {}
  }

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
            const items = promptToChecklist(text)
            if (!checklistItems.has(sid)) {
              checklistItems.set(sid, items)
              checkedItems.set(sid, [])
              currentIndex.set(sid, 0)
              writeChecklistFile(sid)
              console.log("[ecc-hooks] checklist created:", items)
              // Send first item as prompt
              const firstItem = items[0]
              try {
                await ctx.session.prompt({ sessionID: sid, text: "WORK ON THIS ITEM ONLY (item 1/" + items.length + "): " + firstItem + "\n\nDo NOT work on other items. Complete this one, then say 'ITEM_DONE: " + firstItem.slice(0, 30) + "' when finished." })
              } catch (e: any) { console.error("[ecc-hooks] prompt send failed:", e?.message) }
            }
          }
        }

        // Track last agent message for ITEM_DONE detection
        if (type === "message.updated" || type === "assistant.message" || type === "message.assistant") {
          const sid = (ev as any)?.sessionID || (ev as any)?.session?.id || (ev as any)?.properties?.sessionID
          const text = (ev as any)?.text || (ev as any)?.content || (ev as any)?.properties?.info?.content || (ev as any)?.properties?.part?.text || ""
          if (sid && text) lastMessage.set(sid, text)
        }

        // Check if agent reported ITEM_DONE
        if (type === "message.updated" || type === "assistant.message") {
          const sid = (ev as any)?.sessionID || (ev as any)?.session?.id || (ev as any)?.properties?.sessionID
          const text = (ev as any)?.text || (ev as any)?.content || (ev as any)?.properties?.info?.content || (ev as any)?.properties?.part?.text || ""
          if (sid && text && text.includes("ITEM_DONE") && checklistItems.has(sid)) {
            const currentNext = getNextItem(sid)
            if (currentNext) {
              markChecked(sid, currentNext)
              writeChecklistFile(sid)
              console.log("[ecc-hooks] item checked:", currentNext)
            }
          }
        }

        // On idle: check if current item is done, then send next
        if (type === "session.idle") {
          const sid = (ev as any)?.sessionID || (ev as any)?.session?.id
          if (sid && checklistItems.has(sid)) {
            const items = checklistItems.get(sid)!
            const checked = checkedItems.get(sid) || []
            const nextItem = getNextItem(sid)

            if (nextItem === null) {
              // All items checked — send needle prompt
              console.log("[ecc-hooks] all items checked — requesting needle")
              try {
                await ctx.session.prompt({ sessionID: sid, text: "ALL CHECKLIST ITEMS COMPLETE. Output the session needle now: " + needle })
              } catch {}
            } else {
              // Check if the last message indicates the current item is done
              // We'll just send the next unchecked item
              const idx = items.indexOf(nextItem) + 1
              console.log("[ecc-hooks] sending item " + idx + "/" + items.length + ": " + nextItem)
              try {
                await ctx.session.prompt({ sessionID: sid, text: "WORK ON THIS ITEM ONLY (item " + idx + "/" + items.length + "): " + nextItem + "\n\nDo NOT work on other items. Complete this one, then say 'ITEM_DONE' when finished." })
              } catch (e: any) { console.error("[ecc-hooks] prompt send failed:", e?.message) }
            }
          }
        }

        // Memory persistence: SessionStart
        if (typeof type === "string" && (type === "session.start" || type === "session.created" || type === "sessionStart")) {
          try {
            const out = execFileSync("/Users/albertstarfield/.nvm/versions/node/v22.23.0/bin/node", [ADAPTER_DIR + "/../targetAdaptation/ecc/scripts/hooks/session-start.js"], { cwd: ADAPTER_DIR + "/../targetAdaptation/ecc", encoding: "utf8", env: ENV, timeout: 10000 })
            console.log("[ecc-hooks] session-start:", (out || "").slice(0, 200))
          } catch (e: any) { console.error("[ecc-hooks] session-start failed:", e?.message) }
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
