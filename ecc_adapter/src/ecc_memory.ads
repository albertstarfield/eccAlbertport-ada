--  Ecc_Memory: validate ECC memory document fields.
package Ecc_Memory with
  SPARK_Mode => On
is

   type Memory_Kind is
     (Context, Decision, Fact, Handoff, Lesson, Note,
      Preference, Runbook);

   type Memory_Scope is (Project, Team, User);

   type Memory_Status is (Active, Rejected, Superseded);

   --  Classify a memory kind string.
   function Classify_Kind (Name : String) return Memory_Kind
   with
     Global => null,
     Pre    => True,
     Post   => Classify_Kind'Result in Memory_Kind;

   --  Classify a memory scope string.
   function Classify_Scope (Name : String) return Memory_Scope
   with
     Global => null,
     Pre    => True,
     Post   => Classify_Scope'Result in Memory_Scope;

   --  Classify a memory status string.
   function Classify_Status (Name : String) return Memory_Status
   with
     Global => null,
     Pre    => True,
     Post   => Classify_Status'Result in Memory_Status;

   --  True iff a title length is within the schema bounds (1..200).
   function Valid_Title_Length (Len : Natural) return Boolean
   with
     Global => null,
     Pre    => True,
     Post   => Valid_Title_Length'Result in Boolean;

end Ecc_Memory;
