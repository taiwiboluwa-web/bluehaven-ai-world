# BlueHaven AI World

BlueHaven AI World turns AI project operations into a living, isometric village. The visual language takes inspiration from strategy-game village builders (including the general village-building pattern of Clash of Clans), while the product, names, systems, and workflow are designed for BlueHaven's AI workspace.

## Product direction

- **BlueHaven HQ:** executive overview and company operations.
- **Builder Hut:** project creation, plot assignment, construction feedback, and gateway validation.
- **Knowledge Archive:** a home for document-grounded agents and future knowledge-base workflows.
- **AI Infrastructure:** Neon-backed persistence and an OpenAI-compatible model gateway.
- **Village map:** a 3D overview with project buildings, moving builder units, orbit controls, and visible operational states.

The village is a product interface, not a claim that a project is running just because an animation finished. Project creation is persisted through the API, and activation is gated by server-side gateway/model checks. Keep animation feedback separate from backend truth. The HQ and district landmarks are selectable; the Builder Hut opens the existing project workflow, while the Knowledge Archive clearly identifies document upload/indexing as not yet connected.


BlueHaven AI World is an interactive isometric village for creating and operating AI projects. The village UI is built with Next.js App Router, TypeScript, Three.js, and React Three Fiber. Projects, construction jobs, and audit events persist in Neon Postgres.

## Stack

- Next.js 15 App Router + TypeScript
- Three.js / React Three Fiber for the village viewport
- `pathfinding` A* routing for builder units around occupied plot coordinates
- Zustand for shared selected-district state between the map and district controls
- Neon Postgres through `@neondatabase/serverless`
- OpenAI-compatible model gateway (OpenRouter by default; compatible self-hosted gateways can be used)

## Required environment

Set these as server-side environment variables in Vercel or your local `.env.local`:

- `DATABASE_URL`: Neon Postgres connection string for the BlueHaven AI World database.
- `AI_GATEWAY_API_KEY`: API key for your chosen OpenAI-compatible model gateway.
- `AI_DEFAULT_MODEL`: model identifier available to that key.
- `AGENT_SERVICE_TOKEN`: long random server-only token required for agent execution and task/hiring requests.
- `MATTHEW_SERVICE_TOKEN`: separate server-only token for Matthew's hiring review actions.
- `CHO_ADMIN_TOKEN`: separate server-only token for CHO task creation and final hiring decisions.
- `CRON_SECRET`: server-only token used to authorize the scheduled daily brief job.
- `AI_GATEWAY_BASE_URL`: gateway endpoint; defaults to `https://openrouter.ai/api/v1`.

For OpenRouter, use a model ID available to your account. Never prefix secrets with `NEXT_PUBLIC_`, commit them to Git, or expose them in client code. `.env.example` contains names only.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add the required values to `.env.local` before creating projects. The schema is already provisioned in the connected Neon database. To set up another database, run `psql "$DATABASE_URL" -f db/schema.sql` after setting the connection string.

## Current backend behavior

- `GET /api/projects`: loads saved projects from Neon.
- `POST /api/projects`: validates a project, allocates a currently free plot, and persists the project, queued job, and event.
- `GET /api/projects/:id`: returns project details, recent jobs, and events.
- `PATCH /api/projects/:id`: pauses, resumes, or stops a project.
- `POST /api/projects/:id/construction`: verifies gateway authentication and model availability without consuming inference tokens before marking a building operational; otherwise it records a clear failure state.
- `POST /api/agents/run`: sends a prompt to the configured OpenAI-compatible chat-completions endpoint and records the outcome. Requires `Authorization: Bearer <AGENT_SERVICE_TOKEN>` and is not exposed as an unauthenticated browser action.

- `GET /api/company`: loads the executive hierarchy, ten department heads, workers, task ledger, hiring queue, CHO notifications, connector status, and daily brief archive.
- `POST /api/company`: authenticated task creation/completion and a two-stage hiring workflow. Agents request staff; Matthew reviews; only CHO approval creates an active worker. Matthew rejections generate a CHO notification.
- `GET /api/company/brief`: generates and saves the full-day company brief for Africa/Lagos time. Vercel Cron is scheduled for 22:59 UTC (23:59 in Lagos); configure `CRON_SECRET` in Vercel for the scheduled request.

The current agent runner is a single-turn model adapter, not yet a sandboxed autonomous tool-execution system. Browser, shell, GitHub, and deployment tools must be added as separately permissioned adapters before production use. Authentication and per-user authorization must also be added before exposing this service to multiple users.

## Company operating model

The initial roster is CHO (human executive), Matthew (Chief of Staff), and ten AI department heads: Nova, Sage, Echo, Pixel, Forge, Scout, Atlas, Piper, Quinn, and Orbit. They share a connector identifier (`universal`) and use the centrally configured default model unless a department-specific model is configured. Connector identity is shared; provider access, pricing, and model availability still depend on the configured gateway.

Workers are never auto-created from a request. A request enters `pending_matthew`; Matthew can forward it to `pending_cho` or reject it. Both outcomes notify CHO. Only a CHO-approved decision creates the worker record. Keep `AGENT_SERVICE_TOKEN`, `MATTHEW_SERVICE_TOKEN`, `CHO_ADMIN_TOKEN`, and `CRON_SECRET` as distinct random secrets in Vercel environment variables. The company dashboard at `/company` keeps the CHO token in page memory only; it is not persisted in browser storage.

## Build verification

```bash
npm run build
npm run lint
```

Keep server secrets in deployment environment variables. Never commit API keys or database credentials.
