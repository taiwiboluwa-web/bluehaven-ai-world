# BlueHaven Motion + Code Health Implementation Plan

**Date:** 2026-10-16  
**Repository:** `taiwiboluwa-web/bluehaven-ai-world`  
**Target branch:** `main` only  
**Status:** Awaiting user approval — implementation must not begin until approved

## Guardrails

- Work directly on `main`; do not create feature branches or duplicate repositories.
- Preserve the existing Next.js App Router, 3D village, Neon data, company/agent orchestration, social OAuth/publishing gates, and Vercel-native OmniRoute-compatible routes.
- Do not expose, copy into logs, or return secret values. Do not read or print decrypted environment-variable values.
- No paid provider generation, external posting, destructive DB changes, or schema reset without a separate explicit user action.
- Keep database changes additive, migration-backed, and reversible where practical.
- Separate GitHub CI success from Vercel deployment readiness and production health.

## Phase 0 — Baseline and deep repository sweep

1. Record the exact `main` commit, CI run results, latest Vercel production deployment commit, project settings, and deployment protection/quota state.
2. Inventory every tracked file and all routes, components, shared libraries, schema/migrations, CI workflows, environment-variable names, and external integrations.
3. Run or inspect the available checks: lint, TypeScript/build, production smoke test, route-level tests, and dependency/lockfile reproducibility. Do not call a check passed unless its result is observed.
4. Review the prior failing CI runs and identify which failures were corrected by later commits versus still-open failures.
5. Audit the highest-risk modules first:
   - OmniRoute adapter: authentication, allowed paths, upstream URL selection, timeouts, request/response size, streaming, model/provider validation, error redaction, and proxy-loop protection.
   - Agent/company APIs: token checks, body validation, UUID validation, concurrency, timeouts, database writes, and authorization boundaries.
   - Social connections: OAuth state/PKCE, callback validation, encrypted token storage, session cookies, token refresh, publish permission/approval gates, and provider response handling.
   - Cron/content-campaign endpoints: cron authentication, replay safety, bounded work, and duplicate execution.
   - Neon schema/access: indexes, foreign keys, query safety, transaction/idempotency needs, and additive migration strategy.
   - 3D world: visibility pausing, renderer/resource cleanup, mobile fallback, expensive state updates, and interaction/accessibility.
   - Vercel configuration: Node runtime, function limits, environment requirements, production/preview separation, deployment protection, and custom-domain aliasing.
6. Publish a findings report in-repo grouped as Critical/High/Medium/Low, with file/route evidence, impact, recommended fix, and test needed. Distinguish confirmed defects from risks requiring runtime credentials or production telemetry.

**Gate:** Do not start broad refactors. Fix confirmed Critical/High issues in isolated commits; document any blocker that requires user credentials or a provider dashboard.

## Phase 1 — Confirm video provider and deployment capabilities

1. Compare candidate video-generation providers using current official documentation for API access, pricing, supported countries, image-to-video, prompt-to-video, audio, async jobs/webhooks, output URL lifetime, and usage terms.
2. Select one provider for the first end-to-end path based on verified affordability, available credentials, capability fit, and operational reliability. Keep provider selection replaceable behind an adapter.
3. Confirm the durable media-storage option available to the existing Vercel project; do not rely on function-local disk for generated files.
4. Confirm the existing Neon schema and choose a migration format. Use a dedicated motion-project/job model only where existing tables cannot safely represent the workflow.
5. Define supported MVP capabilities and honest fallbacks. No fabricated prices, completed states, provider support, or “all styles supported” claims.

**Gate:** Record provider choice, verified pricing links, storage choice, required server-side environment-variable names, and any user action needed to enable paid generation before writing provider integration code.

## Phase 2 — Secure generation foundation

1. Add typed provider contracts for capability discovery, estimate, submit, status, cancellation (if supported), and output retrieval.
2. Validate and bound prompts, durations, aspect ratios, reference assets, user requests, concurrency, and retries on the server.
3. Add persistent job records and an additive migration if needed. Persist provider IDs, settings, status transitions, timestamps, error category, estimated/actual cost where available, and asset metadata.
4. Add idempotency so repeated submissions or retries cannot silently create duplicate paid jobs.
5. Add authenticated endpoints for create, list/history, status, retry/cancel where supported, and safe output retrieval.
6. Keep all provider/storage credentials server-only; redact provider errors and never log prompts or secret-bearing headers unnecessarily.
7. Add unit/route tests for invalid input, missing config, unauthorized calls, duplicate submission, timeout, provider failure, polling, and durable status.

**Gate:** A provider-backed short preview can be created, polled, persisted, and retrieved in a controlled test without exposing credentials or duplicating charges.

## Phase 3 — BlueHaven Motion workspace

1. Add a compact, responsive Motion workspace consistent with BlueHaven's yellow/purple brand and existing dark production UI.
2. Build the single-clip creator first: production category, prompt/script, reference image where supported, aspect ratio, duration, draft/final choice where supported, transparent cost disclosure, and generation progress.
3. Add persistent project history with truthful queued/running/succeeded/failed/cancelled states and understandable recovery actions.
4. Add script-to-scenes editing with per-scene prompt, duration, framing/camera and continuity notes; allow generating selected scenes individually.
5. Make all interactive states keyboard accessible, label controls, respect reduced-motion settings, and prevent mobile overflow.
6. Lazy-load heavy workspace-only modules so the home village does not pay their initial bundle cost.

**Gate:** Manual desktop/mobile acceptance and regression checks pass for existing home/village, project creation, agent/company routes, and connections.

## Phase 4 — Assembly and production features

1. Verify provider/tool capabilities before adding voice-over, music, captions, titles, transitions, and final assembly.
2. Use a provider renderer or suitable background worker if assembly exceeds Vercel Function duration/memory limits. Do not run long FFmpeg jobs inside a standard request handler without measured proof it fits.
3. Preserve scene source assets, ordering, settings, and final output references.
4. Add explicit confirmation before paid multi-scene runs or quality upgrades; do not auto-spend on retries.

**Gate:** A small multi-scene project renders to durable storage, remains available after reload, and accurately reports partial failures and cost.

## Phase 5 — Hardening, performance, and deployment

1. Resolve confirmed high-impact audit findings in small, testable changes.
2. Add/adjust tests and a reliable dependency lockfile only after verifying compatibility with Next.js 15, ESLint 9, Node 22/24, and the current install environment.
3. Run lint, production build, targeted API tests, and the production smoke test. Smoke tests must not publish content or trigger paid video generations.
4. Check the exact Git SHA associated with Vercel's production deployment. Inspect build/runtime logs and verify core pages and safe health endpoints.
5. Deploy from the existing linked repository and `main`; do not create another Vercel project or branch. If quota, SSO/protection, missing environment variables, or billing blocks deployment, report the exact blocker rather than claiming success.
6. Verify post-deploy: homepage, health endpoint, unauthenticated rejection, key API availability, and browser/mobile layout. Test authenticated provider generation only with configured credentials and explicit user authorization.

## Definition of done

- Existing core routes and workflows still function.
- Lint/build and relevant tests pass, or pre-existing blockers are evidenced and isolated.
- Confirmed Critical/High audit findings are fixed or explicitly blocked with owner/action noted.
- Motion jobs are durable and idempotent; generated media uses durable storage.
- No secret leakage, false success states, or automatic paid retries.
- Production deployment points to the intended `main` commit and safe smoke checks pass.
- A concise completion report links the audit findings, migrations, CI run, deployment, and remaining limitations.

## First implementation slice after approval

1. Complete Phase 0 and publish the findings report.
2. Resolve only confirmed Critical/High issues that are safe to fix without extra credentials.
3. Select and verify the first video provider and media storage.
4. Implement the smallest complete vertical slice: create one short clip → persist job → retrieve status → store/retrieve output.
5. Expand the workspace only after that vertical slice passes tests and deployment checks.
