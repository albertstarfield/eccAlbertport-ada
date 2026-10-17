package body Ecc_Context with
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

   function Classify_Mode (Name : String) return Context_Mode is
   begin
      if Eq (Name, "dev") then return Dev;
      elsif Eq (Name, "research") then return Research;
      elsif Eq (Name, "review") then return Review;
      else return Dev;
      end if;
   end Classify_Mode;

end Ecc_Context;
