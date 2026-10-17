import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"
import { createMemo, createSignal, onCleanup } from "solid-js"

function EccGoals(props: { context: Context; sessionID: string }) {
  const theme = () => props.context.theme
  const [tick, setTick] = createSignal(0)
  const timer = setInterval(() => setTick((t) => t + 1), 3000)
  onCleanup(() => clearInterval(timer))

  const goal = createMemo(() => {
    tick()
    return { status: "active", objective: "ECC session active" }
  })

  return (
    <box>
      <text>
        <span style={{ fg: theme().text.muted }}>{"═══ ECC Goals ═══"}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Status: </span>
        <span style={{ fg: theme().text.base }}>{goal().status}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Objective: </span>
        <span style={{ fg: theme().text.base }}>{goal().objective}</span>
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "ecc-goals",
  setup(context) {
    return context.ui.slot({
      append: "sidebar.footer",
      render: ({ sessionID }) => <EccGoals context={context} sessionID={sessionID} />,
    })
  },
})
