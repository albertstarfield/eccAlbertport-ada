Require Import String.
Require Import Bool.
Require Import Arith.

(*  has_suffix: does s end with suf? Mirrors Ada Has_Suffix. *)
Definition has_suffix (s suf : string) : bool :=
  if (String.length suf <=? String.length s)%nat then
    String.eqb (String.substring (String.length s - String.length suf) (String.length suf) s) suf
  else false.

Definition toTool (name : string) : nat (* placeholder ordinal *) :=
  0.

Inductive ToolId : Type :=
  | TRead | TWrite | TEdit | TBash | TGrep | TGlob | TWebfetch | TWebsearch
  | TTask | TTodowrite | TChangedFiles | TUnknown.

Definition toTool' (name : string) : ToolId :=
  if String.eqb name "Read" then TRead
  else if String.eqb name "Write" then TWrite
  else if String.eqb name "Edit" then TEdit
  else if String.eqb name "Bash" then TBash
  else if String.eqb name "Grep" then TGrep
  else if String.eqb name "Glob" then TGlob
  else if String.eqb name "WebFetch" then TWebfetch
  else if String.eqb name "WebSearch" then TWebsearch
  else if String.eqb name "Task" then TTask
  else if String.eqb name "TodoWrite" then TTodowrite
  else if String.eqb name "changed-files" then TChangedFiles
  else TUnknown.

Lemma toTool'_Read : toTool' "Read" = TRead.
Proof. reflexivity. Qed.

Lemma toTool'_Unknown : toTool' "foobar" = TUnknown.
Proof. reflexivity. Qed.

Inductive EffectClass : Type := SE0 | SE1 | SE2 | SE3 | SE4.
Inductive GateDecision : Type := Proceed | Journal | NeedsConfirmation | Deny.

Definition gate (c : EffectClass) : GateDecision :=
  match c with
  | SE0 | SE1 | SE2 => Proceed
  | SE3 => Journal
  | SE4 => NeedsConfirmation
  end.

Lemma se4_not_proceed : gate SE4 <> Proceed.
Proof. discriminate. Qed.

Lemma se0_proceeds : gate SE0 = Proceed.
Proof. reflexivity. Qed.

Inductive AgentMode : Type := Primary | Subagent.

Definition inferMode (name : string) : AgentMode :=
  if String.eqb name "orchestrator" then Primary else Subagent.

Lemma only_orchestrator_primary : forall name,
  inferMode name = Primary <-> (name = "orchestrator")%string.
Proof.
  intros name. unfold inferMode. destruct (String.eqb name "orchestrator") eqn:E.
  - split.
    + intros _. apply String.eqb_eq. exact E.
    + intros _. reflexivity.
  - split.
    + intros H. discriminate H.
    + intros H. rewrite H in E. rewrite String.eqb_refl in E. discriminate E.
Qed.

Inductive CommandCategory : Type :=
  | CBuild | CReview | CTest | CPlan | CFix | CDocs | COther.

Definition classifyCommand (name : string) : CommandCategory :=
  if orb (has_suffix name "-build") (has_suffix name "build") then CBuild
  else if orb (has_suffix name "-review") (has_suffix name "review") then CReview
  else if orb (has_suffix name "-test") (has_suffix name "test") then CTest
  else if orb (has_suffix name "-plan") (has_suffix name "plan") then CPlan
  else if orb (has_suffix name "-fix") (has_suffix name "fix") then CFix
  else if orb (has_suffix name "-docs") (has_suffix name "docs") then CDocs
  else COther.

Lemma classifyCommand_total : forall name, exists c, classifyCommand name = c.
Proof. intros name. exists (classifyCommand name). reflexivity. Qed.

(*  Verify has_suffix behaves correctly on a sample. *)
Lemma has_suffix_build : has_suffix "foo-build" "-build" = true.
Proof. reflexivity. Qed.

Lemma has_suffix_exact : has_suffix "build" "build" = true.
Proof. reflexivity. Qed.
