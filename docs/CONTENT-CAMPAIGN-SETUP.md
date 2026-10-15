# Content Command setup and first run

This checklist is for the BlueHaven AI World owner/operator. Do not put secrets into GitHub issues, source files, or chat.

## 1. Merge and deploy
Review draft PR #5: https://github.com/taiwiboluwa-web/bluehaven-ai-world/pull/5  
After the preview build passes and the code is approved, merge the PR to `main`. A preview deployment is not production and does not activate production cron jobs.

## 2. Apply the additive Neon migration
Open the Neon SQL editor for the database already used by BlueHaven AI World and run the full contents of `db/content-campaign-schema.sql`. This adds campaign tables only; it does not drop or reset existing data.

## 3. Confirm server-only Vercel environment variables
Set/verify the following for Production:
- `DATABASE_URL` — existing Neon connection string
- `AI_GATEWAY_API_KEY` (or `OPENROUTER_API_KEY`) — gateway credential
- `AI_DEFAULT_MODEL` — a model ID supported by the credential
- `CRON_SECRET` — a random server-only secret of at least 16 characters
- `CHO_ADMIN_TOKEN` — a separate random server-only token for campaign initialization

Never prefix these with `NEXT_PUBLIC_`. Do not reuse the AI provider key as the cron/admin token. Redeploy after changing environment variables.

## 4. Initialize the campaign once
After deployment and migration, send an authenticated POST to:
`https://bluehaven-ai-world.vercel.app/api/content-campaign`
with header `Authorization: Bearer <CHO_ADMIN_TOKEN>` and a JSON body such as `{}`.

The route is idempotent for campaign identity and day numbers. It creates the campaign record and inserts the 40 roadmap days without replacing existing day records.

## 5. Prepare the next day
The protected daily cron endpoint is:
`GET /api/content-campaign/cron`
Vercel sends `Authorization: Bearer <CRON_SECRET>` to cron routes when the project secret is configured. The endpoint selects the earliest planned/failed day, asks the model gateway for five content ideas, validates required fields and X's 280-character limit, and stores three platform drafts per idea (X, Instagram, website SEO) in Neon.

The campaign begins on 2026-10-16 Africa/Lagos. The cron entry runs at 21:00 UTC (22:00 WAT) to prepare ahead. Vercel Hobby scheduling is not exact, and cron failures are not automatically retried; monitor logs and retry safely.

## 6. What this first version does not do
- It does not publish externally or create a real provider-side schedule.
- The five times stored are intended publication slots; every record remains `draft`.
- Product handles and source URLs are not fabricated. The AI is instructed to leave uncertain sources empty; an editorial verification/research step is required before public release.
- Metricool, X, Instagram media upload, Medium and Blogger authorization/publishing adapters must be connected and tested separately.
- Google Search Console is for search analytics, not article publishing. Google Cloud is infrastructure/storage, not a generic publisher.

Do not change the campaign to auto-publish until provider authorization, media requirements, duplicate protection, and successful publication receipts have been tested end to end.
