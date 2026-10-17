import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"
import { createSignal, onCleanup } from "solid-js"

const ADAPTER_DIR = "/Users/albertstarfield/.config/opencode/ecc_adapter"
const GOALS_DIR = (typeof process !== "undefined" ? process.env.HOME || "" : "") + "/.config/opencode/goals"
const GOALS_STATE = GOALS_DIR + "/state.json"

function ensureGoalsDir() {
  try {
    const fs = require("fs")
    if (!fs.existsSync(GOALS_DIR)) fs.mkdirSync(GOALS_DIR, { recursive: true })
  } catch {}
}

function loadState(): any {
  ensureGoalsDir()
  try {
    const fs = require("fs")
    if (fs.existsSync(GOALS_STATE)) {
      return JSON.parse(fs.readFileSync(GOALS_STATE, "utf8"))
    }
  } catch {}
  return { version: 1, goals: {} }
}

function saveState(state: any) {
  ensureGoalsDir()
  try {
    const fs = require("fs")
    fs.writeFileSync(GOALS_STATE, JSON.stringify(state, null, 2))
  } catch {}
}

function generateNeedle(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

// Break a prompt into checklist items
// Get next unchecked item (for-loop style)
function getNextUnchecked(state: any, sid: string): string | null {
  const goal = state.goals[sid]
  if (!goal || !goal.checklist) return null
  const checked = goal.checkedItems || []
  for (let i = 0; i < goal.checklist.length; i++) {
    if (!checked.includes(goal.checklist[i])) {
      return goal.checklist[i]
    }
  }
  return null
}

function markChecked(sid: string, item: string) {
  const state = loadState()
  if (state.goals[sid]) {
    if (!state.goals[sid].checkedItems) state.goals[sid].checkedItems = []
    if (!state.goals[sid].checkedItems.includes(item)) {
      state.goals[sid].checkedItems.push(item)
    }
    state.goals[sid].updatedAt = Date.now()
    saveState(state)
  }
}

function promptToChecklist(prompt: string): string[] {
  // Split by common task separators
  const items: string[] = []
  // Split by newlines, numbered lists, bullet points, "and", "then"
  const lines = prompt.split(/\n|;|\.\s+/).map(s => s.trim()).filter(s => s.length > 5)
  for (const line of lines) {
    // Remove numbering/bullets
    const cleaned = line.replace(/^[\d\.\-\*\)]+\s*/, "").trim()
    if (cleaned.length > 5) items.push(cleaned)
  }
  if (items.length === 0) items.push(prompt.slice(0, 120))
  if (items.length === 1 && prompt.length > 120) {
    // Try splitting by "and" or "then"
    const parts = prompt.split(/\s+and\s+|\s+then\s+|\s*,\s*/).map(s => s.trim()).filter(s => s.length > 5)
    if (parts.length > 1) return parts
  }
  return items
}

export default Plugin.define({
  id: "ecc-hooks",
  setup(context) {
    const needle = generateNeedle()

    // Auto-generate goal checklist from user prompt
    try {
      const sub = context.event.subscribe()
      ;(async () => {
        for await (const ev of sub) {
          const type = (ev as any)?.type || (ev as any)?.event || ""
          const sid = (ev as any)?.sessionID || (ev as any)?.session?.id || (ev as any)?.properties?.sessionID

          if (type === "message.updated" || type === "user.message" || type === "prompt.submitted") {
            const text = (ev as any)?.text || (ev as any)?.content || (ev as any)?.properties?.info?.content || (ev as any)?.properties?.part?.text || ""
            if (sid && text && text.length > 5) {
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
                // Update checklist if new items
                const existing = state.goals[sid].checklist || []
                const newItems = checklist.filter((c: string) => !existing.includes(c))
                if (newItems.length > 0) {
                  state.goals[sid].checklist = [...existing, ...newItems]
                  state.goals[sid].updatedAt = Date.now()
                }
              }
              saveState(state)
              // Write checklist.md for agent to read
              try {
                const fs3 = require("fs")
                const checklist = state.goals[sid].checklist || []
                const checked = state.goals[sid].checkedItems || []
                let md = "# ECC Goal Checklist\n\n"
                for (let i = 0; i < checklist.length; i++) {
                  const done = checked.includes(checklist[i])
                  md += (done ? "✓ " : "○ ") + (i + 1) + ". " + checklist[i] + "\n"
                }
                md += "\nNeedle: " + needle + "\n"
                fs3.writeFileSync((process.env.HOME || "") + "/.config/opencode/goals/checklist.md", md)
              } catch (e: any) { console.error("[ecc-hooks] checklist write failed:", e?.message) }
              console.log("[ecc-hooks] goal checklist:", state.goals[sid].checklist)
            }
          }
        }
      })().catch((e: any) => console.error("[ecc-hooks] event loop error:", e))
    } catch (e) {
      console.error("[ecc-hooks] subscribe failed:", e)
    }

    return context.ui.slot({
      append: "sidebar.footer",
      render: ({ sessionID }) => {
        const state = loadState()
        const goal = state.goals?.[sessionID]
        if (!goal || !goal.checklist) return null as any
        const checked = goal.checkedItems || []
        const total = goal.checklist.length
        const done = checked.length
        // Show progress
        const lines = goal.checklist.map((item: string, i: number) => {
          const isDone = checked.includes(item)
          return (isDone ? "✓ " : "○ ") + (i + 1) + ". " + item.slice(0, 40)
        })
        return null as any
      },
    })
  },
})
