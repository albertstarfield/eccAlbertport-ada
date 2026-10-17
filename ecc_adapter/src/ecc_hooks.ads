--  Ecc_Hooks: classify ECC hook events and matchers.
with Ecc_Strings; use Ecc_Strings;

package Ecc_Hooks with
  SPARK_Mode => On
is

   type Hook_Event is
     (PreToolUse, PostToolUse, PostToolUseFailure,
      UserPromptSubmit, PreCompact, SessionStart, Stop, SessionEnd);

   --  Classify an ECC hook event name into a Hook_Event.
   function Classify_Event (Name : String) return Hook_Event
   with
     Global => null,
     Pre    => True,
     Post   => Classify_Event'Result in Hook_Event;

   --  True iff the matcher string is a recognised tool matcher.
   function Is_Valid_Matcher (Matcher : String) return Boolean
   with
     Global => null,
     Pre    => True,
     Post   => Is_Valid_Matcher'Result in Boolean;

end Ecc_Hooks;
