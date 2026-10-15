# Google OAuth setup for BlueHaven AI World

This is the production setup for the existing Google OAuth implementation. Work stays on the repository's `main` branch and uses Vercel server routes.

## OAuth redirect URI

Register this exact URI in Google Cloud Console under **APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs**:

`https://bluehaven-ai-world.vercel.app/api/connections/callback/google`

It must match exactly, including HTTPS, path, and casing. BlueHaven builds the callback from `APP_URL`, which is currently set to `https://bluehaven-ai-world.vercel.app`.

## Google Cloud Console checklist

1. Open [Google Cloud Console](https://console.cloud.google.com/), select or create a project for BlueHaven AI World.
2. Under **APIs & Services → Library**, enable:
   - **Blogger API**
   - **YouTube Data API v3**
3. Configure **Google Auth Platform** (or the OAuth consent screen in the older console layout):
   - App name: `BlueHaven AI World`
   - Add the support email and developer contact email you control.
   - Choose **External** if personal Google accounts outside a managed Workspace organization need to connect.
   - During testing, add the Google account(s) that will test the connection as test users.
   - Add the homepage and privacy-policy URLs that are published for BlueHaven, if requested by the console.
4. Under **Clients**, create an OAuth client of type **Web application**.
5. Add the exact redirect URI above. Authorized JavaScript origins are not required for this server-side authorization-code flow.
6. Copy the generated client ID and client secret directly into Vercel. Do not commit them to GitHub or paste them into chat.

## Vercel environment variables

Open [BlueHaven AI World → Environment Variables](https://vercel.com/taiwoluwa-3003s-projects/bluehaven-ai-world/settings/environment-variables) and set these for **Production**:

- `GOOGLE_CLIENT_ID` — OAuth Web application client ID from Google Cloud Console.
- `GOOGLE_CLIENT_SECRET` — matching client secret from that same OAuth client.

The existing project also requires these for the connection system to work:

- `APP_URL=https://bluehaven-ai-world.vercel.app` (already configured in Production at the time this guide was written).
- `DATABASE_URL` (Neon database connection; already configured).
- `CHO_ADMIN_TOKEN` (server-side admin token; already configured).
- `SOCIAL_TOKEN_ENCRYPTION_KEY` — exactly 64 hexadecimal characters (32 random bytes), used for AES-256-GCM encryption of stored OAuth access/refresh tokens. The key must already be valid; do not replace it casually because existing encrypted tokens would no longer decrypt.

After adding or changing environment variables, redeploy the Production deployment so the server routes receive the values.

## Requested OAuth scopes

BlueHaven requests these scopes for the combined Blogger + YouTube connection:

- `openid`, `email`, `profile` — identify the Google account.
- `https://www.googleapis.com/auth/blogger` — access and publish Blogger posts.
- `https://www.googleapis.com/auth/youtube.readonly` — verify the connected YouTube channel/account.
- `https://www.googleapis.com/auth/youtube.upload` — authorize video uploads when a supported upload workflow is implemented.

The app requests offline access, asks Google to show account selection and consent, and uses a single-use, expiring server-stored OAuth state value to mitigate CSRF. Tokens are encrypted server-side and are not returned to the browser.

Because Blogger and YouTube scopes grant access to user data, Google may require OAuth consent-screen configuration, test-user enrollment, and verification before unrestricted public use. While an external app remains in Testing, Google refresh tokens for non-basic scopes may expire after seven days; plan production verification before relying on unattended publishing.

## Test after configuration

1. Open [BlueHaven Connections](https://bluehaven-ai-world.vercel.app/connections) and sign in with the BlueHaven CHO admin token.
2. Confirm the Google card no longer says **SETUP REQUIRED**.
3. Click **Connect account** and complete Google's official consent page.
4. Return to BlueHaven and click **Test connection**.
5. The test now checks Google identity plus live access to both Blogger API and YouTube Data API. Successful API checks can return zero blogs/channels if the Google account has not created those resources yet.
6. Treat this as authorization/API-access verification only. It does **not** prove a public post or YouTube upload succeeded.

## Current product boundary

The existing direct publisher supports Blogger article publishing under the Google connection. YouTube OAuth and API access can be authorized and tested, but the current Connections publishing form does not yet upload YouTube videos. Do not describe YouTube publishing as live until an upload workflow is implemented and tested against a real channel.

## Troubleshooting

- `redirect_uri_mismatch`: confirm the redirect URI is an exact match in Google Cloud Console and that Production `APP_URL` is correct.
- `access_denied` / unverified app warning: confirm the account is listed as a test user, or complete the required Google verification before public rollout.
- Blogger API errors: confirm Blogger API is enabled and the consent included the Blogger scope.
- YouTube API errors: confirm YouTube Data API v3 is enabled and the consent included YouTube read/upload scopes.
- Token encryption error: verify `SOCIAL_TOKEN_ENCRYPTION_KEY` is exactly 64 hex characters; keep the existing key stable.
- Connection storage errors: verify `DATABASE_URL` and apply `db/social-connections-schema.sql` if the social connection tables are not present.
