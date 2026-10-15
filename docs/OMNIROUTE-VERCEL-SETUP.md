# BlueHaven AI World — OmniRoute on Vercel

## Deployment shape

OmniRoute is exposed through the existing Next.js app as Vercel Functions. This is a Vercel-native OpenAI-compatible adapter, not the full upstream OmniRoute server/management UI. Keep this deployment serverless; do not add Railway or a separate always-on container just to proxy API calls.

Existing health endpoint:
- `/api/omniroute/health`

API adapter endpoints:
- `GET /api/omniroute/v1/models?provider=<provider>`
- `POST /api/omniroute/v1/chat/completions?provider=<provider>`
- `POST /api/omniroute/v1/responses`
- `POST /api/omniroute/v1/embeddings`
- `POST /api/omniroute/v1/images/generations`
- `POST /api/omniroute/v1/audio/transcriptions`
- `POST /api/omniroute/v1/audio/speech`

The `provider` query parameter (or `x-ai-provider` header) selects a provider. If omitted, the request uses OpenRouter, preserving the existing default behavior. Use one of: `openrouter`, `openai`, `gemini`, `anthropic`, `deepseek`, `groq`, `mistral`. Incoming requests still require `Authorization: Bearer <OMNIROUTE_API_KEY or AGENT_SERVICE_TOKEN>`.

## Connect AI providers in Vercel

Open the [BlueHaven AI World environment settings](https://vercel.com/taiwiboluwa-3003s-projects/bluehaven-ai-world/settings/environment-variables). Add only credentials for providers you want to enable, select Production (and Preview/Development only when needed), save, and redeploy. Do not place any of these in `NEXT_PUBLIC_*` variables or commit them to GitHub.

| Provider | Required environment variable | Default model |
| --- | --- | --- |
| OpenRouter (unified) | `OMNIROUTE_UPSTREAM_API_KEY` (or `AI_GATEWAY_API_KEY` / `OPENROUTER_API_KEY`) | `AI_DEFAULT_MODEL` or `openai/gpt-4o-mini` |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_DEFAULT_MODEL` or `gpt-4o-mini` |
| Google Gemini | `GOOGLE_GEMINI_API_KEY` (or `GEMINI_API_KEY`) | `GEMINI_DEFAULT_MODEL` or `gemini-2.5-flash` |
| Anthropic Claude | `ANTHROPIC_API_KEY` | `ANTHROPIC_DEFAULT_MODEL` or `claude-sonnet-4-5` |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_DEFAULT_MODEL` or `deepseek-chat` |
| Groq | `GROQ_API_KEY` | `GROQ_DEFAULT_MODEL` or `llama-3.3-70b-versatile` |
| Mistral | `MISTRAL_API_KEY` | `MISTRAL_DEFAULT_MODEL` or `mistral-small-latest` |

Optional base URL overrides are `OPENAI_BASE_URL`, `GOOGLE_GEMINI_BASE_URL`, `ANTHROPIC_BASE_URL`, `DEEPSEEK_BASE_URL`, `GROQ_BASE_URL`, and `MISTRAL_BASE_URL`. Keep these on trusted HTTPS endpoints.

## Make a provider-specific request

Example using OpenAI-compatible clients or a server-side request:

```bash
curl "https://bluehaven-ai-world.vercel.app/api/omniroute/v1/chat/completions?provider=deepseek" \
  -H "Authorization: Bearer $OMNIROUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Say hello from BlueHaven."}]}'
```

The gateway returns a clear `503` if a selected provider key is missing, and forwards provider errors when a key is present but invalid, out of credit, or not allowed to access the requested model. A configured flag in health only confirms a credential exists; it does not verify billing, model access, or successful inference.

Check `/api/omniroute/health` for a credential-presence overview. It does not reveal keys. Provider selection is supported by the gateway API; client-side applications must call it through a trusted server or use an appropriately secured backend so that gateway credentials are never shipped to browsers.

## Claude compatibility

Direct Claude mode translates non-streaming `chat/completions` requests into Anthropic Messages API requests and normalizes text responses to an OpenAI-style completion response. Direct Claude streaming and other endpoint families are not currently implemented; use OpenRouter for those requests. Tool-call, image-input, and provider-specific response semantics should be separately validated before depending on them.

## CHO admin token setup

The connections session handler expects the Vercel environment variable `CHO_ADMIN_TOKEN`. The value is a secret you create; it is not issued by GitHub, Vercel, or OmniRoute.

Generate a strong token locally in PowerShell (Node.js required):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Copy the output directly into Vercel:
1. Open the [bluehaven-ai-world project settings](https://vercel.com/taiwiboluwa-3003s-projects/bluehaven-ai-world/settings/environment-variables).
2. Add `CHO_ADMIN_TOKEN` with the generated value for **Production** (and Preview only if you need it there).
3. Save the variable, then redeploy so the new deployment receives it.
4. Open `/connections` and sign in with that token.

Never commit the token, paste it into a public issue, or place it in a `NEXT_PUBLIC_*` variable. If it leaks, generate a new one and replace the Vercel variable, then redeploy. The current session cookie expires after eight hours.

## Existing gateway authentication

Set:
- `OMNIROUTE_API_KEY` or `AGENT_SERVICE_TOKEN` — incoming adapter authentication
- One or more upstream provider credentials from the table above
- `OMNIROUTE_UPSTREAM_BASE_URL` or `AI_GATEWAY_BASE_URL` — optional OpenRouter-compatible base URL

Use Vercel Project → Settings → Environment Variables. Values apply to new deployments; redeploy after changing them.

## Safety and compatibility notes

- Do not expose upstream API keys to browser code.
- Keep OAuth provider client secrets server-side.
- Vercel Functions are request/response serverless functions; they are not a persistent daemon and do not provide a WebSocket server. Keep long-lived processes, local model weights, and persistent workers out of this deployment. See [Vercel Functions runtimes](https://vercel.com/docs/functions/runtimes) and [limits](https://vercel.com/docs/functions/limitations).
- A model list or health check alone is not an end-to-end generation test.
