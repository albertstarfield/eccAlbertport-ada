package body Ecc_Hooks with
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

   function Classify_Event (Name : String) return Hook_Event is
   begin
      if Eq (Name, "PreToolUse") then
         return PreToolUse;
      elsif Eq (Name, "PostToolUse") then
         return PostToolUse;
      elsif Eq (Name, "PostToolUseFailure") then
         return PostToolUseFailure;
      elsif Eq (Name, "UserPromptSubmit") then
         return UserPromptSubmit;
      elsif Eq (Name, "PreCompact") then
         return PreCompact;
      elsif Eq (Name, "SessionStart") then
         return SessionStart;
      elsif Eq (Name, "Stop") then
         return Stop;
      elsif Eq (Name, "SessionEnd") then
         return SessionEnd;
      else
         return PreToolUse;
      end if;
   end Classify_Event;

   function Is_Valid_Matcher (Matcher : String) return Boolean is
   begin
      if Matcher'Length = 0 then
         return False;
      end if;
      --  Accept letters, digits, pipe (alternation) and wildcard-ish chars.
      for I in Matcher'Range loop
         declare
            C : constant Character := Matcher (I);
         begin
            if not ((C >= 'A' and C <= 'Z')
                    or else (C >= 'a' and C <= 'z')
                    or else (C >= '0' and C <= '9')
                    or else C = '|' or else C = '*' or else C = '-') then
               return False;
            end if;
         end;
      end loop;
      return True;
   end Is_Valid_Matcher;

end Ecc_Hooks;
