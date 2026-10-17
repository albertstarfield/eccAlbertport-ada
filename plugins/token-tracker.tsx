import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"
import { createMemo, createSignal, onCleanup } from "solid-js"

/**
 * Token Tracker (V2 port)
 *
 * Displays live token usage, request count, and cost in the sidebar footer.
 *
 * Layout:
 *   ⏳ last:  in: 70k · out: 1.2k · 1 req · $0.04
 *   📊 total: in: 1.2m · out: 0.3m · 42 reqs · $1.23
 *
 * Migrated from the V1 TUI API (@opencode-ai/plugin/tui, api.slots.register)
 * to the V2 CLI plugin API (@opencode/plugin/tui, context.ui.slot).
 */

interface AssistantMsg {
  type: string
  tokens?: { input?: number; output?: number }
  cost?: number
}

interface TokenStats {
  totalInp: number
  totalOut: number
  totalCost: number
  reqCount: number
  lastInp: number
  lastOut: number
  lastCost: number
  isBusy: boolean
}

function TokenFooter(props: { context: Context; sessionID: string }) {
  const theme = () => props.context.theme

  const [tick, setTick] = createSignal(0)

  // V2 keeps message data in a client-side cache; refresh it alongside the tick
  // so the footer shows current numbers (same 2s cadence as the V1 plugin).
  const sync = () => {
    void props.context.data.session.message.sync(props.sessionID).catch(() => {})
    void props.context.data.session.sync(props.sessionID).catch(() => {})
  }
  sync()
  const timer = setInterval(() => {
    setTick((t) => t + 1)
    sync()
  }, 2000)
  onCleanup(() => clearInterval(timer))

  const tokenData = createMemo<TokenStats>(() => {
    tick()

    const context = props.context
    const status = context.data.session.status(props.sessionID)
    const isBusy = status === "running"

    const msgs = context.data.session.message.list(props.sessionID) as unknown as AssistantMsg[]
    const assistantMsgs = msgs.filter((m) => m.type === "assistant" && !!m.tokens)

    // Totals across entire session
    const totalInp = assistantMsgs.reduce((sum, m) => sum + (m.tokens?.input || 0), 0)
    const totalOut = assistantMsgs.reduce((sum, m) => sum + (m.tokens?.output || 0), 0)
    const totalCost = assistantMsgs.reduce((sum, m) => sum + (m.cost || 0), 0)
    const reqCount = assistantMsgs.filter((m) => (m.tokens?.input || 0) > 0).length

    // Last request only (last assistant message with input tokens)
    const lastMsg = [...assistantMsgs].reverse().find((m) => (m.tokens?.input || 0) > 0)
    const lastInp = lastMsg?.tokens?.input || 0
    const lastOut = lastMsg?.tokens?.output || 0
    const lastCost = lastMsg?.cost || 0

    return { totalInp, totalOut, totalCost, reqCount, lastInp, lastOut, lastCost, isBusy }
  })

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return `${n}`
  }

  const fmtCost = (n: number) => {
    if (n >= 1) return `$${n.toFixed(2)}`
    if (n >= 0.01) return `$${n.toFixed(3)}`
    return `$${n.toFixed(4)}`
  }

  return (
    <box>
      <text>
        <span style={{ fg: theme().text.muted }}>
          {tokenData().isBusy ? "⏳ " : "✓  "}
        </span>
        <span style={{ fg: theme().text.muted }}>last:  in: </span>
        <span style={{ fg: theme().text.base }}>{fmt(tokenData().lastInp)}</span>
        <span style={{ fg: theme().text.muted }}> · out: </span>
        <span style={{ fg: theme().text.base }}>{fmt(tokenData().lastOut)}</span>
        <span style={{ fg: theme().text.muted }}> · </span>
        <span style={{ fg: theme().text.base }}>1 req</span>
        {tokenData().lastCost > 0 ? (
          <>
            <span style={{ fg: theme().text.muted }}> · </span>
            <span style={{ fg: theme().text.base }}>{fmtCost(tokenData().lastCost)}</span>
          </>
        ) : null}
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>📊 total: in: </span>
        <span style={{ fg: theme().text.base }}>{fmt(tokenData().totalInp)}</span>
        <span style={{ fg: theme().text.muted }}> · out: </span>
        <span style={{ fg: theme().text.base }}>{fmt(tokenData().totalOut)}</span>
        <span style={{ fg: theme().text.muted }}> · </span>
        <span style={{ fg: theme().text.base }}>{tokenData().reqCount} reqs</span>
        {tokenData().totalCost > 0 ? (
          <>
            <span style={{ fg: theme().text.muted }}> · </span>
            <span style={{ fg: theme().text.base }}>{fmtCost(tokenData().totalCost)}</span>
          </>
        ) : null}
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "token-tracker",
  setup(context) {
    return context.ui.slot({
      append: "sidebar.footer",
      render: ({ sessionID }) => <TokenFooter context={context} sessionID={sessionID} />,
    })
  },
})
