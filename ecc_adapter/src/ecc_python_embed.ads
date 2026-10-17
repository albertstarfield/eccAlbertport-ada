--  Ecc_Python_Embed specification.
--
--  Embeds CPython into the Ada/SPARK process.  Ada is the host; Python is the
--  guest interpreter.  All Python C API calls are wrapped in exception handlers
--  (SPARK_Mode => Off: this is the FFI boundary to libpython).
--
--  AXIOMS:
--    * libpython3.15 is available at link time.
--    * Python initialization is idempotent (safe to call twice).
--  THEORY:
--    * Every Python call is guarded by GIL acquisition and exception checking.
--    * On any failure, the function returns a defined error code (-1) and
--      logs the Python traceback to stderr.
--  APPLICATIONS:
--    * Ada core calls Python for I/O tasks (file read/write, subprocess, HTTP).
--    * Python state persists across calls (interpreter stays alive).
--  CITATIONS:
--    [Python C API - https://docs.python.org/3/c-api/]
--    [PyGILState - https://docs.python.org/3/c-api/init.html#c.PyGILState_Ensure]
pragma Ada_2012;

with Interfaces.C;
with Interfaces.C.Strings;
with System;

package Ecc_Python_Embed with
  SPARK_Mode => Off
is

   use type Interfaces.C.int;
   use type System.Address;

   --  Status codes returned by embedded Python operations.
   subtype Status_Code is Interfaces.C.int;
   Success : constant Status_Code := 0;
   Error   : constant Status_Code := -1;

   --  Initialize the embedded Python interpreter.
   --  Safe to call multiple times (idempotent).
   --  Returns Success on success, Error on failure.
   function Initialize return Status_Code;

   --  Finalize the embedded Python interpreter.
   --  Safe to call even if not initialized.
   procedure Finalize;

   --  Check if the interpreter is initialized.
   function Is_Initialized return Boolean;

   --  Run a Python code string.  Captures stdout/stderr.
   --  Returns Success on success, Error on failure (exception logged).
   function Run_String (Code : String) return Status_Code;

   --  Import a Python module by name.  Returns Success if importable.
   function Import_Module (Module_Name : String) return Status_Code;

   --  Call a Python function: module.func(args).
   --  Args is a Python expression string (e.g. "('hello', 42)").
   --  Returns Success on success, Error on failure.
   function Call_Function
     (Module_Name : String;
      Func_Name   : String;
      Args        : String) return Status_Code;

   --  Get a Python attribute value as a string.
   --  Writes result into Buffer (max Max_Buffer_Length chars).
   --  Returns number of chars written, or -1 on error.
   function Get_Attribute
     (Module_Name : String;
      Attr_Name   : String;
      Buffer      : out String) return Interfaces.C.int;

   --  Execute a Python file.
   function Run_File (File_Path : String) return Status_Code;

   --  Set a Python variable (module-level) from an Ada string.
   function Set_Variable
     (Module_Name : String;
      Var_Name    : String;
      Value       : String) return Status_Code;

   --  Get Python version string.
   function Python_Version (Buffer : out String) return Interfaces.C.int;

   Max_Buffer_Length : constant := 4096;

end Ecc_Python_Embed;
