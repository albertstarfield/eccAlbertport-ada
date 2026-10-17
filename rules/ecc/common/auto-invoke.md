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
