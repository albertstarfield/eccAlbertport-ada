# Auto-Invoke ECC Components

## Skills
When a task matches a skill's description, ALWAYS invoke it via the `skill` tool
BEFORE starting work. Do not wait for the user to request it. Proactively load
relevant skills for the task at hand.

Available skill categories:
- Core dev: coding-standards, tdd-workflow, security-review, verification-loop, etc.
- Infrastructure: docker-patterns, kubernetes-patterns, deployment-patterns, etc.
- Database: postgres-patterns, mysql-patterns, redis-patterns, prisma-patterns, etc.
- Frontend: react-patterns, vue-patterns, angular-developer, etc.
- Backend: backend-patterns, api-design, error-handling, etc.
- Workflow: orch-*, agent-*, autonomous-*, etc.
- Testing: e2e-testing, react-testing, python-testing (FFI), etc.

## Commands
When a task matches a command's purpose, invoke it via slash command.
Proactively use `/ecc/...` commands when they fit the task.

## Agents
When a task requires specialized knowledge, delegate to the appropriate agent
via the `subagent` tool. Do not attempt complex specialized tasks solo.

## Rule
The agent should proactively discover and use relevant skills, commands, and agents
rather than waiting for explicit user invocation. This is the ECC paradigm: the harness
automatically augments the agent with the right tools for the job.

## Completion Needle (Auto-Continue Enforcement)

The system uses a "Needle in the haystack" mechanism to detect genuine completion:

- **NEEDLE**: A random 8-character string (e.g., "a9g30hf") generated per session
- The needle is injected into your context at session start
- You MUST output this exact string as the very last thing when ALL work is truly finished
- If you stop without outputting the needle, the system auto-continues
- Lazy phrases ("remaining", "I'll do later", "close enough", "good enough",
  "partially", "for now", "to be continued", "skipped", "deferred", etc.)
  trigger auto-continue even if present
- The needle changes every session (RNG) — you cannot predict or fake it

**Rule**: Never say "done" without the session needle. If you haven't
finished everything, keep working. The needle is the ONLY valid completion signal.

## Checklist Mode (For-Loop Enforcement)

When a goal is auto-generated from a user prompt, it is broken into a CHECKLIST
of individual items. The agent MUST work through them like a for-loop:

1. Read the checklist from `./.ecc/checklist.md`
2. Find the FIRST unchecked item (○)
3. Work on ONLY that item
4. Mark it checked (✓) in the checklist file
5. Move to the next unchecked item
6. Repeat until ALL items are checked (✓)
7. ONLY then output the session needle

**NEVER** do all items in one batch. **NEVER** skip items. **NEVER** mark
multiple items checked at once. One item per iteration, like a for-loop.

The checklist file format:
```
# ECC Goal Checklist

○ 1. First task item
✓ 2. Second task item (done)
○ 3. Third task item
```

Only when ALL items show ✓ can you output the needle.
