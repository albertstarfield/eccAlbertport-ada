--  Ecc_Adapter body — see spec for axioms, theory and citations.
package body Ecc_Adapter with
  SPARK_Mode => On
is

   function Tool_Permitted (Name : String) return Boolean is
   begin
      return Allowed_By_Default (To_Tool (Name));
   end Tool_Permitted;

   function Gate_Tool (Class : Effect_Class) return Gate_Decision is
   begin
      return Gate (Class);
   end Gate_Tool;

   function Agent_Mode_Of (Name : String) return Agent_Mode is
   begin
      return Infer_Mode (Name);
   end Agent_Mode_Of;

   function Command_Category_Of (Name : String) return Command_Category is
   begin
      return Classify (Name);
   end Command_Category_Of;

   function Hook_Event_Of (Name : String) return Hook_Event is
   begin
      return Classify_Event (Name);
   end Hook_Event_Of;

   function Memory_Kind_Of (Name : String) return Memory_Kind is
   begin
      return Classify_Kind (Name);
   end Memory_Kind_Of;

   function State_Section_Of (Name : String) return State_Section is
   begin
      return Classify_Section (Name);
   end State_Section_Of;

   function Component_Family_Of (Name : String) return Component_Family is
   begin
      return Classify_Family (Name);
   end Component_Family_Of;

   function Context_Mode_Of (Name : String) return Context_Mode is
   begin
      return Classify_Mode (Name);
   end Context_Mode_Of;

   function Rule_Language_Of (Name : String) return Rule_Language is
   begin
      return Classify_Language (Name);
   end Rule_Language_Of;

end Ecc_Adapter;
