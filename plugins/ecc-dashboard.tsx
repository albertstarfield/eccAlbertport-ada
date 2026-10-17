import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"

function EccDashboard(props: { context: Context; sessionID: string }) {
  const theme = () => props.context.theme
  return (
    <box>
      <text>
        <span style={{ fg: theme().text.base }}>ECC DASHBOARD ACTIVE</span>
      </text>
      <text>
        <span style={{ fg: theme().text.muted }}>Ada: built | Proof: 195/195 | Skills: 296</span>
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "ecc-dashboard",
  setup(context) {
    console.log("[ecc-dashboard] LOADED")
    return context.ui.slot({
      append: "sidebar.footer",
      render: ({ sessionID }) => <EccDashboard context={context} sessionID={sessionID} />,
    })
  },
})
