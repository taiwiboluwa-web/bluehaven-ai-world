# BlueHaven AI World — OmniRoute on Vercel

## Deployment shape

OmniRoute is being exposed through the existing Next.js app as Vercel Functions. This is a Vercel-native OpenAI-compatible adapter, not the full upstream OmniRoute server/management UI. Keep this deployment serverless; do not add Railway or a separate always-on container just to proxy API calls.

Existing health endpoint:
- `/api/omniroute/health`

API adapter endpoints advertised by health:
- `GET /api/omniroute/v1/models`
- `POST /api/omniroute/v1/chat/completions`
- `POST /api/omniroute/v1/responses`
- `POST /api/omniroute/v1/embeddings`
- `POST /api/omniroute/v1/images/generations`
- `POST /api/omniroute/v1/audio/transcriptions`
- `POST /api/omniroute/v1/audio/speech`

The health response reports configuration/status; it does not prove that every advertised endpoint can complete a real upstream request. Test each route with a valid key before relying on it.

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

## Required environment variables

Set only the ones that match the features you intend to use. Names currently referenced by the health route include:
- `OMNIROUTE_API_KEY` or `AGENT_SERVICE_TOKEN` — API adapter authentication
- `OMNIROUTE_UPSTREAM_API_KEY`, `AI_GATEWAY_API_KEY`, or `OPENROUTER_API_KEY` — upstream model-provider credential
- `OMNIROUTE_UPSTREAM_BASE_URL` or `AI_GATEWAY_BASE_URL` — optional upstream base URL

Use Vercel Project → Settings → Environment Variables. Values apply to new deployments; redeploy after changing them.

## Safety and compatibility notes

- Do not expose upstream API keys to browser code.
- Keep OAuth provider client secrets server-side.
- Vercel Functions are request/response serverless functions; they are not a persistent daemon and do not provide a WebSocket server. Keep long-lived processes, local model weights, and persistent workers out of this deployment. See [Vercel Functions runtimes](https://vercel.com/docs/functions/runtimes) and [limits](https://vercel.com/docs/functions/limitations).
- A model list or health check alone is not an end-to-end generation test.
