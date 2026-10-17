--  Ecc_Effect body — see spec for axioms, theory and citations.
package body Ecc_Effect with
  SPARK_Mode => On
is

   function Gate (Class : Effect_Class) return Gate_Decision is
   begin
      case Class is
         when SE0 .. SE2 =>
            return Proceed;
         when SE3 =>
            return Journal;
         when SE4 =>
            return Needs_Confirmation;
      end case;
   end Gate;

end Ecc_Effect;
