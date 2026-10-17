--  Ecc_Effect — maps ECC effect classes onto OpenCode gate decisions.
--
--  AXIOMS:
--    * ECC's capsule-envelope schema defines five effect classes SE0..SE4.
--      [ECC capsule-envelope.schema.json -> properties.effect_class]
--    * OpenCode has no native effect taxonomy; the adapter must translate
--      ECC's formal classification into a concrete gate action.
--  THEORY:
--    * The mapping is a total function over a closed enumeration, so
--      gnatprove can show every effect class yields exactly one decision and
--      no class is silently dropped.
--  APPLICATIONS:
--    * Ecc_Adapter.Gate_Tool delegates here; the C ABI exposes it as
--      ecc_effect_gate.
--  CITATIONS:
--    [ECC v2.2.3 - ToBeImported/ecc/schemas/capsule-envelope.schema.json]
--    [OpenCode permissions - https://opencode.ai/config.json]
with Ecc_Types; use Ecc_Types;

package Ecc_Effect with
  SPARK_Mode => On,
  Abstract_State => null,
  Initializes => null
is

   --  Map an effect class to a gate decision.
   --  SE0..SE2 are local and reversible -> Proceed.
   --  SE3 is append-only remote evidence  -> Journal (record before acting).
   --  SE4 is economic/external           -> Needs_Confirmation.
   function Gate (Class : Effect_Class) return Gate_Decision
   with
     Global => null,
     Pre    => True,
     Post =>
       (if Class in SE0 .. SE2 then Gate'Result = Proceed
        elsif Class = SE3 then Gate'Result = Journal
        else Gate'Result = Needs_Confirmation);

end Ecc_Effect;
