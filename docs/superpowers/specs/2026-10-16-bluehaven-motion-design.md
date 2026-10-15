# BlueHaven Motion + Code Health Design

**Date:** 2026-10-16  
**Repository:** `taiwiboluwa-web/bluehaven-ai-world`  
**Target branch:** `main` only  
**Status:** Design approved by the user; written specification awaiting review

## 1. Goals

Add an affordable AI animation and video-production workspace to the existing BlueHaven AI World application while auditing and improving the existing application for performance, reliability, security, and Vercel deployment compatibility.

The work must preserve existing routes, the 3D village, company/agent orchestration, Neon persistence, social-connection workflows, and the existing Vercel-native OmniRoute-compatible adapter unless a specific defect requires a small, documented change.

## 2. User workflows

### Create a clip
- Enter a prompt or script and optionally provide a reference image.
- Choose a production type: 3D cartoon/story, nursery rhyme or children's song, anime/cinematic animation, explainer/motion graphics, brand advert, or realistic AI scene.
- Choose aspect ratio, duration, visual style, and draft/final quality where the provider supports them.
- Show a clear cost/credit estimate or explain why a reliable estimate is unavailable before submitting paid work.
- Create an asynchronous job, show its status, and let the user retry or cancel when supported.

### Produce a complete video
- Turn a script or idea into editable scenes with prompts, duration, framing/camera notes, and continuity notes.
- Generate scenes individually, then assemble selected clips into a sequence.
- Support voice-over, music, captions, titles, and transitions only through providers or rendering tools that are verified to support the chosen capability.
- Export a final render and retain a project history with source clips and settings.

### Manage projects
- Save drafts and generation history in persistent storage.
- Distinguish queued, running, succeeded, failed, and cancelled jobs.
- Make provider limitations, moderation failures, timeouts, and retry behavior understandable.
- Do not show a fake completed state when only a request was accepted.

## 3. UX and visual direction

- Product name: **BlueHaven Motion — AI Animation Studio**.
- Keep the existing BlueHaven yellow/purple identity, with a restrained dark production workspace and compact controls.
- Present clear entry points for stories, rhymes, anime/cinema, explainers, and ads.
- Use a scene timeline/storyboard for multi-clip projects and a focused single-clip creator for quick generation.
- Avoid heavy decorative effects that worsen load time or compete with the current 3D village.
- Provide responsive desktop/mobile layouts, accessible labels, keyboard focus, and reduced-motion behavior.

## 4. Proposed architecture

1. **Next.js UI:** add a Motion workspace within the existing App Router; reuse current application patterns and shared components where sensible.
2. **Server-side API:** validate input, authorize the request, enforce limits, estimate cost where possible, create a durable job record, and call provider adapters. Keep provider credentials exclusively on the server.
3. **Provider adapter layer:** define a stable internal interface for capability discovery, cost estimation, job submission, status retrieval, cancellation, and output retrieval. Start with one verified, affordable provider integration rather than pretending every provider is interchangeable.
4. **Durable jobs:** persist jobs, provider job IDs, status, settings, errors, and timestamps in Neon. Use provider webhooks if supported and secured; otherwise use bounded polling/status endpoints. Design retries to avoid duplicate paid generations.
5. **Asset persistence:** store final media in a durable object/media store supported by the deployment setup. Do not rely on a Vercel Function's local filesystem for durable output. Store references and metadata in Neon.
6. **Assembly:** decide between a provider's own editing/render API and an external rendering service after confirming duration limits, memory, codecs, storage, and Vercel execution constraints. Do not assume FFmpeg or long renders are safe inside a standard function.
7. **ChatGPT access:** treat ChatGPT and the website as separate clients. A shared project library requires an authenticated API, user authorization, and an explicit integration mechanism; it does not happen automatically just because both interfaces use AI.

## 5. Cost and reliability controls

- Prefer low-cost draft generation, short preview clips, and user-controlled final-quality upgrades where supported.
- Display provider pricing and estimated cost with a timestamp/source; avoid invented estimates.
- Set request size, duration, concurrency, and per-user limits.
- Add timeouts, idempotency, bounded retries, and clear failure states.
- Keep provider keys, session secrets, database URLs, and service tokens out of client bundles and logs.
- Never automatically spend money on retries or multi-scene generation without a clear user action and an appropriate cost disclosure.

## 6. Repository health audit

Perform a broad, evidence-based audit before implementation and as part of verification. Inspect source and configuration across:

- App Router pages/layouts, client/server component boundaries, loading and error states.
- Three.js/React Three Fiber rendering, resource cleanup, visibility pausing, asset weight, and mobile fallback.
- API authentication/authorization, input validation, response consistency, rate limiting, and error redaction.
- Neon query patterns, schema/migrations, indexes, connection handling, and data integrity.
- Agent orchestration concurrency, timeouts, model gateway handling, retries, and audit events.
- Social OAuth/session/publishing routes and the distinction between configured credentials and verified account access.
- OmniRoute adapter auth, upstream URL validation, streaming behavior, payload limits, and proxy-loop prevention.
- Accessibility, responsive layout, dependencies, environment-variable documentation, lint/build checks, smoke tests, and deployment configuration.

Prioritize proven high-impact defects over cosmetic refactors. Do not replace the app, reset the database, rewrite the architecture, create extra branches, or change unrelated behavior merely to make the code look different.

## 7. Performance and quality acceptance criteria

- The production build and lint/type checks pass, or any pre-existing blocker is clearly isolated and documented.
- Main-page and key-workflow performance is measured rather than guessed; heavy 3D work should not keep consuming resources when not visible.
- No persistent media depends on ephemeral function disk.
- API failures do not leak secrets or report false success.
- A paid generation cannot be silently duplicated by a retry.
- Job state survives page reloads and serverless instance changes.
- A generated clip can be retrieved from persistent storage after completion.
- Mobile users can create and monitor a job without layout overflow.
- Existing core routes and workflows remain functional.
- Production deployment status is checked separately from GitHub CI. A successful GitHub build is not proof that Vercel deployed the same commit.

## 8. Implementation stages

1. **Baseline and inventory:** inspect the repository tree and important modules, review CI history, run checks where execution is available, classify findings by severity, and record the current production/deployment constraints.
2. **Technical specification:** confirm provider capabilities, pricing, persistence, rendering approach, job model, security boundaries, and route/UI integration before implementation.
3. **Foundation:** add the provider contract, durable job model/migration if required, secure job APIs, cost/limits policy, and a minimal verified end-to-end clip workflow.
4. **Workspace:** add the single-clip creator, project history, storyboard/scene editing, progress/error states, and responsive UI.
5. **Production pipeline:** add supported voice/music/captions/transitions and final assembly after validating the execution environment and storage approach.
6. **Hardening:** address the audit's confirmed high-severity and high-impact issues in focused changes; add regression tests and improve observability.
7. **Verification:** run lint, production build, smoke tests, and targeted route/job tests; inspect CI; test deployed endpoints and UI where access allows; report any deployment quota or secret configuration that blocks production.

## 9. Risks and decisions that require evidence

- Provider pricing, regional availability, audio generation, character consistency, and reference-image support vary by provider and model.
- Some providers expose asynchronous jobs and webhooks; others require polling or have restrictive output URLs.
- Full-video assembly may require a separate worker/rendering service if it exceeds Vercel's function limits. The architecture must remain compatible with Vercel but should not force long-running media rendering into an unsuitable function.
- The app's current CI has a recent successful run on the current `main` head and a preceding failed run; the failed run must be inspected before calling the pipeline healthy.
- Deployment may be blocked by account quota or environment configuration even when CI passes.

## 10. Out of scope for the first release

- Claiming to train custom foundation video models.
- Automatic public posting of generated videos without explicit user approval.
- Unlimited free generations or guaranteed zero-cost generation.
- A full replacement of the existing 3D village or AI company system.
- A claim that every desired animation style or audio feature is supported before provider verification.

## 11. Review gate

This document records the approved product direction. The next step is to review this written specification and correct any architecture/product assumptions. After the specification is approved, create an implementation plan for review. Do not start broad code changes until that plan is approved.
