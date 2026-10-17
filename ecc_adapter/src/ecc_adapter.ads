--  Ecc_Adapter — public Ada API of the ECC -> OpenCode bridge.
--
--  AXIOMS:
--    * The adapter's job is to translate ECC's schema-driven declarations
--      into OpenCode's declarative config without inventing meaning.
--    * Every decision is delegated to a provable sub-package so the public
--      API is a thin, auditable facade.
--  THEORY:
--    * Because each function is a total composition of total functions over
--      closed enumerations, the whole API is total and provable.
--  APPLICATIONS:
--    * Ecc_C_Api re-exports these decisions across the C ABI to Python.
--  CITATIONS:
--    [ECC v2.2.3 - ToBeImported/ecc/.opencode/opencode.json]
--    [OpenCode config - https://opencode.ai/config.json]
with Ecc_Types;     use Ecc_Types;
with Ecc_Agent_Map; use Ecc_Agent_Map;
with Ecc_Effect;    use Ecc_Effect;
with Ecc_Commands; use Ecc_Commands;
with Ecc_Hooks;     use Ecc_Hooks;
with Ecc_Memory;    use Ecc_Memory;
with Ecc_State;     use Ecc_State;
with Ecc_Install;   use Ecc_Install;
with Ecc_Context;   use Ecc_Context;
with Ecc_Rules;     use Ecc_Rules;

package Ecc_Adapter with
  SPARK_Mode => On,
  Abstract_State => null,
  Initializes => null
is

   --  Adapter version, mirrored by the C ABI's ecc_version.
   Version : constant String := "ecc-adapter 0.1.0";

   --  True iff the named ECC tool token is permitted under the
   --  deny-by-default policy.
   function Tool_Permitted (Name : String) return Boolean
   with
     Global => null,
     Pre    => True,
     Post   => Tool_Permitted'Result = Allowed_By_Default (To_Tool (Name));

   --  Gate a tool call by its ECC effect class.
   function Gate_Tool (Class : Effect_Class) return Gate_Decision
   with
     Global => null,
     Pre    => True,
     Post   => Gate_Tool'Result = Gate (Class);

   --  Infer the OpenCode agent mode from an ECC role name.
   function Agent_Mode_Of (Name : String) return Agent_Mode
   with
     Global => null,
     Pre    => True,
     Post   => Agent_Mode_Of'Result = Infer_Mode (Name);

   --  Classify an ECC slash-command name into an OpenCode command category.
   function Command_Category_Of (Name : String) return Command_Category
   with
     Global => null,
     Pre    => True,
     Post   => Command_Category_Of'Result = Classify (Name);

   function Hook_Event_Of (Name : String) return Hook_Event
   with Global => null, Pre => True,
        Post  => Hook_Event_Of'Result = Classify_Event (Name);

   function Memory_Kind_Of (Name : String) return Memory_Kind
   with Global => null, Pre => True,
        Post  => Memory_Kind_Of'Result = Classify_Kind (Name);

   function State_Section_Of (Name : String) return State_Section
   with Global => null, Pre => True,
        Post  => State_Section_Of'Result = Classify_Section (Name);

   function Component_Family_Of (Name : String) return Component_Family
   with Global => null, Pre => True,
        Post  => Component_Family_Of'Result = Classify_Family (Name);

   function Context_Mode_Of (Name : String) return Context_Mode
   with Global => null, Pre => True,
        Post  => Context_Mode_Of'Result = Classify_Mode (Name);

   function Rule_Language_Of (Name : String) return Rule_Language
   with Global => null, Pre => True,
        Post  => Rule_Language_Of'Result = Classify_Language (Name);

end Ecc_Adapter;
