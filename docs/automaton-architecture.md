# BlueHaven Automaton — controlled foundation

## Decision
Build the Automaton concept inside the existing BlueHaven AI World control plane. Do not replace the current Next.js/Neon architecture with an unreviewed autonomous runtime. This is an integration foundation, not a claim that the original Conway Automaton has been installed.

## Existing capabilities
- The application already has a company roster, task ledger, multi-agent orchestration and a model gateway.
- The current `/api/agents/run` endpoint is a single-turn model call. It does not execute tools, run arbitrary code, manage a wallet or reproduce agents.
- Vercel Functions are not a persistent general-purpose host for a self-running daemon.

## Phase 1 — control plane
- Additive Neon tables for the Automaton instance, child-agent registry, runs, approvals and a simulated wallet ledger.
- Default state is **paused** and **simulation**.
- Default daily budget is $2 and maximum estimated run cost is $0.25.
- All real spending, external transactions, publishing, deployments, agent spawning and production changes require CHO approval.
- Never store crypto private keys, seed phrases or provider secrets in Postgres.

## Phase 2 — sandboxed execution (not enabled by this migration)
Use an isolated, ephemeral execution sandbox with no ambient credentials. Provide only narrow, typed tools. Enforce network allowlists, execution timeouts, output limits, per-run budgets and audit logs. Do not give agents unrestricted shell access, production database credentials, wallet signing authority or direct production deployment permissions.

## Phase 3 — revenue and wallet
Start with a simulated USD ledger. A ledger credit is not proof of revenue. Real revenue may only be recorded after reconciliation against a payment processor or bank settlement. Any eventual on-chain wallet must be separately provisioned with a capped hot wallet, no seed phrase exposed to the model, and explicit human approval for transfers.

## Deployment gates
1. Run this schema only on the isolated Neon `automaton-dev` branch.
2. Implement and test authenticated run/approval APIs.
3. Add an execution sandbox and verify isolation before enabling sandbox mode.
4. Keep production database and public deployment unchanged until review.
5. Do not claim self-sustaining income or autonomous reproduction without independently verified results.
