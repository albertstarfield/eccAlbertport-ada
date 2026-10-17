--  Ecc_Commands body.
package body Ecc_Commands with
  SPARK_Mode => On
is

   function Has_Suffix (Name : String; Suffix : String) return Boolean is
      N : constant Natural := Name'Length;
      S : constant Natural := Suffix'Length;
   begin
      if S = 0 or else N < S then
         return False;
      end if;
      --  Compare the last S characters of Name to Suffix.
      for K in 0 .. S - 1 loop
         if Name (Name'Last - K) /= Suffix (Suffix'Last - K) then
            return False;
         end if;
      end loop;
      return True;
   end Has_Suffix;

   function Classify (Name : String) return Command_Category is
   begin
      if Has_Suffix (Name, "-build") or else Has_Suffix (Name, "build") then
         return Build;
      elsif Has_Suffix (Name, "-review") or else Has_Suffix (Name, "review") then
         return Review;
      elsif Has_Suffix (Name, "-test") or else Has_Suffix (Name, "test") then
         return Test;
      elsif Has_Suffix (Name, "-plan") or else Has_Suffix (Name, "plan") then
         return Plan;
      elsif Has_Suffix (Name, "-fix") or else Has_Suffix (Name, "fix") then
         return Fix;
      elsif Has_Suffix (Name, "-docs") or else Has_Suffix (Name, "docs") then
         return Docs;
      else
         return Other;
      end if;
   end Classify;

   function Is_Valid_Slug (Name : String) return Boolean is
   begin
      if Name'Length = 0 then
         return False;
      end if;
      for I in Name'Range loop
         declare
            C : constant Character := Name (I);
         begin
            if not ((C >= 'a' and C <= 'z')
                    or else (C >= '0' and C <= '9')
                    or else C = '-') then
               return False;
            end if;
         end;
      end loop;
      return True;
   end Is_Valid_Slug;

end Ecc_Commands;
