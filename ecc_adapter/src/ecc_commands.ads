--  Ecc_Commands: classify and normalise ECC slash-command names.
--  AXIOMS:
--   A1. ECC command names are ASCII identifiers, optionally hyphenated.
--   A2. Classification is by suffix convention (-build, -review, -test, ...).
--  THEORIES:
--   T1. Suffix matching is case-sensitive (ECC uses lowercase slugs).
--  APPLICATIONS:
--   A. Used by the adapter to route an ECC command to the right OpenCode
--      command category without a giant lookup table.
--  CITATION: ECC commands directory (targetAdaptation/ecc/commands).
with Ecc_Strings; use Ecc_Strings;

package Ecc_Commands with
  SPARK_Mode => On
is

   type Command_Category is
     (Build, Review, Test, Plan, Fix, Docs, Other);

   --  Classify an ECC command name by its suffix convention.
   function Classify (Name : String) return Command_Category
   with
     Global => null,
     Pre    => True,
     Post   => Classify'Result in Command_Category;

   --  True iff Name is non-empty and contains only lowercase letters,
   --  digits and hyphens.
   function Is_Valid_Slug (Name : String) return Boolean
   with
     Global => null,
     Pre    => True,
     Post   => Is_Valid_Slug'Result in Boolean;

end Ecc_Commands;
