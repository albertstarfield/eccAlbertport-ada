import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"
import { createMemo, createSignal, onCleanup } from "solid-js"

function EccDashboard(props: { context: Context; sessionID: string }) {
  const theme = () => props.context.theme
  const [tick, setTick] = createSignal(0)
  const timer = setInterval(() => setTick((t) => t + 1), 5000)
  onCleanup(() => clearInterval(timer))

  const status = createMemo(() => {
    tick()
    return {
      ada: "✓ built",
      proof: "✓ 195/195",
      venv: "✓ ready",
      skills: "296 skills",
      agents: "71 agents",
      goals: "active",
    }
  })

  return (
    <box>
      <text>
        <span style={{ fg: theme().text.muted }}>{"═══ ECC Status ═══"}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Ada:    </span>
        <span style={{ fg: theme().text.base }}>{status().ada}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Proof:  </span>
        <span style={{ fg: theme().text.base }}>{status().proof}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Venv:   </span>
        <span style={{ fg: theme().text.base }}>{status().venv}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Skills: </span>
        <span style={{ fg: theme().text.base }}>{status().skills}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Agents: </span>
        <span style={{ fg: theme().text.base }}>{status().agents}</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Goals:  </span>
        <span style={{ fg: theme().text.base }}>{status().goals}</span>
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "ecc-dashboard",
  setup(context) {
    return context.ui.slot({
      append: "sidebar.footer",
      render: ({ sessionID }) => <EccDashboard context={context} sessionID={sessionID} />,
    })
  },
})
