--  Ecc_Install: classify install component families.
package Ecc_Install with
  SPARK_Mode => On
is

   type Component_Family is
     (Baseline, Language, Framework, Capability, Agent, Skill, Locale);

   function Classify_Family (Name : String) return Component_Family
   with
     Global => null,
     Pre    => True,
     Post   => Classify_Family'Result in Component_Family;

   function Valid_Version (V : Natural) return Boolean
   with
     Global => null,
     Pre    => True,
     Post   => Valid_Version'Result in Boolean;

end Ecc_Install;
