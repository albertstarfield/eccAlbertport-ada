--  Ecc_Context: classify ECC context profiles.
package Ecc_Context with
  SPARK_Mode => On
is

   type Context_Mode is (Dev, Research, Review);

   function Classify_Mode (Name : String) return Context_Mode
   with
     Global => null,
     Pre    => True,
     Post   => Classify_Mode'Result in Context_Mode;

end Ecc_Context;
