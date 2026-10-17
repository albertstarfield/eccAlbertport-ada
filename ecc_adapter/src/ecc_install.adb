package body Ecc_Install with
  SPARK_Mode => On
is

   function Eq (A, B : String) return Boolean is
   begin
      if A'Length /= B'Length then
         return False;
      end if;
      for I in A'Range loop
         if A (I) /= B (B'First + (I - A'First)) then
            return False;
         end if;
      end loop;
      return True;
   end Eq;

   function Classify_Family (Name : String) return Component_Family is
   begin
      if Eq (Name, "baseline") then return Baseline;
      elsif Eq (Name, "language") then return Language;
      elsif Eq (Name, "framework") then return Framework;
      elsif Eq (Name, "capability") then return Capability;
      elsif Eq (Name, "agent") then return Agent;
      elsif Eq (Name, "skill") then return Skill;
      elsif Eq (Name, "locale") then return Locale;
      else return Baseline;
      end if;
   end Classify_Family;

   function Valid_Version (V : Natural) return Boolean is
   begin
      return V >= 1;
   end Valid_Version;

end Ecc_Install;
