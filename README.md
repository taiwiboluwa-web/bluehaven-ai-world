# BlueHaven AI World

BlueHaven AI World turns AI project operations into a living, isometric village. The visual language takes inspiration from strategy-game village builders, while the product, names, systems, and workflow are designed for BlueHaven's AI workspace.

## Product direction

- **BlueHaven HQ:** executive overview and company operations.
- **Builder Hut:** project creation, plot assignment, construction feedback, and gateway validation.
- **Knowledge Archive:** a home for document-grounded agents and future knowledge-base workflows.
- **AI Infrastructure:** Neon-backed persistence and an OpenAI-compatible model gateway.
- **Village map:** a 3D overview with project buildings, moving builder units, orbit controls, and visible operational states.

The village UI is not a claim that a project is running just because an animation finished. Project creation is persisted through the API, and activation is gated by server-side gateway/model checks. Projects, construction jobs, and audit events persist in Neon Postgres.

## Stack

- Next.js 15 App Router + TypeScript
- Three.js / React Three Fiber
- Neon Postgres through `@neondatabase/serverless`
- OpenAI-compatible model gateway (OpenRouter by default)

## Vercel-native OmniRoute-compatible adapter

The repository includes a Vercel Functions adapter at `/api/omniroute/v1/*`. It forwards supported OpenAI-compatible requests to a configured upstream provider while keeping provider credentials server-side. The BlueHaven agent runner can use it when `OMNIROUTE_VERCEL_NATIVE=true`.

This is a **Vercel-compatible adapter, not the full upstream OmniRoute server**. It does not bundle OmniRoute's SQLite-backed management dashboard, provider catalog, key management, or all advanced routing/agent features. The upstream project expects persistent server data; Vercel Functions have a read-only filesystem except for temporary `/tmp` storage and bounded request durations. See [Vercel Function limits](https://vercel.com/docs/functions/limitations) and the [upstream OmniRoute API reference](https://github.com/diegosouzapw/OmniRoute/wiki/API-Reference).

### Adapter endpoints

- `GET /api/omniroute/health` — reports readiness without exposing credentials.
- `GET /api/omniroute/v1/models`
- `POST /api/omniroute/v1/chat/completions`
- `POST /api/omniroute/v1/responses`
- `POST /api/omniroute/v1/embeddings`
- `POST /api/omniroute/v1/images/generations`
- `POST /api/omniroute/v1/audio/transcriptions`
- `POST /api/omniroute/v1/audio/speech`

Incoming requests require `OMNIROUTE_API_KEY` or `AGENT_SERVICE_TOKEN`. Upstream requests use `OMNIROUTE_UPSTREAM_API_KEY`, `AI_GATEWAY_API_KEY`, or `OPENROUTER_API_KEY`. The upstream base URL defaults to `https://openrouter.ai/api/v1`; use HTTPS in production.

### Enable it on Vercel

1. Keep the existing production project and `main` branch; no extra branch is needed.
2. In Vercel Project Settings → Environment Variables, set `OMNIROUTE_VERCEL_NATIVE=true`.
3. Ensure `AGENT_SERVICE_TOKEN`, `AI_DEFAULT_MODEL`, and an upstream provider key are configured.
4. Optionally set `OMNIROUTE_UPSTREAM_BASE_URL` to another OpenAI-compatible gateway.
5. Deploy the latest `main` commit and test `/api/omniroute/health` and an authenticated model request.

Do not set `AI_GATEWAY_BASE_URL` to this app's own `/api/omniroute/v1` URL; that can cause a proxy loop. The agent runner selects the local adapter when `OMNIROUTE_VERCEL_NATIVE=true`.

## Required environment

Set these server-side environment variables in Vercel or local `.env.local`:

- `DATABASE_URL`: Neon Postgres connection string.
- `AI_GATEWAY_API_KEY`: upstream model gateway key.
- `AI_DEFAULT_MODEL`: model identifier available to that key.
- `AGENT_SERVICE_TOKEN`: server-only token for agent execution and task/hiring requests.
- `MATTHEW_SERVICE_TOKEN`, `CHO_ADMIN_TOKEN`: separate governance tokens.
- `CRON_SECRET`: token authorizing scheduled jobs.
- `AI_GATEWAY_BASE_URL`: upstream endpoint; defaults to `https://openrouter.ai/api/v1`.

Never prefix secrets with `NEXT_PUBLIC_` or commit them to Git.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

The schema is already provisioned in the connected Neon database. To set up another database, run `psql "$DATABASE_URL" -f db/schema.sql`.

## Current backend behavior

- `GET /api/projects`: loads saved projects from Neon.
- `POST /api/projects`: validates a project, allocates a free plot, and persists the project, queued job, and event.
- `GET /api/projects/:id`: returns project details, recent jobs, and events.
- `PATCH /api/projects/:id`: pauses, resumes, or stops a project.
- `POST /api/projects/:id/construction`: verifies gateway authentication and model availability before marking a building operational.
- `POST /api/agents/run`: sends a prompt to the configured OpenAI-compatible endpoint and records the outcome. Requires `Authorization: Bearer <AGENT_SERVICE_TOKEN>`.

- `GET /api/company`: loads the executive hierarchy, department heads, workers, task ledger, hiring queue, notifications, and daily brief archive.
- `POST /api/company`: authenticated task creation/completion and two-stage hiring workflow.
- `GET /api/company/brief`: saves the company brief for Africa/Lagos time. Vercel Cron is scheduled for 22:59 UTC; configure `CRON_SECRET`.

The current agent runner is a single-turn model adapter, not yet a sandboxed autonomous tool-execution system. Browser, shell, GitHub, and deployment tools must be added as separately permissioned adapters before production use. Add authentication and per-user authorization before exposing this service to multiple users.

## Company operating model

The initial roster is CHO (human executive), Matthew (Chief of Staff), and ten AI department heads: Nova, Sage, Echo, Pixel, Forge, Scout, Atlas, Piper, Quinn, and Orbit. Only a CHO-approved hiring decision creates an active worker record. Keep service and governance tokens separate.

## Creator Command Center

- `/creator-command-center` keeps the registered department agents available on standby and lets Atlas route a prompt to the best-fit specialists automatically.
- `POST /api/company/orchestrate` supports `dispatchMode: "auto"`. If `agentNames` are supplied without a mode, the existing manual 2–4-agent selection remains compatible.
- Automatic dispatch records the selected specialists and remaining standby roster in the mission response and audit payload. It falls back to a small keyword router if the model router returns invalid JSON.
- `GET /api/creator/status` reports only whether expected provider credential names are present; it never returns secret values and does not equate credentials with a connected account.
- `/api/creator/content` provides an authenticated, persistent draft queue in Neon. Draft creation is audit-logged. Publishing is intentionally disabled until provider-specific OAuth, token refresh, permission checks, delivery verification, and CHO approval gates are implemented and tested.
- Social credential names currently checked: Meta (`META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`), X (`X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_ACCESS_TOKEN`), TikTok (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN`), LinkedIn (`LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`), YouTube (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`), and Pinterest (`PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `PINTEREST_ACCESS_TOKEN`). These are readiness indicators, not completed OAuth integrations.

## Build verification

```bash
npm run build
npm run lint
```

Keep server secrets in deployment environment variables. Never commit API keys or database credentials.
