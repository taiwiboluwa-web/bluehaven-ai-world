# BlueHaven AI World

BlueHaven AI World is an interactive isometric village for creating and operating AI projects. The village UI is built with Next.js App Router, TypeScript, Three.js, and React Three Fiber. Projects, construction jobs, and audit events persist in Neon Postgres.

## Stack

- Next.js 15 App Router + TypeScript
- Three.js / React Three Fiber for the village viewport
- Neon Postgres through `@neondatabase/serverless`
- OpenAI-compatible model gateway (OpenRouter by default; compatible self-hosted gateways can be used)

## Required environment

Set these as server-side environment variables in Vercel or your local `.env.local`:

- `DATABASE_URL`: Neon Postgres connection string for the BlueHaven AI World database.
- `AI_GATEWAY_API_KEY`: API key for your chosen OpenAI-compatible model gateway.
- `AI_DEFAULT_MODEL`: model identifier available to that key.
- `AGENT_SERVICE_TOKEN`: long random server-only token required to call the agent execution API.
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

The current agent runner is a single-turn model adapter, not yet a sandboxed autonomous tool-execution system. Browser, shell, GitHub, and deployment tools must be added as separately permissioned adapters before production use. Authentication and per-user authorization must also be added before exposing this service to multiple users.

## Build verification

```bash
npm run build
npm run lint
```

Keep server secrets in deployment environment variables. Never commit API keys or database credentials.
