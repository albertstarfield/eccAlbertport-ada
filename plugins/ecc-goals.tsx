import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"
import { createMemo, createSignal, onCleanup } from "solid-js"
import * as fs from "fs"
import { execFileSync } from "child_process"

const GOALS_DIR = (process.env.HOME || "") + "/.config/opencode/goals"
const GOALS_STATE = GOALS_DIR + "/state.json"
const ADAPTER_DIR = "/Users/albertstarfield/.config/opencode/ecc_adapter"

function ensureGoalsDir() {
  if (!fs.existsSync(GOALS_DIR)) {
    fs.mkdirSync(GOALS_DIR, { recursive: true })
  }
}

function loadState(): any {
  ensureGoalsDir()
  if (fs.existsSync(GOALS_STATE)) {
    try { return JSON.parse(fs.readFileSync(GOALS_STATE, "utf8")) } catch {}
  }
  return { version: 1, goals: {} }
}

function saveState(state: any) {
  ensureGoalsDir()
  fs.writeFileSync(GOALS_STATE, JSON.stringify(state, null, 2))
}

function generateGoal(sessionID: string, objective: string) {
  const state = loadState()
  if (!state.goals[sessionID]) {
    state.goals[sessionID] = {
      id: "goal-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      sessionID,
      objective,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tokensUsed: 0,
      timeUsedMs: 0,
      accountedAssistantTokens: {},
    }
    saveState(state)
  }
  return state.goals[sessionID]
}

function updateGoalStatus(sessionID: string, status: string) {
  const state = loadState()
  if (state.goals[sessionID]) {
    state.goals[sessionID].status = status
    state.goals[sessionID].updatedAt = Date.now()
    saveState(state)
  }
}

function EccGoals(props: { context: Context; sessionID: string }) {
  const theme = () => props.context.theme
  const [tick, setTick] = createSignal(0)
  const timer = setInterval(() => setTick((t) => t + 1), 3000)
  onCleanup(() => clearInterval(timer))

  // Auto-generate goal on first render
  const goal = createMemo(() => {
    tick()
    try {
      const state = loadState()
      if (!state.goals[props.sessionID]) {
        generateGoal(props.sessionID, "ECC session active")
      }
      return state.goals[props.sessionID] || null
    } catch { return null }
  })

  return (
    <box>
      <text>
        <span style={{ fg: theme().text.muted }}>{"═══ ECC Goals ═══"}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Status: </span>
        <span style={{ fg: theme().text.base }}>{goal()?.status || "no goal"}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Objective: </span>
        <span style={{ fg: theme().text.base }}>{goal()?.objective || "—"}</span>
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "ecc-goals",
  setup(context) {
    // Auto-generate goal on session start
    try {
      const sub = context.event.subscribe()
      ;(async () => {
        for await (const ev of sub) {
          const type = (ev as any)?.type || (ev as any)?.event || ""
          if (type === "session.start" || type === "session.created") {
            const sid = (ev as any)?.sessionID || (ev as any)?.session?.id
            if (sid) generateGoal(sid, "ECC session active")
          }
          if (type === "session.idle") {
            const sid = (ev as any)?.sessionID || (ev as any)?.session?.id
            if (sid) updateGoalStatus(sid, "cleared")
          }
        }
      })().catch(() => {})
    } catch {}
    return context.ui.slot({
      append: "sidebar.footer",
      render: ({ sessionID }) => <EccGoals context={context} sessionID={sessionID} />,
    })
  },
})
