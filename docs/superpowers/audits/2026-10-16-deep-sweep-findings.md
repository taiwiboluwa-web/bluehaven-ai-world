# BlueHaven AI World — Deep Sweep Findings

**Audit date:** 2026-10-16  
**Repository:** `taiwiboluwa-web/bluehaven-ai-world`  
**Branch:** `main`  
**Scope:** source review, clean-room install/lint/build, route inventory, and unauthenticated production HTTP checks. No paid generation, social publishing, or destructive database operations were performed.

## Executive summary

- Clean install completed.
- `npm run lint` completed with **0 errors and 1 warning**; the warning was in `types/pathfinding.d.ts` and was addressed in commit `5ce3227`.
- `npm run build` completed successfully on Next.js 15.5.28.
- The production homepage and OmniRoute health endpoint returned HTTP 200.
- Unauthenticated OmniRoute chat completion was rejected with HTTP 401, as intended.
- Production API checks confirmed that `GET /api/company` and `GET /api/projects` are reachable without an application credential. The company response includes people, agents, workers, tasks, hiring requests, notifications, and daily briefs. The projects endpoint returned project records.
- The project currently has Vercel SSO protection configured for all deployments except custom domains, but the production hostname tested returned these API responses without a login redirect. This means the effective protection boundary does not currently prevent these requests on that hostname.

## Findings

### High — Internal company data is available without application authentication

**Evidence:** `app/api/company/route.ts` exports `GET()` without checking a session or bearer token. A direct unauthenticated request to the production endpoint returned HTTP 200 and included `people`, `agents`, `workers`, `tasks`, `hiringRequests`, `notifications`, and `dailyBriefs`.

**Impact:** Internal staffing, work items, hiring decisions, notifications, and operational summaries may be disclosed to anyone who can reach the endpoint.

**Recommended fix:** Establish an explicit workspace access model and enforce it server-side. Keep only intentionally public status fields public. Protect company records and admin actions using a secure session or a trusted service credential. Add tests that assert unauthenticated requests receive 401/403.

**Status:** Open — needs an access-boundary decision because the current homepage and company UI are built around direct API calls and do not have a general workspace login flow. Do not silently break the existing workspace by adding isolated auth checks without the corresponding session UX.

### High — Project reads and mutations have no application-level authorization

**Evidence:** `app/api/projects/route.ts` exposes project records in `GET()` and creates projects in `POST()` without authentication. `app/api/projects/[id]/route.ts` exposes project/job/event records and changes status through `PATCH()` without authentication. `app/api/projects/[id]/construction/route.ts` can update project/job state and issue an upstream model-list request without authentication. `app/api/projects/reactivate/route.ts` can change offline project state without authentication.

**Impact:** Public callers may read workspace metadata, create excess records, mutate project state, or trigger repeated upstream checks. The current construction check does not submit a billable chat completion, but the unauthenticated write surface still creates abuse and availability risk.

**Recommended fix:** Add workspace authentication plus request limits for write operations, keep only deliberately public read fields available, and add route tests. Confirm the intended public/private experience before introducing the login flow.

**Status:** Open — related to the workspace access-boundary decision above.

### Medium — Campaign cron can claim the same day more than once

**Evidence:** The cron handler selected a planned/failed campaign day and previously updated it to `generating` without requiring its previous status to match. Overlapping invocations could both pass the selection and start work.

**Fix applied:** Commit `1bad703` makes the state transition conditional on the selected prior status and requires a returned row before creating the run. A competing invocation now skips with HTTP 409 instead of proceeding with duplicate work.

**Follow-up:** Add a database-backed concurrency test when the test database harness is available, and consider stale-`generating` recovery so interrupted runs can be resumed safely.

### Low — ESLint warning in the local pathfinding type declaration

**Evidence:** `npm run lint` reported one unused-declaration warning in `types/pathfinding.d.ts`.

**Fix applied:** Commit `5ce3227` expresses the finder as a constructor type and removes the unused class declaration. Re-run lint after this commit to verify the warning is gone.

### Medium — Dependency installation is not yet lockfile-reproducible

**Evidence:** `package.json` is tracked but no `package-lock.json` was present in the checked-out repository. A clean `npm install --no-audit --no-fund` resolved 363 packages. npm warned that the resolved ESLint 9.39.5 package is deprecated/unsupported and noted an install script for `unrs-resolver` that is not approved in the sandbox.

**Impact:** Installs can resolve different transitive versions over time, and the current ESLint package resolution produces maintenance warnings.

**Recommended fix:** Generate and commit a lockfile using the project's intended Node/npm versions, then use `npm ci` in CI. Review ESLint/Next compatibility and the deprecation notice before changing major versions. Do not approve third-party install scripts merely to silence a warning; confirm they are required and trusted first.

**Status:** Open — no major dependency upgrade was made during this sweep.

### Low — OmniRoute health reveals configuration metadata

**Evidence:** `GET /api/omniroute/health` returned HTTP 200 and reports the default upstream URL and which provider credentials are configured. It does not return secret values. Unauthenticated `POST /api/omniroute/v1/chat/completions` correctly returned HTTP 401.

**Impact:** Limited configuration disclosure; the credential-protected generation route itself rejected the unauthenticated test.

**Recommended fix:** Consider returning only coarse readiness publicly and expose provider-by-provider configuration details only to an authorized administrator. Preserve the health check needed for monitoring.

## Verified checks

| Check | Result |
|---|---|
| Clean dependency install | Passed |
| ESLint before declaration cleanup | Passed with 1 warning, 0 errors |
| Next.js production build | Passed |
| Production homepage | HTTP 200 |
| Production OmniRoute health | HTTP 200 |
| Unauthenticated OmniRoute chat request | HTTP 401, rejected |
| Unauthenticated company data request | HTTP 200 — finding recorded |
| Unauthenticated project list request | HTTP 200 — finding recorded |

## Deployment status and blocker

The latest production deployment visible during this audit points to commit `c17b29b`, not the latest `main` commit. A production deployment attempt was rejected by Vercel with HTTP 402 `payment_required` because the team exceeded the 100-deployments-per-day API limit. Vercel's response specified a 24-hour retry period.

No billing, SSO, or project security settings were changed to work around the limit. Reattempt deployment when the quota resets or the account restriction is resolved, then verify the exact deployed SHA and safe production smoke checks.

## Next actions

1. Resolve the workspace access boundary and implement the corresponding server-side authorization/session flow without leaving public mutation endpoints exposed.
2. Re-run lint/build after the two targeted fixes.
3. Add a reproducible package lock and switch CI from `npm install` to `npm ci` after validating the generated lockfile.
4. Add focused tests for workspace authorization and campaign concurrency.
5. Retry production deployment when Vercel permits it; do not report deployment success before the deployed SHA and smoke checks are verified.
