--  Ecc_C_Api — C ABI shim for the Python FFI bridge.
--
--  AXIOMS:
--    * This package is the trust boundary between untyped C strings and the
--      SPARK-verified core. It is therefore SPARK_Mode => Off by design: the
--      FFI boundary is exactly where SPARK's type guarantees end.
--    * Every function is total and never raises: any malformed input maps to
--      a defined error code, never a crash.  [Murphy's law: null pointers,
--      non-terminated strings and oversized input must all be handled.]
--  THEORY:
--    * The shim adds no decisions of its own — it converts, delegates to the
--      SPARK core, and converts back.  All meaning lives in Ecc_Adapter.
--  APPLICATIONS:
--    * run.py (ctypes) calls these five functions; nothing else may.
--  CITATIONS:
--    [Python ctypes - https://docs.python.org/3/library/ctypes.html]
--    [GNAT User's Guide - Interfacing to C]
with Interfaces.C;         use Interfaces.C;
with Interfaces.C.Strings;
with System;

package Ecc_C_Api with
  SPARK_Mode => Off
is

   --  Return a pointer to a static version string.  Never null on success.
   function Ecc_Version return Interfaces.C.Strings.chars_ptr
      with Export, Convention => C, External_Name => "ecc_version";

   --  Map an ECC tool token to its Tool_Id position, or -1 if unknown.
   function Ecc_Tool_Id (Name : System.Address) return int
      with Export, Convention => C, External_Name => "ecc_tool_id";

   --  Return 1 if the named tool is permitted by default, else 0.
   function Ecc_Tool_Permitted (Name : System.Address) return int
      with Export, Convention => C, External_Name => "ecc_tool_permitted";

   --  Map an effect class index (0..4) to a Gate_Decision position,
   --  or -1 if the index is out of range.
   function Ecc_Effect_Gate (Class : int) return int
      with Export, Convention => C, External_Name => "ecc_effect_gate";

   --  Map an ECC role name to an Agent_Mode position (0 primary, 1 sub).
   function Ecc_Agent_Mode (Name : System.Address) return int
      with Export, Convention => C, External_Name => "ecc_agent_mode";

   --  Classify an ECC slash-command name into a Command_Category position
   --  (0 Build,1 Review,2 Test,3 Plan,4 Fix,5 Docs,6 Other), or -1 on
   --  invalid input.
   function Ecc_Command_Category (Name : System.Address) return int
      with Export, Convention => C, External_Name => "ecc_command_category";

   --  Classify an ECC hook event name into a Hook_Event position, or -1.
   function Ecc_Hook_Event (Name : System.Address) return int
      with Export, Convention => C, External_Name => "ecc_hook_event";

   --  Classify an ECC memory kind string into a Memory_Kind position, or -1.
   function Ecc_Memory_Kind (Name : System.Address) return int
      with Export, Convention => C, External_Name => "ecc_memory_kind";

   --  Classify an ECC state-store section name into a State_Section position, or -1.
   function Ecc_State_Section (Name : System.Address) return int
      with Export, Convention => C, External_Name => "ecc_state_section";

   --  Classify an install component family into a Component_Family position, or -1.
   function Ecc_Component_Family (Name : System.Address) return int
      with Export, Convention => C, External_Name => "ecc_component_family";

   --  Classify an ECC context profile mode into a Context_Mode position, or -1.
   function Ecc_Context_Mode (Name : System.Address) return int
      with Export, Convention => C, External_Name => "ecc_context_mode";

end Ecc_C_Api;
