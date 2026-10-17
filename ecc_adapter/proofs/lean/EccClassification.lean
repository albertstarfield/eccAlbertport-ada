--  EccClassification.lean
--  Formal proof (Lean 4) of safety properties of the ECC adapter classification logic.
--  Mirrors the Ada/SPARK functions in src/ecc_*.ads/.adb.

--  Tool_Id enumeration (mirrors Ecc_Types.Tool_Id)
inductive ToolId where
  | Read | Write | Edit | Bash | Grep | Glob | Webfetch | Websearch
  | Task_Tool | Todowrite | Changed_Files | Unknown
  deriving DecidableEq, Repr

def toTool (name : String) : ToolId :=
  if name == "Read" then .Read
  else if name == "Write" then .Write
  else if name == "Edit" then .Edit
  else if name == "Bash" then .Bash
  else if name == "Grep" then .Grep
  else if name == "Glob" then .Glob
  else if name == "WebFetch" then .Webfetch
  else if name == "WebSearch" then .Websearch
  else if name == "Task" then .Task_Tool
  else if name == "TodoWrite" then .Todowrite
  else if name == "changed-files" then .Changed_Files
  else .Unknown

--  Specific mapping proofs
theorem toTool_Read : toTool "Read" = .Read := by simp [toTool]
theorem toTool_Unknown : toTool "foobar" = .Unknown := by simp [toTool]
theorem toTool_not_unknown_for_Read : toTool "Read" ≠ .Unknown := by simp [toTool]

--  Effect classes
inductive EffectClass where
  | SE0 | SE1 | SE2 | SE3 | SE4
  deriving DecidableEq, Repr

inductive GateDecision where
  | Proceed | Journal | NeedsConfirmation | Deny
  deriving DecidableEq, Repr

def gate (c : EffectClass) : GateDecision :=
  match c with
  | .SE0 | .SE1 | .SE2 => .Proceed
  | .SE3 => .Journal
  | .SE4 => .NeedsConfirmation

--  Safety: SE4 never proceeds automatically.
theorem se4_not_proceed : gate .SE4 ≠ .Proceed := by
  simp [gate]

--  SE0 always proceeds.
theorem se0_proceeds : gate .SE0 = .Proceed := by
  simp [gate]

--  Agent mode
inductive AgentMode where
  | Primary | Subagent
  deriving DecidableEq, Repr

def inferMode (name : String) : AgentMode :=
  if name == "orchestrator" then .Primary else .Subagent

theorem only_orchestrator_primary (name : String) :
    inferMode name = .Primary ↔ name = "orchestrator" := by
  unfold inferMode
  by_cases heq : name = "orchestrator"
  · simp [heq]
  · simp [heq]

--  Command category
inductive CommandCategory where
  | Build | Review | Test | Plan | Fix | Docs | Other
  deriving DecidableEq, Repr

def classifyCommand (name : String) : CommandCategory :=
  if name.endsWith "-build" || name == "build" then .Build
  else if name.endsWith "-review" || name == "review" then .Review
  else if name.endsWith "-test" || name == "test" then .Test
  else if name.endsWith "-plan" || name == "plan" then .Plan
  else if name.endsWith "-fix" || name == "fix" then .Fix
  else if name.endsWith "-docs" || name == "docs" then .Docs
  else .Other

theorem classifyCommand_total (name : String) :
    ∃ c : CommandCategory, classifyCommand name = c := by
  exists classifyCommand name

#check toTool_Read
#check se4_not_proceed
#check only_orchestrator_primary
#check classifyCommand_total
