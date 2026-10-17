--  Ecc_Strings body — see spec for axioms, theory and citations.
package body Ecc_Strings with
  SPARK_Mode => On
is

   function Equal (A, B : String) return Boolean is
      Match : Boolean := True;
   begin
      --  Different lengths cannot be equal.  Early return keeps the
      --  remaining loop total over a single common length.
      if A'Length /= B'Length then
         return False;
      end if;

      for I in 0 .. A'Length - 1 loop
         pragma Loop_Invariant
           (Match =
              (for all J in 0 .. I - 1 =>
                 A (A'First + J) = B (B'First + J)));

         if A (A'First + I) /= B (B'First + I) then
            Match := False;
         end if;
      end loop;

      return Match;
   end Equal;

end Ecc_Strings;
