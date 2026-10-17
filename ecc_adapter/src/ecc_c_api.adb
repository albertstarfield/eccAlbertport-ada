--  Ecc_C_Api body — see spec for axioms, theory and citations.
--
--  AXIOMS:
--    * The C string arriving from ctypes is untrusted: it may be null, may
--      not be NUL-terminated, and may be arbitrarily long.
--  THEORY:
--    * To_Ada bounds every input to Max_Name_Length before it reaches SPARK
--      code, so the core never sees an unbounded string.
--  APPLICATIONS:
--    * Each exported function wraps its body in a handler that returns a
--      defined error code, so a Python caller can never crash the process.
--  CITATIONS:
--    [Python ctypes - https://docs.python.org/3/library/ctypes.html]
--    [GNAT Reference Manual - Interfaces.C.Strings]
with Ecc_Types;     use Ecc_Types;
with Ecc_Agent_Map; use Ecc_Agent_Map;
with Ecc_Effect;    use Ecc_Effect;
with Ecc_Commands; use Ecc_Commands;
with Ecc_Adapter;  use Ecc_Adapter;
with Ecc_Hooks;     use Ecc_Hooks;
with Ecc_Memory;    use Ecc_Memory;
with Ecc_State;     use Ecc_State;
with Ecc_Install;   use Ecc_Install;
with Ecc_Context;   use Ecc_Context;
with Interfaces.C;         use Interfaces.C;
with Interfaces.C.Strings; use Interfaces.C.Strings;
with System;
with System.Address_To_Access_Conversions;
with System.Storage_Elements; use System.Storage_Elements;
package body Ecc_C_Api with
  SPARK_Mode => Off
is
   use type System.Address;

   --  Instantiate address-to-access conversions for reading C bytes.
   package Char_Conv is new System.Address_To_Access_Conversions
     (Object => Interfaces.C.char);

   --  Read a C string from an untrusted address into a constrained buffer.
   --  Returns the number of characters read (excluding NUL).
   --  AXIOMS:
   --    * Addr may be Null_Address (returns Count = 0).
   --    * The C string may not be NUL-terminated (bounded by Buffer'Length).
   --  THEORY:
   --    * Reading bytes directly via Address_To_Access_Conversions
   --      bypasses the Ada runtime entirely — no adainit, no secondary
   --      stack.  This is the only safe way to read C strings from a
   --      ctypes-loaded GNAT relocatable library.
   --  APPLICATIONS:
   --    * Each exported function calls Read_C_String to convert its input.
   --  CITATIONS:
   --    [GNAT Reference Manual - System.Address_To_Access_Conversions]
   --    [Python ctypes - https://docs.python.org/3/library/ctypes.html]
   procedure Read_C_String
     (Addr   : System.Address;
      Buffer : out String;
      Count  : out Natural)
   is
      Ptr : Char_Conv.Object_Pointer;
   begin
      Count := 0;
      if Addr = System.Null_Address then
         return;
      end if;

      Ptr := Char_Conv.To_Pointer (Addr);

      for I in Buffer'Range loop
         exit when Ptr.all = Interfaces.C.nul;
         Buffer (I) := Character (Ptr.all);
         Count := Count + 1;
         Ptr := Char_Conv.To_Pointer
               (Char_Conv.To_Address (Ptr) + Storage_Offset (1));
      end loop;
   end Read_C_String;

   --  Compare a read buffer against a fixed Ada string without creating
   --  any unconstrained array (avoids the secondary stack on foreign
   --  threads such as Python's main thread).  [Murphy's law: no
   --  secondary-stack dependency in the FFI shim.]
   function Buffer_Equals
     (Buffer : String;
      Count  : Natural;
      S      : String) return Boolean
   is
   begin
      if Count /= S'Length then
         return False;
      end if;
      for I in 0 .. Count - 1 loop
         if Buffer (Buffer'First + I) /= S (S'First + I) then
            return False;
         end if;
      end loop;
      return True;
   end Buffer_Equals;

   function Ecc_Version return Interfaces.C.Strings.chars_ptr is
   begin
      return New_String ("ecc-adapter 0.1.0");
   exception
      when others =>
         return Null_Ptr;
   end Ecc_Version;

   function Ecc_Tool_Id (Name : System.Address) return int is
      Buffer : String (1 .. Max_Name_Length);
      Count  : Natural;
   begin
      Read_C_String (Name, Buffer, Count);
      --  Map known tokens without constructing an unconstrained String.
      if Buffer_Equals (Buffer, Count, "Read") then
         return int (Tool_Id'Pos (Read));
      elsif Buffer_Equals (Buffer, Count, "Write") then
         return int (Tool_Id'Pos (Write));
      elsif Buffer_Equals (Buffer, Count, "Edit") then
         return int (Tool_Id'Pos (Edit));
      elsif Buffer_Equals (Buffer, Count, "Bash") then
         return int (Tool_Id'Pos (Bash));
      elsif Buffer_Equals (Buffer, Count, "Grep") then
         return int (Tool_Id'Pos (Grep));
      elsif Buffer_Equals (Buffer, Count, "Glob") then
         return int (Tool_Id'Pos (Glob));
      elsif Buffer_Equals (Buffer, Count, "WebFetch") then
         return int (Tool_Id'Pos (Webfetch));
      elsif Buffer_Equals (Buffer, Count, "WebSearch") then
         return int (Tool_Id'Pos (Websearch));
      elsif Buffer_Equals (Buffer, Count, "Task") then
         return int (Tool_Id'Pos (Task_Tool));
      elsif Buffer_Equals (Buffer, Count, "TodoWrite") then
         return int (Tool_Id'Pos (Todowrite));
      elsif Buffer_Equals (Buffer, Count, "changed-files") then
         return int (Tool_Id'Pos (Changed_Files));
      else
         return int (Tool_Id'Pos (Unknown));
      end if;
   exception
      when others =>
         return -1;
   end Ecc_Tool_Id;

   function Ecc_Tool_Permitted (Name : System.Address) return int is
      Buffer : String (1 .. Max_Name_Length);
      Count  : Natural;
      Tool   : Tool_Id;
   begin
      Read_C_String (Name, Buffer, Count);
      if Buffer_Equals (Buffer, Count, "Read") then
         Tool := Read;
      elsif Buffer_Equals (Buffer, Count, "Write") then
         Tool := Write;
      elsif Buffer_Equals (Buffer, Count, "Edit") then
         Tool := Edit;
      elsif Buffer_Equals (Buffer, Count, "Bash") then
         Tool := Bash;
      elsif Buffer_Equals (Buffer, Count, "Grep") then
         Tool := Grep;
      elsif Buffer_Equals (Buffer, Count, "Glob") then
         Tool := Glob;
      elsif Buffer_Equals (Buffer, Count, "WebFetch") then
         Tool := Webfetch;
      elsif Buffer_Equals (Buffer, Count, "WebSearch") then
         Tool := Websearch;
      elsif Buffer_Equals (Buffer, Count, "Task") then
         Tool := Task_Tool;
      elsif Buffer_Equals (Buffer, Count, "TodoWrite") then
         Tool := Todowrite;
      elsif Buffer_Equals (Buffer, Count, "changed-files") then
         Tool := Changed_Files;
      else
         Tool := Unknown;
      end if;
      return (if Allowed_By_Default (Tool) then 1 else 0);
   exception
      when others =>
         return 0;
   end Ecc_Tool_Permitted;

   function Ecc_Effect_Gate (Class : int) return int is
   begin
      if Class not in Effect_Class'Pos (SE0) .. Effect_Class'Pos (SE4)
      then
         return -1;
      end if;
      return int (Gate_Decision'Pos (Gate (Effect_Class'Val (Class))));
   exception
      when others =>
         return -1;
   end Ecc_Effect_Gate;

   function Ecc_Agent_Mode (Name : System.Address) return int is
      Buffer : String (1 .. Max_Name_Length);
      Count  : Natural;
      Mode   : Agent_Mode;
   begin
      Read_C_String (Name, Buffer, Count);
      if Buffer_Equals (Buffer, Count, "orchestrator") then
         Mode := Primary;
      else
         Mode := Subagent;
      end if;
      return int (Agent_Mode'Pos (Mode));
   exception
      when others =>
         return -1;
   end Ecc_Agent_Mode;

   function Ecc_Command_Category (Name : System.Address) return int is
      Buffer : String (1 .. Max_Name_Length);
      Count  : Natural;
   begin
      Read_C_String (Name, Buffer, Count);
      if Count = 0 then
         return -1;
      end if;
      declare
         S : constant String := Buffer (1 .. Count);
         Cat : constant Command_Category := Command_Category_Of (S);
      begin
         return int (Command_Category'Pos (Cat));
      end;
   exception
      when others =>
         return -1;
   end Ecc_Command_Category;

   function Ecc_Hook_Event (Name : System.Address) return int is
      Buffer : String (1 .. Max_Name_Length);
      Count  : Natural;
   begin
      Read_C_String (Name, Buffer, Count);
      if Count = 0 then return -1; end if;
      declare
         S : constant String := Buffer (1 .. Count);
         V : constant Hook_Event := Classify_Event (S);
      begin
         return int (Hook_Event'Pos (V));
      end;
   exception
      when others => return -1;
   end Ecc_Hook_Event;

   function Ecc_Memory_Kind (Name : System.Address) return int is
      Buffer : String (1 .. Max_Name_Length);
      Count  : Natural;
   begin
      Read_C_String (Name, Buffer, Count);
      if Count = 0 then return -1; end if;
      declare
         S : constant String := Buffer (1 .. Count);
         V : constant Memory_Kind := Classify_Kind (S);
      begin
         return int (Memory_Kind'Pos (V));
      end;
   exception
      when others => return -1;
   end Ecc_Memory_Kind;

   function Ecc_State_Section (Name : System.Address) return int is
      Buffer : String (1 .. Max_Name_Length);
      Count  : Natural;
   begin
      Read_C_String (Name, Buffer, Count);
      if Count = 0 then return -1; end if;
      declare
         S : constant String := Buffer (1 .. Count);
         V : constant State_Section := Classify_Section (S);
      begin
         return int (State_Section'Pos (V));
      end;
   exception
      when others => return -1;
   end Ecc_State_Section;

   function Ecc_Component_Family (Name : System.Address) return int is
      Buffer : String (1 .. Max_Name_Length);
      Count  : Natural;
   begin
      Read_C_String (Name, Buffer, Count);
      if Count = 0 then return -1; end if;
      declare
         S : constant String := Buffer (1 .. Count);
         V : constant Component_Family := Classify_Family (S);
      begin
         return int (Component_Family'Pos (V));
      end;
   exception
      when others => return -1;
   end Ecc_Component_Family;

   function Ecc_Context_Mode (Name : System.Address) return int is
      Buffer : String (1 .. Max_Name_Length);
      Count  : Natural;
   begin
      Read_C_String (Name, Buffer, Count);
      if Count = 0 then return -1; end if;
      declare
         S : constant String := Buffer (1 .. Count);
         V : constant Context_Mode := Classify_Mode (S);
      begin
         return int (Context_Mode'Pos (V));
      end;
   exception
      when others => return -1;
   end Ecc_Context_Mode;

end Ecc_C_Api;
