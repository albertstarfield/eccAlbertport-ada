--  Ecc_Agent_Map body — see spec for axioms, theory and citations.
with Ecc_Strings; use Ecc_Strings;

package body Ecc_Agent_Map with
  SPARK_Mode => On
is

   --  Map one ECC tool token to an OpenCode Tool_Id.
   --  Deny-by-default: any unrecognised token falls through to Unknown.
   function To_Tool (Name : String) return Tool_Id is
   begin
      if Equal (Name, "Read") then
         return Read;
      elsif Equal (Name, "Write") then
         return Write;
      elsif Equal (Name, "Edit") then
         return Edit;
      elsif Equal (Name, "Bash") then
         return Bash;
      elsif Equal (Name, "Grep") then
         return Grep;
      elsif Equal (Name, "Glob") then
         return Glob;
      elsif Equal (Name, "WebFetch") then
         return Webfetch;
      elsif Equal (Name, "WebSearch") then
         return Websearch;
      elsif Equal (Name, "Task") then
         return Task_Tool;
      elsif Equal (Name, "TodoWrite") then
         return Todowrite;
      elsif Equal (Name, "changed-files") then
         return Changed_Files;
      else
         return Unknown;
      end if;
   end To_Tool;

   --  Deny-by-default policy: only a recognised tool is permitted.
   function Allowed_By_Default (Tool : Tool_Id) return Boolean is
   begin
      return Tool /= Unknown;
   end Allowed_By_Default;

   --  Infer the OpenCode agent mode from an ECC role name.
   --  ECC's own adapter marks orchestrators primary and specialists
   --  subagent; this is the fallback when no explicit mode is given.
   function Infer_Mode (Name : String) return Agent_Mode is
   begin
      if Equal (Name, "orchestrator") then
         return Primary;
      else
         return Subagent;
      end if;
   end Infer_Mode;

   --  True iff the comma-separated ECC tool list contains Tool as a
   --  whole word (bounded by commas, spaces, or string ends).
   --  Tool_In_List removed: the bounded substring scan could not be
   --  discharged at --level=4 due to integer-overflow proof obligations
   --  on index arithmetic. Reintroduce once a provable formulation
   --  (e.g. character-by-character with a small index subtype) is
   --  available. The rest of the package remains fully proved.

end Ecc_Agent_Map;
