--  Ecc_Python_Embed body.
--
--  All Python C API calls are wrapped in exception handlers.
--  SPARK_Mode => Off: this is the FFI boundary to libpython.
--
--  AXIOMS:
--    * libpython3.15 is linked at build time.
--    * Python C API is not thread-safe without GIL.
--  THEORY:
--    * Every call acquires GIL, checks for errors, releases GIL.
--    * On any exception, function returns Error (-1) and logs traceback.
--  APPLICATIONS:
--    * Ada core calls Python for I/O, subprocess, HTTP, file operations.
--  CITATIONS:
--    [Python C API - https://docs.python.org/3/c-api/]
--    [PyGILState - https://docs.python.org/3/c-api/init.html]
pragma Ada_2012;

with Interfaces.C;
with Interfaces.C.Strings;
with Ada.Text_IO;
with System;

package body Ecc_Python_Embed with
  SPARK_Mode => Off
is

   use type Interfaces.C.int;
   use type Interfaces.C.Strings.chars_ptr;
   use type System.Address;

   --  C imports from libpython
   procedure c_Py_Initialize
     with Import, Convention => C, External_Name => "Py_Initialize";
   --  Py_Initialize returns void in C, but we treat as int for safety

   procedure c_Py_Finalize
     with Import, Convention => C, External_Name => "Py_Finalize";

   function c_Py_IsInitialized return Interfaces.C.int
     with Import, Convention => C, External_Name => "Py_IsInitialized";

   function c_PyRun_SimpleString (command : Interfaces.C.Strings.chars_ptr)
     return Interfaces.C.int
     with Import, Convention => C, External_Name => "PyRun_SimpleString";

   function c_PyErr_Occurred return System.Address
     with Import, Convention => C, External_Name => "PyErr_Occurred";

   procedure c_PyErr_Print
     with Import, Convention => C, External_Name => "PyErr_Print";

   procedure c_PyErr_Clear
     with Import, Convention => C, External_Name => "PyErr_Clear";

   function c_PyGILState_Ensure return Interfaces.C.int
     with Import, Convention => C, External_Name => "PyGILState_Ensure";

   procedure c_PyGILState_Release (state : Interfaces.C.int)
     with Import, Convention => C, External_Name => "PyGILState_Release";

   function c_PyImport_ImportModule (name : Interfaces.C.Strings.chars_ptr)
     return System.Address
     with Import, Convention => C, External_Name => "PyImport_ImportModule";

   function c_PyObject_GetAttrString (obj : System.Address; name : Interfaces.C.Strings.chars_ptr)
     return System.Address
     with Import, Convention => C, External_Name => "PyObject_GetAttrString";

   function c_PyObject_CallFunction (callable : System.Address; format : Interfaces.C.Strings.chars_ptr)
     return System.Address
     with Import, Convention => C, External_Name => "PyObject_CallFunction";

   function c_PyUnicode_AsUTF8 (obj : System.Address) return Interfaces.C.Strings.chars_ptr
     with Import, Convention => C, External_Name => "PyUnicode_AsUTF8";

   procedure c_Py_DecRef (obj : System.Address)
     with Import, Convention => C, External_Name => "Py_DecRef";

   function c_PyLong_AsLong (obj : System.Address) return Interfaces.C.long
     with Import, Convention => C, External_Name => "PyLong_AsLong";

   --  Internal: GIL state
   Initialized : Boolean := False;

   --  Internal: safe string to chars_ptr
   function To_Chars (S : String) return Interfaces.C.Strings.chars_ptr is
   begin
      return Interfaces.C.Strings.New_String (S);
   exception
      when others =>
         return Interfaces.C.Strings.Null_Ptr;
   end To_Chars;

   function Initialize return Status_Code is
   begin
      if Initialized then
         return Success;
      end if;
      begin
         c_Py_Initialize;
         Initialized := True;
         Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] Python initialized");
         return Success;
      exception
         when others =>
            Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] ERROR: Python initialization failed");
            return Error;
      end;
   end Initialize;

   procedure Finalize is
   begin
      if not Initialized then
         return;
      end if;
      begin
         c_Py_Finalize;
         Initialized := False;
         Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] Python finalized");
      exception
         when others =>
            Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] ERROR: Python finalization failed");
      end;
   end Finalize;

   function Is_Initialized return Boolean is
   begin
      return Initialized;
   end Is_Initialized;

   function Run_String (Code : String) return Status_Code is
      GIL  : Interfaces.C.int;
      Ret  : Interfaces.C.int;
      Ptr  : Interfaces.C.Strings.chars_ptr;
   begin
      if not Initialized then
         if Initialize /= Success then
            return Error;
         end if;
      end if;
      GIL := c_PyGILState_Ensure;
      Ptr := To_Chars (Code);
      if Ptr = Interfaces.C.Strings.Null_Ptr then
         c_PyGILState_Release (GIL);
         return Error;
      end if;
      Ret := c_PyRun_SimpleString (Ptr);
      Interfaces.C.Strings.Free (Ptr);
      if c_PyErr_Occurred /= System.Null_Address then
         c_PyErr_Print;
         c_PyErr_Clear;
         c_PyGILState_Release (GIL);
         return Error;
      end if;
      c_PyGILState_Release (GIL);
      if Ret /= 0 then
         return Error;
      end if;
      return Success;
   exception
      when others =>
         Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] ERROR: Run_String exception");
         return Error;
   end Run_String;

   function Import_Module (Module_Name : String) return Status_Code is
      GIL    : Interfaces.C.int;
      ModPtr : System.Address;
   begin
      if not Initialized then
         if Initialize /= Success then
            return Error;
         end if;
      end if;
      GIL := c_PyGILState_Ensure;
      ModPtr := c_PyImport_ImportModule (To_Chars (Module_Name));
      if ModPtr = System.Null_Address then
         c_PyErr_Print;
         c_PyErr_Clear;
         c_PyGILState_Release (GIL);
         return Error;
      end if;
      c_Py_DecRef (ModPtr);
      c_PyGILState_Release (GIL);
      return Success;
   exception
      when others =>
         Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] ERROR: Import_Module exception");
         return Error;
   end Import_Module;

   function Call_Function
     (Module_Name : String;
      Func_Name   : String;
      Args        : String) return Status_Code
   is
      GIL     : Interfaces.C.int;
      ModPtr  : System.Address;
      FuncPtr : System.Address;
      Result  : System.Address;
      FmtPtr  : Interfaces.C.Strings.chars_ptr;
   begin
      if not Initialized then
         if Initialize /= Success then
            return Error;
         end if;
      end if;
      GIL := c_PyGILState_Ensure;
      ModPtr := c_PyImport_ImportModule (To_Chars (Module_Name));
      if ModPtr = System.Null_Address then
         c_PyErr_Print;
         c_PyErr_Clear;
         c_PyGILState_Release (GIL);
         return Error;
      end if;
      FuncPtr := c_PyObject_GetAttrString (ModPtr, To_Chars (Func_Name));
      if FuncPtr = System.Null_Address then
         c_Py_DecRef (ModPtr);
         c_PyErr_Print;
         c_PyErr_Clear;
         c_PyGILState_Release (GIL);
         return Error;
      end if;
      if Args'Length > 0 then
         FmtPtr := To_Chars (Args);
         Result := c_PyObject_CallFunction (FuncPtr, FmtPtr);
         Interfaces.C.Strings.Free (FmtPtr);
      else
         Result := c_PyObject_CallFunction (FuncPtr, To_Chars ("()"));
      end if;
      c_Py_DecRef (FuncPtr);
      c_Py_DecRef (ModPtr);
      if Result = System.Null_Address then
         c_PyErr_Print;
         c_PyErr_Clear;
         c_PyGILState_Release (GIL);
         return Error;
      end if;
      c_Py_DecRef (Result);
      c_PyGILState_Release (GIL);
      return Success;
   exception
      when others =>
         Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] ERROR: Call_Function exception");
         return Error;
   end Call_Function;

   function Get_Attribute
     (Module_Name : String;
      Attr_Name   : String;
      Buffer      : out String) return Interfaces.C.int
   is
      GIL     : Interfaces.C.int;
      ModPtr  : System.Address;
      AttrPtr : System.Address;
      Utf8    : Interfaces.C.Strings.chars_ptr;
      Count   : Interfaces.C.int := -1;
   begin
      Buffer := (others => ' ');
      if not Initialized then
         if Initialize /= Success then
            return -1;
         end if;
      end if;
      GIL := c_PyGILState_Ensure;
      ModPtr := c_PyImport_ImportModule (To_Chars (Module_Name));
      if ModPtr = System.Null_Address then
         c_PyErr_Print;
         c_PyErr_Clear;
         c_PyGILState_Release (GIL);
         return -1;
      end if;
      AttrPtr := c_PyObject_GetAttrString (ModPtr, To_Chars (Attr_Name));
      c_Py_DecRef (ModPtr);
      if AttrPtr = System.Null_Address then
         c_PyErr_Print;
         c_PyErr_Clear;
         c_PyGILState_Release (GIL);
         return -1;
      end if;
      Utf8 := c_PyUnicode_AsUTF8 (AttrPtr);
      if Utf8 /= Interfaces.C.Strings.Null_Ptr then
         declare
            S : constant String := Interfaces.C.Strings.Value (Utf8);
         begin
            Count := Interfaces.C.int (S'Length);
            if Count > Buffer'Length then
               Count := Interfaces.C.int (Buffer'Length);
            end if;
            for I in 1 .. Integer (Count) loop
               Buffer (I) := S (I);
            end loop;
         end;
      end if;
      c_Py_DecRef (AttrPtr);
      c_PyGILState_Release (GIL);
      return Count;
   exception
      when others =>
         Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] ERROR: Get_Attribute exception");
         return -1;
   end Get_Attribute;

   function Run_File (File_Path : String) return Status_Code is
      GIL : Interfaces.C.int;
      Fp  : Interfaces.C.Strings.chars_ptr;
      Ret : Interfaces.C.int;
   begin
      if not Initialized then
         if Initialize /= Success then
            return Error;
         end if;
      end if;
      GIL := c_PyGILState_Ensure;
      Fp := To_Chars ("exec(open('" & File_Path & "').read())");
      Ret := c_PyRun_SimpleString (Fp);
      Interfaces.C.Strings.Free (Fp);
      if c_PyErr_Occurred /= System.Null_Address then
         c_PyErr_Print;
         c_PyErr_Clear;
         c_PyGILState_Release (GIL);
         return Error;
      end if;
      c_PyGILState_Release (GIL);
      if Ret /= 0 then
         return Error;
      end if;
      return Success;
   exception
      when others =>
         Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] ERROR: Run_File exception");
         return Error;
   end Run_File;

   function Set_Variable
     (Module_Name : String;
      Var_Name    : String;
      Value       : String) return Status_Code
   is
      Code : constant String := Module_Name & "." & Var_Name & " = " & Value;
   begin
      return Run_String (Code);
   end Set_Variable;

   function Python_Version (Buffer : out String) return Interfaces.C.int is
      GIL : Interfaces.C.int;
   begin
      Buffer := (others => ' ');
      if not Initialized then
         if Initialize /= Success then
            return -1;
         end if;
      end if;
      GIL := c_PyGILState_Ensure;
      declare
         VerPtr : Interfaces.C.Strings.chars_ptr;
         VerStr : String (1 .. 64);
      begin
         VerPtr := c_PyUnicode_AsUTF8 (c_PyObject_GetAttrString (System.Null_Address, To_Chars ("__version__")));
         --  Python version via sys.version
      end;
      c_PyGILState_Release (GIL);
      --  Use Run_String to get version into a module
      if Run_String ("import sys; _ecc_pyver = sys.version") = Success then
         null;
      end if;
      return 0;
   exception
      when others =>
         Ada.Text_IO.Put_Line ("[Ecc_Python_Embed] ERROR: Python_Version exception");
         return -1;
   end Python_Version;

end Ecc_Python_Embed;

--  Additional test harness (not compiled into library, for verification only)
