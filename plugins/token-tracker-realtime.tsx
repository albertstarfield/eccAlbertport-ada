import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"

/**
 * Token Tracker Realtime (V2 port)
 *
 * While a session is executing, shows a short-lived toast every 2 seconds with
 * cumulative token usage, request count, and cost. A final toast fires when
 * the execution finishes.
 *
 * Migrated from the V1 server plugin API (event hook + client.tui.showToast)
 * to the V2 CLI plugin API (context.data.on + context.ui.toast.show). V2 has
 * no session.status event; execution lifecycle events replace it.
 */

interface AssistantMsg {
  id: string
  type: string
  tokens?: {
    input?: number
    output?: number
    reasoning?: number
    cache?: { read?: number; write?: number }
  }
  cost?: number
}

interface RealtimeStats {
  totalTokens: number
  totalCost: number
  reqCount: number
}

export default Plugin.define({
  id: "token-tracker-realtime",
  setup(context: Context) {
    let timer: ReturnType<typeof setInterval> | null = null
    let currentSessionID: string | null = null

    // Format numbers: 1200 -> "1.2k"
    const fmt = (n: number) => {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
      if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
      return `${n}`
    }

    // Format cost: 0.0032 -> "$0.0032"
    const fmtCost = (n: number) => {
      if (n >= 1) return `$${n.toFixed(2)}`
      if (n >= 0.01) return `$${n.toFixed(3)}`
      return `$${n.toFixed(4)}`
    }

    // Collect token data from all messages
    async function collectTokenData(sessionID: string): Promise<RealtimeStats | null> {
      try {
        await context.data.session.message.sync(sessionID)
        const messages = context.data.session.message.list(sessionID) as unknown as AssistantMsg[]

        if (!Array.isArray(messages)) return null

        const assistantMsgs = messages.filter((m) => {
          if (m.type !== "assistant" || !m.tokens) return false
          const t = m.tokens
          return (
            (Number(t?.input) || 0) +
              (Number(t?.output) || 0) +
              (Number(t?.reasoning) || 0) +
              (Number(t?.cache?.read) || 0) +
              (Number(t?.cache?.write) || 0) >
            0
          )
        })

        const totalInp = assistantMsgs.reduce((sum, m) => sum + (Number(m.tokens?.input) || 0), 0)
        const totalOut = assistantMsgs.reduce((sum, m) => sum + (Number(m.tokens?.output) || 0), 0)
        const totalReasoning = assistantMsgs.reduce((sum, m) => sum + (Number(m.tokens?.reasoning) || 0), 0)
        const totalCacheRead = assistantMsgs.reduce((sum, m) => sum + (Number(m.tokens?.cache?.read) || 0), 0)
        const totalCacheWrite = assistantMsgs.reduce((sum, m) => sum + (Number(m.tokens?.cache?.write) || 0), 0)
        const totalCost = assistantMsgs.reduce((sum, m) => sum + (Number(m.cost) || 0), 0)
        const reqCount = assistantMsgs.filter((m) => (Number(m.tokens?.input) || 0) > 0).length

        const totalTokens = totalInp + totalOut + totalReasoning + totalCacheRead + totalCacheWrite

        return { totalTokens, totalCost, reqCount }
      } catch (error) {
        console.error("[token-tracker-realtime] failed to collect token data:", error)
        return null
      }
    }

    // Show/update toast with current token data
    async function updateToast(sessionID: string) {
      const data = await collectTokenData(sessionID)
      if (!data) return

      const message = `⏳ ${fmt(data.totalTokens)} tokens · ${data.reqCount} reqs${
        data.totalCost > 0 ? " · " + fmtCost(data.totalCost) : ""
      }`

      try {
        // Short duration (1s) for real-time updates
        context.ui.toast.show({ message, variant: "info", duration: 1000, sessionID })
      } catch (error) {
        console.error("[token-tracker-realtime] failed to show toast:", error)
      }
    }

    // Start tracking a session
    function startTracking(sessionID: string) {
      if (timer) {
        clearInterval(timer)
      }

      currentSessionID = sessionID

      // Update immediately and then every 2 seconds
      void updateToast(sessionID)
      timer = setInterval(() => {
        if (currentSessionID) {
          void updateToast(currentSessionID)
        }
      }, 2000)
    }

    // Stop tracking
    function stopTracking() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      currentSessionID = null
    }

    const finish = (sessionID: string) => {
      if (currentSessionID !== sessionID) return
      stopTracking()
      // Final update
      void updateToast(sessionID)
    }

    const offs = [
      context.data.on("session.execution.started", (event) => {
        startTracking(event.data.sessionID)
      }),
      context.data.on("session.execution.succeeded", (event) => finish(event.data.sessionID)),
      context.data.on("session.execution.failed", (event) => finish(event.data.sessionID)),
      context.data.on("session.execution.interrupted", (event) => {
        if (currentSessionID === event.data.sessionID) stopTracking()
      }),
    ]

    return () => {
      stopTracking()
      for (const off of offs) off()
    }
  },
})
