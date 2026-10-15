# BlueHaven AI World — Social OAuth Setup and Safe Verification

Base URL: `https://bluehaven-ai-world.vercel.app`

The Connections page deliberately does not accept social-media passwords. Each provider must be configured with its own developer app and callback URL. Do not paste client secrets into GitHub, browser code, or chat.

## Required Vercel environment variables

Add each provider's credentials under Project → Settings → Environment Variables, Production environment:

| Provider | Environment variables |
|---|---|
| Instagram / Facebook (Meta) | `META_APP_ID`, `META_APP_SECRET` |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| Pinterest | `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` |
| Google (Blogger / YouTube) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| WordPress.com | `WORDPRESS_CLIENT_ID`, `WORDPRESS_CLIENT_SECRET` |

The database encryption variable `SOCIAL_TOKEN_ENCRYPTION_KEY` must be 64 hexadecimal characters (32 random bytes). Generate one locally with Node.js:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If an encryption key has already been used to store social tokens, do not rotate it casually: old stored tokens would no longer decrypt. Back up and plan a migration before rotating it.

## OAuth callback URLs

Register the exact callback URL for each provider:

- Meta: `https://bluehaven-ai-world.vercel.app/api/connections/callback/meta`
- X: `https://bluehaven-ai-world.vercel.app/api/connections/callback/x`
- TikTok: `https://bluehaven-ai-world.vercel.app/api/connections/callback/tiktok`
- Pinterest: `https://bluehaven-ai-world.vercel.app/api/connections/callback/pinterest`
- Google: `https://bluehaven-ai-world.vercel.app/api/connections/callback/google`
- LinkedIn: `https://bluehaven-ai-world.vercel.app/api/connections/callback/linkedin`
- WordPress.com: `https://bluehaven-ai-world.vercel.app/api/connections/callback/wordpress`

Configure requested scopes and app review/test-user access in each provider's developer console. Provider review policies and permitted publishing actions vary. A successful OAuth callback proves authorization returned; it does not prove that a post can be published.

## Safe verification order

1. Open `/connections` and sign in with the CHO admin token.
2. Confirm the provider shows **SETUP REQUIRED** or **NOT CONNECTED** as appropriate.
3. Add one provider's app credentials and callback URL; redeploy.
4. Connect a test account via the official provider consent screen.
5. Use **Test connection** to validate the account identity.
6. Only then, if needed, publish a clearly labeled test post after checking the destination and explicitly confirming the live-publish checkbox.
7. Repeat for each provider separately. Do not use production publishing as a generic health check.

## Automated smoke tests

From a trusted local terminal, set `OMNIROUTE_API_KEY` and `CHO_ADMIN_TOKEN` as shell environment variables (do not put values in source files), then run:

```powershell
npm run smoke:production
```

The script verifies gateway health, rejects unauthenticated API calls, sends one small authenticated chat request, checks CHO login, and reports which OAuth providers have credentials configured. It never publishes social posts. Run it only from a trusted machine and never capture or share logs containing secret values.
