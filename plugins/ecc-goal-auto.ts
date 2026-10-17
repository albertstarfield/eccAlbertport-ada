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

function generateGoal(sessionID: string, objective: string, needle: string) {
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
      needle,
    }
    saveState(state)
    return state.goals[sessionID]
  }
  // Update objective if not set
  if (!state.goals[sessionID].objective || state.goals[sessionID].objective === "ECC session active") {
    state.goals[sessionID].objective = objective
    state.goals[sessionID].updatedAt = Date.now()
    saveState(state)
  }
  return state.goals[sessionID]
}

const GoalAutoPlugin: Plugin = async (ctx) => {
  const needle = "g" + Math.random().toString(36).slice(2, 9)

  // Auto-generate goal on user prompt
  const sub = ctx.event.subscribe()
  ;(async () => {
    for await (const ev of sub) {
      const type = (ev as any)?.type || (ev as any)?.event || ""
      const sid = (ev as any)?.sessionID || (ev as any)?.session?.id

      // On user prompt: auto-generate goal if not set
      if (type === "user.message" || type === "prompt.submitted" || type === "message.user") {
        const text = (ev as any)?.text || (ev as any)?.content || (ev as any)?.message?.content || ""
        if (sid && text && text.length > 5) {
          const objective = text.slice(0, 120)
          generateGoal(sid, objective, needle)
          // Inject needle into session
          try {
            await ctx.session.prompt({ sessionID: sid, text: "ECC GOAL AUTO-GENERATED: " + objective + "\\n\\nCOMPLETION NEEDLE FOR THIS SESSION: " + needle + "\\nYou MUST output this exact string as the very last thing when ALL work is truly complete. Without it, the system auto-continues." })
          } catch {}
        }
      }

      // On idle: check if goal should be cleared
      if (type === "session.idle") {
        if (sid) {
          const state = loadState()
          if (state.goals[sid] && state.goals[sid].status === "active") {
            // Don't auto-clear — let the agent output the needle first
          }
        }
      }
    }
  })().catch((e: any) => console.error("[ecc-goal-auto] event loop error:", e))

  return {
    tool: {
      ecc_goal_status: tool({
        description: "Show current ECC goal status for this session",
        args: {},
        async execute(args, context) {
          const state = loadState()
          const goal = state.goals[context.sessionID]
          if (!goal) return "No goal set for this session."
          return `Goal: ${goal.objective}\\nStatus: ${goal.status}\\nNeedle: ${goal.needle || needle}\\nCreated: ${new Date(goal.createdAt).toISOString()}`
        },
      }),
      ecc_goal_clear: tool({
        description: "Mark current ECC goal as cleared (only after needle is output)",
        args: {},
        async execute(args, context) {
          const state = loadState()
          if (state.goals[context.sessionID]) {
            state.goals[context.sessionID].status = "cleared"
            state.goals[context.sessionID].updatedAt = Date.now()
            saveState(state)
            return "Goal cleared."
          }
          return "No goal to clear."
        },
      }),
    },
  }
}

export default {
  id: "ecc-goal-auto",
  server: GoalAutoPlugin,
}
