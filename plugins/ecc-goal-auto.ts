import { tool, type Plugin } from "@opencode-ai/plugin"
import * as fs from "fs"

const GOALS_DIR = (process.env.HOME || "") + "/.config/opencode/goals"
const GOALS_STATE = GOALS_DIR + "/state.json"

function ensureGoalsDir() {
  if (!fs.existsSync(GOALS_DIR)) fs.mkdirSync(GOALS_DIR, { recursive: true })
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

function key(sessionID: string) { return sessionID }

function generateNeedle(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

const GoalAutoPlugin: Plugin = async (ctx) => {
  const client = ctx.client
  const needle = generateNeedle()

  async function getGoal(sessionID: string) {
    const state = loadState()
    return state.goals[key(sessionID)]
  }

  async function updateState(fn: (state: any) => any) {
    const state = loadState()
    const result = fn(state)
    saveState(state)
    return result
  }

  return {
    tool: {
      ecc_goal_status: tool({
        description: "Show current ECC goal status for this session",
        args: {},
        async execute(args, context) {
          const goal = await getGoal(context.sessionID)
          if (!goal) return "No goal set for this session."
          return `Goal: ${goal.objective}\nStatus: ${goal.status}\nNeedle: ${goal.needle || needle}\nCreated: ${new Date(goal.createdAt).toISOString()}`
        },
      }),
      ecc_goal_clear: tool({
        description: "Mark current ECC goal as cleared (only after needle is output)",
        args: {},
        async execute(args, context) {
          const updated = await updateState((state) => {
            const goal = state.goals[key(context.sessionID)]
            if (!goal) return undefined
            goal.status = "cleared"
            goal.updatedAt = Date.now()
            return { ...goal }
          })
          if (!updated) return "No goal to clear."
          return "Goal cleared."
        },
      }),
    },

    async "experimental.chat.system.transform"(input, output) {
      if (!input.sessionID) return
      const state = loadState()
      const goal = state.goals[key(input.sessionID)]
      if (!goal || goal.status !== "active") {
        // Auto-generate goal if not exists
        const newGoal = {
          id: "goal-" + Date.now(),
          sessionID: input.sessionID,
          objective: "ECC session active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tokensUsed: 0,
          timeUsedMs: 0,
          accountedAssistantTokens: {},
          needle,
        }
        state.goals[key(input.sessionID)] = newGoal
        saveState(state)
        output.system.push(`Active ECC goal: ${newGoal.objective}\n\nCOMPLETION NEEDLE FOR THIS SESSION: ${needle}\nYou MUST output this exact string as the very last thing when ALL work is truly complete. Without it, the system auto-continues.\n\nGoal-mode instructions:\n- Treat the active goal as the main objective.\n- Continue through clear next actions.\n- Never say done without ${needle}.`)
      } else {
        output.system.push(`Active ECC goal: ${goal.objective}\n\nCOMPLETION NEEDLE FOR THIS SESSION: ${goal.needle || needle}\nYou MUST output this exact string as the very last thing when ALL work is truly complete. Without it, the system auto-continues.\n\nGoal-mode instructions:\n- Treat the active goal as the main objective.\n- Continue through clear next actions.\n- Never say done without ${goal.needle || needle}.`)
      }
    },

    async "experimental.session.compacting"(input, output) {
      const state = loadState()
      const goal = state.goals[key(input.sessionID)]
      if (!goal || goal.status !== "active") return
      output.context.push(`Active ECC goal to preserve: ${goal.objective}\nNeedle: ${goal.needle || needle}`)
    },

    async event({ event }) {
      const anyEvent = event as any
      const type = anyEvent.type
      const properties = anyEvent.properties ?? anyEvent
      const sessionID = properties.sessionID ?? properties.info?.sessionID ?? properties.part?.sessionID

      // On user message: auto-generate goal from prompt text
      if (type === "message.updated" && sessionID && properties.info?.role === "user") {
        const text = properties.info?.content || properties.part?.text || ""
        if (text && text.length > 5) {
          const state = loadState()
          const goal = state.goals[key(sessionID)]
          if (!goal || goal.objective === "ECC session active") {
            const objective = text.slice(0, 120)
            if (goal) {
              goal.objective = objective
              goal.updatedAt = Date.now()
            } else {
              state.goals[key(sessionID)] = {
                id: "goal-" + Date.now(),
                sessionID,
                objective,
                status: "active",
                createdAt: Date.now(),
                updatedAt: Date.now(),
                tokensUsed: 0,
                timeUsedMs: 0,
                accountedAssistantTokens: {},
                needle,
              }
            }
            saveState(state)
          }
        }
      }
    },
  }
}

export default {
  id: "ecc-goal-auto",
  server: GoalAutoPlugin,
}
