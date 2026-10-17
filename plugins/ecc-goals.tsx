import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"

function EccGoals(props: { context: Context; sessionID: string }) {
  const theme = () => props.context.theme
  return (
    <box>
      <text>
        <span style={{ fg: theme().text.base }}>ECC GOALS ACTIVE</span>
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "ecc-goals",
  setup(context) {
    console.log("[ecc-goals] LOADED")
    return context.ui.slot({
      append: "sidebar.footer",
      render: ({ sessionID }) => <EccGoals context={context} sessionID={sessionID} />,
    })
  },
})
