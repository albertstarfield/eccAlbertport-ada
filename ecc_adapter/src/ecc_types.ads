--  Ecc_Types — shared enumerations for the ECC -> OpenCode adapter.
--
--  AXIOMS:
--    * ECC encodes meaning formally in JSON Schemas; OpenCode encodes it in
--      declarative config. Both sides must agree on a closed vocabulary or the
--      bridge is lossy.
--    * A closed Ada enumeration is provably exhaustive, so gnatprove can show
--      every concept is handled and nothing is silently dropped.
--  THEORY:
--    * Any mapping function returning one of these types cannot invent a value
--      outside the agreed vocabulary (type safety as a proof obligation).
--  APPLICATIONS:
--    * Ecc_Agent_Map, Ecc_Effect and Ecc_Adapter all return members of these.
--  CITATIONS:
--    [ECC v2.2.3 - ToBeImported/ecc/schemas/capsule-envelope.schema.json]
--      effect_class enum: SE0..SE4 (read-only .. economic/external effect).
--    [ECC v2.2.3 - ToBeImported/ecc/agents/code-reviewer.md]
--      frontmatter "tools: Read, Grep, Glob, Bash".
--    [OpenCode config - https://opencode.ai/config.json]
--      agent "tools" object keys and agent "mode" enum.
package Ecc_Types with
  SPARK_Mode => On,
  Abstract_State => null,
  Initializes => null
is

   --  OpenCode tool identifiers — the keys of an agent's `tools` object.
   --  [OpenCode config: agent.tools.<key>]
   type Tool_Id is
     (Read,
      Write,
      Edit,
      Bash,
      Grep,
      Glob,
      Webfetch,
      Websearch,
      Task_Tool,
      Todowrite,
      Changed_Files,
      Unknown);

   --  OpenCode agent mode.  [OpenCode config: agent.mode]
   type Agent_Mode is (Primary, Subagent);

   --  Effect classes, verbatim from ECC's capsule-envelope schema.
   --  SE0 read-only; SE1 reversible local write; SE2 sandboxed mutation;
   --  SE3 append-only remote evidence; SE4 economic/external effect.
   --  [ECC capsule-envelope.schema.json -> properties.effect_class]
   type Effect_Class is (SE0, SE1, SE2, SE3, SE4);

   --  Gate decision derived from an effect class.
   type Gate_Decision is (Proceed, Journal, Needs_Confirmation);

   --  Operation status returned across the FFI boundary.
   type Status is
     (Ok, Invalid_Input, Unknown_Tool, Digest_Mismatch, Chain_Broken);

   --  Maximum accepted name length at the FFI boundary.  Bounds every
   --  untrusted C string before it reaches SPARK code.  [Murphy's law:
   --  assume oversized input.]
   Max_Name_Length : constant := 64;

end Ecc_Types;
