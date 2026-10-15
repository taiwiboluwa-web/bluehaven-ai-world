# BlueHaven AI World — Next Phase: Verified Tool Execution

**Status:** Phase 1 (model-backed orchestration) verified by a successful company mission.  
**Repository:** `taiwiboluwa-web/bluehaven-ai-world`  
**Deployment target:** existing Vercel project, production branch `main`.  
**Operating rule:** do not create feature branches for this work; do not replace existing architecture or reset the database.

## What is working now

- The Company Command page can submit a mission to `/api/company/orchestrate`.
- Atlas generates a coordination brief; selected department agents generate separate model-backed contributions.
- The API writes parent/child tasks and audit events to Neon.
- OmniRoute provides a Vercel-native OpenAI-compatible gateway.
- A completed model response is not proof that a proposed external action happened.

## Phase 2 goal

Give agents narrowly scoped, auditable tools so a task can move from recommendation to verified action without giving a model unrestricted access to the company.

## Implementation order

### 1. Establish execution boundaries
- Keep all provider keys and service tokens server-side.
- Use distinct credentials for company governance, agent execution, and each external connector.
- Add an explicit tool allowlist per agent and action.
- Default external actions to read-only or draft-only.
- Require CHO approval for writes, publishing, deployment, email sending, permission changes, and destructive operations.
- Record requested action, actor, approval, connector, result, timestamp, and verification evidence in the audit ledger.
- Never log tokens or include them in model prompts.

### 2. Add a GitHub read-only connector
- Add a server-only GitHub App or fine-grained token through Vercel Environment Variables; never put it in browser code or commit it.
- Begin with repository metadata, branch/commit inspection, file reads, and workflow/deployment status.
- Restrict access to `taiwiboluwa-web/bluehaven-ai-world` and `main` wherever permissions allow.
- Do not allow the model to execute arbitrary shell commands.
- For the first milestone, agents can inspect and report. Changes remain a human-approved operation.

### 3. Add an evidence-backed audit mission
- Mission goal: inspect the existing repository, its API routes, environment-variable documentation, and latest Vercel deployment evidence.
- Findings must link to exact repository paths, commit IDs, workflow results, or deployment/runtime evidence.
- Label observations as **verified**, **inferred**, or **blocked**.
- Do not claim a build passed unless a build/workflow result proves it.

### 4. Add approved change proposals
- Forge produces a patch proposal and tests.
- Quinn reviews security, permissions, and regression risk.
- Atlas reconciles conflicting feedback and creates an approval checklist.
- The CHO explicitly approves before a write or deployment. Keep the production branch as the single source of truth.

### 5. Validate before enabling write actions
- Test invalid and missing tokens (401), unauthorized connector actions (403), malformed inputs (400), rate limits, timeouts, and provider failures.
- Verify that every failed or blocked action leaves an audit event.
- Confirm no secret appears in responses, logs, client bundles, or task outputs.
- Run the existing `npm run build`, `npm run lint`, and `npm run smoke:production` checks where the connected CI/build environment supports them.
- Roll out one connector at a time and retain a disable switch.

## Required setup in Vercel

1. Open the [existing project environment settings](https://vercel.com/taiwoluwa-3003s-projects/bluehaven-ai-world/settings/environment-variables).
2. Create a GitHub App or fine-grained token restricted to this repository with read-only repository contents and Actions/workflow read permissions only, as needed.
3. Add it as a server-only environment variable such as `GITHUB_APP_PRIVATE_KEY` / app credentials or `GITHUB_READ_TOKEN` (choose one implementation, not both by default).
4. Redeploy the existing `main` deployment after adding the credential.
5. Verify the connector with a read-only request before enabling any write permission.

Do not paste the credential into chat or commit it to GitHub. If a credential was previously exposed, rotate it before use.

## Acceptance criteria

- A mission report includes evidence-backed findings, not only generic recommendations.
- Every tool invocation has a validated schema and a server-side permission check.
- External writes require explicit CHO approval and idempotency protection.
- The audit trail records success, failure, and blocked actions.
- Existing routes, Neon data, OmniRoute behavior, and the current Vercel deployment remain intact.

## Known blockers

- No GitHub connector credential has been verified for the runtime yet.
- The current Company Command workflow is model-backed and does not itself have GitHub, shell, browser, email, or deployment tool access.
- Production build/test status must be read from actual CI/Vercel evidence, not inferred from a successful agent mission.
