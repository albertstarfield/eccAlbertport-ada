--  Ecc_Rules: classify ECC rule language packs.
package Ecc_Rules with
  SPARK_Mode => On
is

   type Rule_Language is
     (Angular, Arkts, Common, Cpp, Csharp, Dart, Fsharp, Golang,
      Java, Kotlin, Nuxt, Perl, Php, Python, React, React_Native,
      Ruby, Rust, Swift, Typescript, Vue, Web);

   function Classify_Language (Name : String) return Rule_Language
   with
     Global => null,
     Pre    => True,
     Post   => Classify_Language'Result in Rule_Language;

end Ecc_Rules;
