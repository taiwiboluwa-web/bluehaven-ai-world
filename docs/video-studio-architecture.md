# BlueHaven AI Video Studio — architecture and rollout

## Product boundary

BlueHaven AI World remains the control plane: projects, AI reasoning, agent orchestration, approvals, usage records and creator workflows. MoneyPrinterTurbo is a private media-production engine for script-to-video rendering. It is not a replacement for AI World and is not exposed directly to browsers.

The public BlueHaven Studios marketing website and SBCS remain separate systems and databases.

## Current implementation

- Next.js page: `/video-studio`.
- Health endpoint: `GET /api/video-studio/health`.
- Draft API: `GET|POST /api/video-studio/jobs`.
- Additive Neon schema: `db/video-studio-schema.sql`.
- Development schema has been applied to the isolated Neon branch `video-studio-dev`; production `main` database branch is unchanged.
- Git implementation branch: `feature/video-studio-foundation`.

The jobs API is server-to-server only and accepts the existing CHO or agent service bearer token. It validates the target project and creates a `draft` record. It does not call MoneyPrinterTurbo or spend provider credits.

## Data model

- `video_workspaces`: tenant/workspace boundary.
- `video_projects`: production projects and default output format.
- `video_brand_kits`: logo reference, brand colours, voice/subtitle/music preferences and rules.
- `video_jobs`: requested production work, idempotency key, engine task reference, progress and cost estimates.
- `video_assets`: private object-storage metadata for source and generated assets.
- `video_approvals`: human review decisions.
- `video_job_events`: append-only job activity.
- `video_usage_ledger`: reserved, settled, released and refunded usage.
- `video_provider_connections`: connection metadata and secret references, never raw credentials.
- `video_agent_runs`: agent execution records and tool-call audit data.

The initial workspace and BlueHaven brand kit are seeded with `#FFDE59`, `#7F56D6`, and the tagline “Creativity Beyond Limits”.

## Worker boundary

The future worker should be a separate Linux service running a pinned MoneyPrinterTurbo release, Python 3.11, FFmpeg and MoviePy. The Streamlit WebUI should not be publicly exposed. The FastAPI API should be reachable only over a private network or authenticated reverse proxy, with a non-empty API key.

Required server-side configuration in AI World:

- `VIDEO_ENGINE_ENABLED`
- `VIDEO_ENGINE_BASE_URL`
- `VIDEO_ENGINE_API_KEY`
- `VIDEO_ENGINE_TIMEOUT_MS`

Never add the worker key to a `NEXT_PUBLIC_*` variable, source code, client bundle, or Neon row. The worker API key is a service credential, not an end-user identity.

## Production job lifecycle

1. Validate workspace and project authorization.
2. Estimate provider/render cost and reserve credits.
3. Persist the BlueHaven job and idempotency key.
4. Submit to the private worker and persist the worker task ID.
5. Reconcile progress and errors; retries must not duplicate paid generation.
6. Transfer completed output to private object storage.
7. Create asset metadata and a short-lived signed preview/download URL.
8. Request human review.
9. Only publish an approved asset through a separately authenticated provider integration.

## Safety and deployment gates

- No direct browser-to-worker requests.
- No public worker WebUI.
- No arbitrary shell or filesystem tools for agents.
- No automatic publishing; human approval is required.
- No unbounded retries, concurrency or provider spend.
- No secrets in database metadata, logs, URLs or client-visible responses.
- Add real user/workspace authentication and per-user authorization before exposing the studio on a custom domain or to multiple users. Vercel SSO is not a substitute for application-level authorization.
- Keep production migrations separate from staging. Apply the schema to the isolated development branch first, run tests, and review a pull request before production migration.

## Rollout sequence

1. **Foundation** — schema, dashboard, health and draft API. (In progress.)
2. **Worker** — deploy the pinned private MoneyPrinterTurbo service and test 9:16, 16:9 and 1:1 output.
3. **Engine adapter** — authenticated submission, status reconciliation, cancellation and failure handling.
4. **Asset delivery** — private object storage, signed uploads/downloads and retention.
5. **Creation UX** — brief, script, scene, voice, subtitle, brand-kit and production-history tools.
6. **Agents and approvals** — permissioned tools, review gates, usage reservation and audit.
7. **Multi-user and publishing** — workspace auth, role permissions, billing/credits, OAuth channel connections and explicit approval before publication.

## Current non-goals

The first foundation does not claim that video generation is live, that social channels are connected, that unlimited generation is available, or that the app has completed multi-user authentication. These are explicit later milestones.
