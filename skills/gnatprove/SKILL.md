---
name: gnatprove
description: This skill should be used when the user wants to "prove SPARK code", "run GNATprove", "investigate unproved checks", "write contracts or invariants", "add loop invariants", "write ghost code or lemmas", or is working on SPARK formal verification. Covers running gnatprove, writing SPARK (contracts, types, loops, ghost code), and conducting proof campaigns.
license: Apache-2.0
metadata:
  version: "0.2.0"
---
> **OpenCode Paradigm (Ada/SPARK-First)**: This project uses Ada/SPARK as the primary
> implementation language.  All business logic, classification, gating, and state management
> MUST be in Ada/SPARK (SPARK_Mode => On).  Python is FFI-only (wrapper).  JavaScript is
> BANNED (TypeScript only for OpenCode plugin host API).  The frontend/UI remains identical
> in appearance but is driven by Ada/SPARK backend logic via FFI.  Validation: `gnatprove --level=4`,
> `pyrefly check .`, `ruff check .`, `jslint`.  Approval gates required before execution.
> Context must be loaded before any code changes.  See `ecc_adapter/` for the verified core.



# gnatprove

`gnatprove` is the tool that checks the validity of, analyzes data flows for,
and proves SPARK code. SPARK is a subset of Ada (it restricts the use of
certain Ada features) and a superset of Ada (it offers some aspects that
extend the semantics of the Ada language).

*Note*: when a user says "SPARK", they may be talking about either the language
or `gnatprove`. This should be clear from context. E.g., "Run SPARK and ..."
means "Run `gnatprove` and ..."; "Update the SPARK to ..." means "Update the
SPARK source code to ...".

## Locating gnatprove

Unless the user has already told you how to invoke gnatprove, determine the right
invocation in this order:

1. **Check for an `alire.toml` in the project root.** Its presence means the project
   is an Alire crate; use `alr gnatprove -P <project.gpr> ...` rather than bare
   `gnatprove`. Alire computes and injects the correct environment (including
   `GPR_PROJECT_PATH` for multi-crate projects) before calling gnatprove, so this
   is the correct invocation for Alire-managed projects even when `gnatprove` is
   also on `PATH`.

2. **Check if `gnatprove` is already on `PATH`.** Run `which gnatprove`. If found,
   use it — but if proof runs fail with project-file resolution errors, the
   environment may be incomplete (see step 3).

3. **Ask the user.** SPARK Pro installations (commonly under `/usr/gnat` or
   `/opt/gnat`) typically require environment setup beyond a binary path. If
   gnatprove is not on `PATH` and there's no `alire.toml`, don't guess — ask the
   user how they want to configure the environment.

## Quick Start

To prove SPARK code, run GNATprove via Bash with the project's environment.

```bash
  gnatprove -P <project.gpr> -j0 --output=oneline --output-header <arguments> 2>&1 | tee gnatprove-run.txt
```

`--output-header` is mandatory on every invocation. It writes a header into
`gnatprove.out` recording the exact command line, gnatprove version, host, and
timestamp. This is how a reader — a returning user, or the main agent
verifying a subagent's run — confirms *how* gnatprove was invoked without
guessing or asking. See [gnatprove-out.md § Invocation header](references/gnatprove/gnatprove-out.md#invocation-header).

**Never run two gnatprove instances concurrently.** `gnatprove` assumes
exclusive ownership of its output directories; parallel runs corrupt results.

**Bash tool timeout**: `gnatprove` can take tens of minutes — there is no way to
predict duration in advance. Always set a large `timeout` on the Bash tool call:
- **Scoped runs** (`--limit-subp`, `--limit-line`): minimum 300000ms (5 min)
- **Whole-unit or whole-program runs**: 600000ms (10 min) or more

Common arguments:
- `-jN` (where 0 means as many threads as possible and N>0 means use that many
   parallel threads)
- `--level=4 --mode=all` (the ONLY permitted level; never use a lower level)
- `--limit-subp=file.adb:NN` (prove one subprogram; NN = **declaration** line,
  not body. Line numbers shift after any edit; always confirm you have the
  right `NN`)
- `--limit-line=file.adb:MM` (prove exactly one check; assumes assertions
  above. Line numbers shift after any edit; always confirm you have the right
  `MM`)
- `--output=oneline` (one check per line; good for status assessment)
- `--output-header` (write invocation header into `gnatprove.out`; mandatory)
- `-f` (force full reanalysis)

*Note*: with `--limit-subp` or `--limit-line`, the filename must NOT include
the `src/` prefix -- the GPR file handles source directories.

Piping through `tee` saves output to `gnatprove-run.txt` so you can re-filter
it (grep, etc.) without re-running.

***Important***: **Never** re-run gnatprove solely to re-examine output.
A re-run without a code or contract change produces the same result at
significant cost. Even should `gnatprove` time out but produce output,
work with that output — a partial run is still useful and re-running would
violate the no-redundant-runs rule. Only re-run with a larger timeout if the
run produced **no output at all**. Note the timeout for future runs. Never rely
on the default 120s timeout.

`gnatprove`'s output is all meaningful, and breaks into three parts:

1. Information about `gnatprove`'s phase of operation. When there are errors,
   knowing where `gnatprove` stopped is helpful.
2. Warnings and check messages. These tell you about flow or proof problems.
3. Summary. `gnatprove` tells you the location of `gnatprove.out`. Newer
   versions of `gnatprove` will print a success message when all checks are
   proved.

`gnatprove` check messages may be low, medium or high - these reflect
confidence that the check is a true positive. `high` check messages should be
treated as errors.

`gnatprove`'s exit code *does not* tell you if all checks are proved. You know
all checks are proved when there are no warning or check messages.

## Use Cases

There are three broad use cases for this skill.

1. **Working with `gnatprove`.**
   Invoking the tool, CLI options, interpreting output.
   Read [gnatprove.md](references/gnatprove/gnatprove.md)
2. **Writing SPARK.**
   Contracts, types, access types, loops, ghost code and lemmas.
   Read [spark.md](references/spark/spark.md)
3. **Proving SPARK with `gnatprove`.**
   Proof campaigns, debugging proof failures, improving provability.
   Read [proof.md](references/proof/proof.md)

## Assurance levels (--mode, not --level)

`--level=N` is only prover effort. The assurance level is selected by `--mode`:

- Silver  -> `--mode=all`     (`--mode=silver`): AoRTE. DEFAULT for critical software.
- Gold    -> `--mode=all`     (`--mode=gold`): Silver + key integrity properties.
- Platinum-> `--mode=all`: full functional correctness (rare, small scope).

Silver and Gold use the SAME switches; the difference is the OBJECTIVES (contracts),
not the command. Minimum standard = HIGHEST achievable (Gold by default, Platinum
for highest-integrity subsets).

MANDATORY full-verification command:
`alr exec -- gnatprove -P project.gpr --mode=all --level=4 -j0 --proof=all --counterexample=on --report=all`

ALWAYS USE -j0: gnatprove MUST always be invoked with -j0 (maximum parallelism). Never omit -j0. I don't care how hard it would be -- there is no exception, no excuse, no shortcut. Difficulty is not a justification. There is no such thing as hardcore strictness -- this is what is asked for at the very least, so all of this is a bare minimum, not an upper bound. NO "IT WILL BE GOOD ENOUGH": "good enough" is NEVER acceptable. Prove, prove the coverage, torture it. If even a niche part breaks, it is a complete, fatal failure -- overconfidence is a defect. Prove the logic and theorems through Rocq (Coq) and Lean to confirm they are valid in the first place. A claimed-but-unrun proof is grounds for termination.
MEMCACHE: gnatprove supports proof-result caching via `--memcached-server=host:port` (memcached instance) or `--memcached-server=file:directory` (file-based cache, best for CI). Use to speed up repeated proof runs. Args verified: present in gnatprove --help.

FIX ALL WARNINGS: gnatprove and compiler warnings MUST be zero. Treat every warning as an error. Re-run until clean.

- `Storage_Error` is NOT covered by SPARK: GNATstack is GNAT Pro only (commercial), NOT in the
  FOSS toolchain. Use FOSS alternatives: compile with -fstack-usage (.su files), perform
  worst-case-path stack analysis, plus `pragma Restrictions (No_Secondary_Stack)`, bounded
  recursion depth, and documented stack-size limits. Document the strategy.
- If a stack-analysis tool is NOT installed yet, SET IT UP -- build/install a FOSS tool or use
  -fstack-usage directly. NO EXCUSE. NO EXCEPTION.
- `Skip_Flow_And_Proof` / `Skip_Proof` reduce guarantees below Silver; never on
  load-bearing code.
- Boundary assumptions (preconditions, validity, aliasing) must be discharged by
  proof of callers, runtime checks (`-gnateA`/`-gnateV`/`-gnatVa`), or
  documented justification. Use `-gnata` to exercise contracts during testing.
- Unproved checks must be discharged or explicitly justified (pragma Annotate /
  pragma Assert) and reviewed; the Unproved column must be empty for the chosen
  objective or every entry tracked and justified.
- Loops require loop invariants for AoRTE inside/after the loop; termination
  requires loop/subprogram variants or `Always_Terminates`. `Relaxed_Initialization`,
  non-static `Always_Terminates`, `Subprogram_Variant`, `Loop_Variant`, and
  `Exceptional_Cases` push guarantees up to Silver and require `--mode=all`.
- Objectives beyond AoRTE: correct integration (Global/Depends), functional
  correctness (quantified expressions, expression functions, contract cases),
  parameterized software (getter functions with scalar ranges/predicates), safe
  optimization of run-time checks (Suppress/Unsuppress, -gnatp/-gnata), data and
  control coupling, portability (`--pedantic`, target parameterization,
  fixed/float handling).
- Manual proof (Platinum), cheapest first: (a) SPARK lemma library, (b) ghost
  code, (c) Coq. Lean is also acceptable for load-bearing proofs; Coq is last
  resort. NEVER claim "formally verified" unless the prover actually ran and passed.
