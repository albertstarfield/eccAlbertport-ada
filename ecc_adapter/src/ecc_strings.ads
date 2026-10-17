--  Ecc_Strings — provable string equality for the adapter.
--
--  AXIOMS:
--    * Ada's predefined "=" on String is not directly usable inside a SPARK
--      loop invariant, so the adapter needs a total, provable equality.
--  THEORY:
--    * Equality of two strings is the conjunction of equal length and
--      element-wise equality over the common index range.
--  APPLICATIONS:
--    * Ecc_Agent_Map uses Equal to map ECC tool tokens to Tool_Id values.
--  CITATIONS:
--    [Ada 2012 Reference Manual - RM 4.5.2 Relational Operators]
--    [SPARK 2014 User's Guide - Loop Invariants]
package Ecc_Strings with
  SPARK_Mode => On,
  Abstract_State => null,
  Initializes => null
is

   --  Return True iff A and B have the same length and same characters.
   --  Total: defined for null and non-null inputs alike.
   function Equal (A, B : String) return Boolean
   with
     Global => null,
     Pre    => True,
     Post =>
       Equal'Result =
         (A'Length = B'Length
          and then
            (for all I in 0 .. A'Length - 1 =>
               A (A'First + I) = B (B'First + I)));

end Ecc_Strings;
