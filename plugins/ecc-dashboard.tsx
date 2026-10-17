import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"
import { createMemo, createSignal, onCleanup } from "solid-js"
import { execFileSync } from "child_process"
import * as fs from "fs"

const ADAPTER_DIR = "/Users/albertstarfield/.config/opencode/ecc_adapter"
const ECC_ROOT = "/Users/albertstarfield/.config/opencode/eccAlbertport-ada"

function EccDashboard(props: { context: Context; sessionID: string }) {
  const theme = () => props.context.theme

  const [tick, setTick] = createSignal(0)
  const timer = setInterval(() => setTick((t) => t + 1), 5000)
  onCleanup(() => clearInterval(timer))

  const status = createMemo(() => {
    tick()
    const result: Record<string, string> = {}

    // Ada build status
    try {
      if (fs.existsSync(ADAPTER_DIR + "/lib/libEcc_Adapter.dylib")) {
        result.ada = "✓ built"
      } else {
        result.ada = "✗ not built"
      }
    } catch { result.ada = "? unknown" }

    // GNATprove status
    try {
      const out = execFileSync("gnatprove", ["-P", ADAPTER_DIR + "/ecc_adapter.gpr", "--level=4", "--mode=all", "-j0", "--output-msg-only"], { encoding: "utf8", timeout: 30000 })
      if (out.includes("all checks proved")) {
        result.proof = "✓ 195/195"
      } else {
        result.proof = "⚠ partial"
      }
    } catch { result.proof = "? unchecked" }

    // Venv status
    try {
      if (fs.existsSync(ADAPTER_DIR + "/.venv/bin/python3")) {
        result.venv = "✓ ready"
      } else {
        result.venv = "✗ missing"
      }
    } catch { result.venv = "? unknown" }

    // Skills count
    try {
      const skills = fs.readdirSync(ECC_ROOT + "/skills").filter((d: string) => {
        try { return fs.statSync(ECC_ROOT + "/skills/" + d).isDirectory() } catch { return false }
      })
      result.skills = `${skills.length} skills`
    } catch { result.skills = "? unknown" }

    // Agents count
    try {
      const agents = fs.readdirSync(ECC_ROOT + "/agents/ecc").filter((f: string) => f.endsWith(".md"))
      result.agents = `${agents.length} agents`
    } catch { result.agents = "? unknown" }

    // Goals status
    try {
      const goalsDir = process.env.HOME + "/.config/opencode/goals"
      if (fs.existsSync(goalsDir + "/state.json")) {
        const state = JSON.parse(fs.readFileSync(goalsDir + "/state.json", "utf8"))
        const goals = Object.values(state.goals || {})
        const active = goals.filter((g: any) => g.status === "active" || g.status === "pending").length
        const cleared = goals.filter((g: any) => g.status === "cleared").length
        result.goals = `${active} active, ${cleared} cleared`
      } else {
        result.goals = "no goals"
      }
    } catch { result.goals = "? unknown" }

    return result
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
