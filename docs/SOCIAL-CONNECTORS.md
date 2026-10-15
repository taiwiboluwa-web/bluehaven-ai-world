# Social and Publishing Connections — BlueHaven AI World

## Product goal

BlueHaven AI World should own its publishing workflow at `https://bluehaven-ai-world.vercel.app/`. The user should connect each account once from a first-party **Connections** screen, then manage drafts, approvals, schedules, publishing receipts, retries, and analytics inside BlueHaven AI World. Metricool is optional and must not be a required runtime dependency.

A direct integration still requires a one-time authorization on the platform's official login/consent page. Do not ask for or store a user's social password, scrape private browser sessions, bypass CAPTCHA, or use undocumented private endpoints. Store refresh/access tokens server-side, encrypted at rest, and request only necessary scopes.

## Channel capability map

| Channel | Direct integration approach | Important constraint |
|---|---|---|
| Instagram / Facebook | Meta Graph API + OAuth; professional Instagram account and linked Facebook Page as required by Meta | App permissions, review and media requirements apply. Validate each account type and publishing capability. |
| X | Official X API OAuth 2.0 user authorization | API access level, pricing/limits and scopes must be confirmed in the X developer project. |
| TikTok | TikTok Content Posting API OAuth | Direct Post product/scope approval may be required; unaudited apps can be restricted to private visibility. |
| Pinterest | Pinterest API OAuth | Request only required board/pin scopes and respect media requirements. |
| YouTube | YouTube Data API OAuth | Upload quota and API verification/audit rules may apply. |
| LinkedIn | LinkedIn OAuth and approved sharing APIs | Access to organization/page publishing can require additional product approval. |
| Blogger | Google OAuth + Blogger API v3 | Use the current API version; do not build on discontinued Blogger API v2. |
| WordPress.com | WordPress.com OAuth 2.0 + REST API | Site-specific capabilities vary by plan and site type. |
| Tumblr | Tumblr API OAuth | Verify current post types, media limits, and API terms during implementation. |
| Medium | Do not promise a new direct API connection | Medium's official help states it is not issuing new integration tokens or allowing new integrations. Offer a prepared export/copy workflow or link importer instead; only support legacy API access if the owner already has a valid token. |
| Substack | Do not use undocumented/private publishing endpoints | The public API terms describe public profile/publication data access, not a general public post-publishing API. Prepare a newsletter draft/export and provide an official handoff until a supported publishing API is available. |
| BlueHaven website | First-party API + existing Neon content system | Preferred canonical home for full articles; publish once here, then adapt/cross-post where authorized. |
| Amazon | Amazon Associates / Creators API for eligible product discovery and affiliate links; Amazon Ads APIs only if separately approved | Amazon is not a general social-post destination. Do not promise article publishing through Amazon APIs. Disclose affiliate links and follow marketplace rules. |

Official starting points:
- Blogger API: https://developers.google.com/blogger/docs/3.0/using
- WordPress.com REST API: https://developer.wordpress.com/docs/api/
- TikTok Content Posting API: https://developers.tiktok.com/products/content-posting-api/
- Medium API/importing notice: https://help.medium.com/hc/en-us/articles/213480228-API-Importing
- Substack API terms: https://substack.com/api-tos
- Amazon Creators API: https://affiliate-program.amazon.com/creatorsapi/docs/

## First-party connection flow

1. The Connections screen lists every provider as `not_configured`, `needs_authorization`, `connected`, `limited`, or `error`. Never infer a working connection from a configured client ID alone.
2. The user chooses **Connect** and is redirected to the provider's official OAuth consent page.
3. The callback validates a cryptographically random, short-lived, single-use `state` value and PKCE where supported.
4. Exchange the authorization code on the server. Never expose client secrets or tokens to browser code.
5. Encrypt refresh/access tokens with a dedicated server-side encryption key before storing them. Never write tokens to logs, client responses, source control, or analytics.
6. Store granted scopes, provider account ID, expiry, last successful check, and provider capability flags.
7. Provide **Test connection**, **Disconnect**, and **Reauthorize** actions. Disconnect must revoke tokens when the provider supports revocation and delete local token material.
8. The campaign creates provider-specific drafts. Each publish attempt uses an idempotency key where supported and records the provider response, remote ID, canonical URL, timestamps, and error category.
9. Retry only transient failures with bounded exponential backoff. Authentication failures must pause the channel and request reauthorization; validation/policy errors must not loop.
10. Keep automatic publishing disabled per channel until an owner-approved test post succeeds and the receipt is persisted.

## Security and operational requirements

- Keep all secrets server-only. Never use `NEXT_PUBLIC_` for OAuth secrets, access tokens, refresh tokens, or encryption keys.
- Separate app configuration from each user's authorization. A client ID does not mean a social account is connected.
- Encrypt stored tokens with authenticated encryption (for example AES-256-GCM) and include key versioning for rotation. Use a managed secret/KMS service where available.
- Apply least privilege, account ownership checks, CSRF protection, state validation, rate limits, audit logs, and explicit disconnect handling.
- Treat captions, URLs, uploaded media, comments, and scraped/public text as untrusted input.
- Add provider capability flags for text, image, carousel, video, scheduling, analytics, and deletion; capabilities differ by platform and account type.
- Do not claim a post is published until the provider confirms success and BlueHaven persists the receipt.
- Start in draft/review mode. No platform goes live automatically just because credentials were added.

## Rollout order

1. First-party Connections screen and secure connection registry.
2. Blogger + WordPress.com + Tumblr, with per-provider OAuth callbacks and draft/publish adapters.
3. Meta, X, TikTok, Pinterest, YouTube, and LinkedIn based on app approvals and verified scopes.
4. BlueHaven website as the canonical article destination and cross-posting source.
5. Medium and Substack handoff/export flows unless their official supported publishing access changes.
6. Amazon affiliate/product research as a separate monetization connector, not a social publisher.
7. Test accounts, publication receipts, retries, alerts, and a channel-by-channel launch checklist before enabling scheduled publishing.

## Credentials to provision

Create OAuth apps under the owner's own provider developer accounts and add their credentials to Vercel's Production environment. Exact names are listed in `.env.example`. Use each provider's documented callback URL after the OAuth routes are implemented. Do not invent callback URLs before the routes exist.
