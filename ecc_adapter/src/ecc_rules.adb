package body Ecc_Rules with
  SPARK_Mode => On
is

   function Eq (A, B : String) return Boolean is
   begin
      if A'Length /= B'Length then
         return False;
      end if;
      for I in A'Range loop
         if A (I) /= B (B'First + (I - A'First)) then
            return False;
         end if;
      end loop;
      return True;
   end Eq;

   function Classify_Language (Name : String) return Rule_Language is
   begin
      if Eq (Name, "angular") then return Angular;
      elsif Eq (Name, "arkts") then return Arkts;
      elsif Eq (Name, "common") then return Common;
      elsif Eq (Name, "cpp") then return Cpp;
      elsif Eq (Name, "csharp") then return Csharp;
      elsif Eq (Name, "dart") then return Dart;
      elsif Eq (Name, "fsharp") then return Fsharp;
      elsif Eq (Name, "golang") then return Golang;
      elsif Eq (Name, "java") then return Java;
      elsif Eq (Name, "kotlin") then return Kotlin;
      elsif Eq (Name, "nuxt") then return Nuxt;
      elsif Eq (Name, "perl") then return Perl;
      elsif Eq (Name, "php") then return Php;
      elsif Eq (Name, "python") then return Python;
      elsif Eq (Name, "react") then return React;
      elsif Eq (Name, "react-native") then return React_Native;
      elsif Eq (Name, "ruby") then return Ruby;
      elsif Eq (Name, "rust") then return Rust;
      elsif Eq (Name, "swift") then return Swift;
      elsif Eq (Name, "typescript") then return Typescript;
      elsif Eq (Name, "vue") then return Vue;
      elsif Eq (Name, "web") then return Web;
      else return Common;
      end if;
   end Classify_Language;

end Ecc_Rules;
