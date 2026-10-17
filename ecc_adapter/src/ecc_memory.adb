package body Ecc_Memory with
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

   function Classify_Kind (Name : String) return Memory_Kind is
   begin
      if Eq (Name, "context") then return Context;
      elsif Eq (Name, "decision") then return Decision;
      elsif Eq (Name, "fact") then return Fact;
      elsif Eq (Name, "handoff") then return Handoff;
      elsif Eq (Name, "lesson") then return Lesson;
      elsif Eq (Name, "note") then return Note;
      elsif Eq (Name, "preference") then return Preference;
      elsif Eq (Name, "runbook") then return Runbook;
      else return Note;
      end if;
   end Classify_Kind;

   function Classify_Scope (Name : String) return Memory_Scope is
   begin
      if Eq (Name, "project") then return Project;
      elsif Eq (Name, "team") then return Team;
      elsif Eq (Name, "user") then return User;
      else return Project;
      end if;
   end Classify_Scope;

   function Classify_Status (Name : String) return Memory_Status is
   begin
      if Eq (Name, "active") then return Active;
      elsif Eq (Name, "rejected") then return Rejected;
      elsif Eq (Name, "superseded") then return Superseded;
      else return Active;
      end if;
   end Classify_Status;

   function Valid_Title_Length (Len : Natural) return Boolean is
   begin
      return Len >= 1 and Len <= 200;
   end Valid_Title_Length;

end Ecc_Memory;
