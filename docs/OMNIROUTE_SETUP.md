# OmniRoute connection for BlueHaven AI World

BlueHaven AI World runs on Vercel. OmniRoute is a separate gateway service; do not try to run its long-lived server inside a Vercel request handler.

## Configure the gateway

1. Deploy OmniRoute on a persistent service you control (for example, a VPS or a container host) and enable HTTPS.
2. In OmniRoute's remote-access/security settings, enable the authentication method you intend to use. Do not expose an unauthenticated gateway to the public internet if it can route requests through your provider accounts.
3. In the Vercel project environment variables for **Production** (and Preview only if needed), set:
   - `OMNIROUTE_BASE_URL`: the public origin, such as `https://omniroute.example.com`. The integration accepts either the origin or an origin ending in `/v1`.
   - `OMNIROUTE_DEFAULT_MODEL`: an exact model ID returned by that instance's `/v1/models` endpoint.
   - `OMNIROUTE_API_KEY`: optional only if the gateway is intentionally configured to accept requests without a bearer token; otherwise set the credential/token required by your OmniRoute deployment.
4. Save the variables and redeploy the Vercel project.
5. Open `https://bluehaven-ai-world.vercel.app/api/omniroute/health`. A successful response has `"ok": true`, `"gateway": "omniroute"`, and `"modelAvailable": true`.
6. Create a test project in BlueHaven AI World. Its construction check validates the gateway and configured model through `/v1/models` before marking the project active.

The existing `AI_GATEWAY_BASE_URL`, `AI_GATEWAY_API_KEY`/ `OPENROUTER_API_KEY`, and `AI_DEFAULT_MODEL` configuration remains available as a fallback when `OMNIROUTE_BASE_URL` is not configured.

## Safety and limits

- Never commit gateway credentials or put them in browser-visible variables such as `NEXT_PUBLIC_*`.
- Do not expose the OmniRoute service publicly without its own authentication/rate limits and provider-terms review.
- The health endpoint checks connectivity and model discovery; it does not prove a billable chat completion, all provider integrations, or unattended campaign publishing.
- OmniRoute's free-tier/provider catalog and routing behavior can change. Review each upstream provider's terms before using it in production.
- This connection is not a copy or fork of OmniRoute. BlueHaven calls the running service over HTTPS.
