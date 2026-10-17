package body Ecc_State with
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

   function Classify_Section (Name : String) return State_Section is
   begin
      if Eq (Name, "sessions") then return Sessions;
      elsif Eq (Name, "skillRuns") then return SkillRuns;
      elsif Eq (Name, "skillVersions") then return SkillVersions;
      elsif Eq (Name, "decisions") then return Decisions;
      elsif Eq (Name, "installState") then return InstallState;
      elsif Eq (Name, "governanceEvents") then return GovernanceEvents;
      elsif Eq (Name, "workItems") then return WorkItems;
      else return Sessions;
      end if;
   end Classify_Section;

   function Is_Valid_Key (Key : String) return Boolean is
   begin
      if Key'Length = 0 then
         return False;
      end if;
      for I in Key'Range loop
         declare
            C : constant Character := Key (I);
         begin
            if not ((C >= 'A' and C <= 'Z')
                    or else (C >= 'a' and C <= 'z')
                    or else (C >= '0' and C <= '9')
                    or else C = '_' or else C = '-') then
               return False;
            end if;
         end;
      end loop;
      return True;
   end Is_Valid_Key;

end Ecc_State;
