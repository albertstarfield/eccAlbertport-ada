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

- **NEEDLE**: `ECC_NEEDLE_COMPLETE`
- The agent MUST output this exact string when ALL work is truly finished
- If the agent stops without outputting the needle, the system auto-continues
- Lazy phrases ("remaining", "I'll do later", "close enough", "good enough",
  "partially", "for now", "to be continued", "skipped", "deferred", etc.)
  trigger auto-continue even if present

**Rule**: Never say "done" without `ECC_NEEDLE_COMPLETE`. If you haven't
finished everything, keep working. The needle is the ONLY valid completion signal.
