--  Ecc_State: classify state-store sections.
package Ecc_State with
  SPARK_Mode => On
is

   type State_Section is
     (Sessions, SkillRuns, SkillVersions, Decisions,
      InstallState, GovernanceEvents, WorkItems);

   function Classify_Section (Name : String) return State_Section
   with
     Global => null,
     Pre    => True,
     Post   => Classify_Section'Result in State_Section;

   function Is_Valid_Key (Key : String) return Boolean
   with
     Global => null,
     Pre    => True,
     Post   => Is_Valid_Key'Result in Boolean;

end Ecc_State;
