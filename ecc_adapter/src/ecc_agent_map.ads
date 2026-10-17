--  Ecc_Agent_Map — maps ECC agent declarations onto OpenCode agent fields.
--
--  AXIOMS:
--    * ECC agent frontmatter lists tools as comma-separated capitalised tokens
--      ("Read, Grep, Glob, Bash").  [ECC agents/*.md]
--    * OpenCode agent tools are a JSON object keyed by lower-case tool name,
--      and anything absent is disabled.  [OpenCode config]
--  THEORY:
--    * Deny-by-default: a token the adapter does not recognise yields Unknown,
--      which Allowed_By_Default rejects.  Least privilege is therefore a
--      provable consequence of the mapping, not a policy hope.
--    * Mode is inferable from the ECC role name: orchestrators are primary,
--      specialists are subagents.
--  APPLICATIONS:
--    * Ecc_Adapter.Tool_Permitted / Agent_Mode_Of delegate here.
--  CITATIONS:
--    [ECC v2.2.3 - ToBeImported/ecc/agents/code-reviewer.md lines 1-6]
--    [ECC v2.2.3 - ToBeImported/ecc/.opencode/opencode.json agent.*.tools]
--    [OpenCode config - https://opencode.ai/config.json]
with Ecc_Types; use Ecc_Types;

package Ecc_Agent_Map with
  SPARK_Mode => On,
  Abstract_State => null,
  Initializes => null
is

   --  Map one ECC tool token (e.g. "Read") to an OpenCode Tool_Id.
   --  Returns Unknown for any token outside the known set.
   function To_Tool (Name : String) return Tool_Id
   with
     Global => null,
     Pre    => True,
     Post   => To_Tool'Result in Tool_Id;

   --  Deny-by-default policy.  True only for a recognised tool.
   function Allowed_By_Default (Tool : Tool_Id) return Boolean
   with
     Global => null,
     Pre    => True,
     Post   => Allowed_By_Default'Result = (Tool /= Unknown);

   --  Infer the OpenCode agent mode from an ECC role name.
   function Infer_Mode (Name : String) return Agent_Mode
   with
     Global => null,
     Pre    => True,
     Post   => Infer_Mode'Result in Agent_Mode;

   --  (Tool_In_List deferred: see body note.)

end Ecc_Agent_Map;
