# BlueHaven 40-Day Content Command

## Mission
Operate a 40-day educational campaign for BlueHaven Studios, beginning 16 October 2026 (Africa/Lagos). The campaign teaches useful, specific lessons across livestreaming, creator tools, coding platforms, AI software, design tools, Python libraries, and AI-agent workflows. It must sound like a practitioner: conversational, concrete, curious, fair, and never like generic marketing copy.

Brand: BlueHaven Studios — “Creativity Beyond Limits”  
Website: https://www.bluehavens.name.ng/  
Brand colors: #ffde59 yellow and #7f56d6 purple  
Instagram: @blue.havenstudios  
TikTok: @he.is.taiwo  
Timezone: Africa/Lagos

## Daily package
Prepare 2–5 distinct social posts per campaign day. Each post record must contain:
- Day number and ISO campaign date
- Unique topic and angle; do not repeat previous campaign topics
- Platform-specific X copy, kept under 280 characters
- Instagram caption with hook, useful lesson, CTA, relevant hashtags, and a detailed visual brief (format, composition, on-image copy, visual hierarchy, accessibility/alt text)
- Approximately 150-word SEO article/snippet that expands the idea rather than repeating the caption
- Official vendor/product handle or URL only after verification; omit uncertain handles
- Sources/reference URLs and verification date for changing product facts
- Website CTA to https://www.bluehavens.name.ng/
- Content status, schedule time, publication URL, and error details

Use WAT (UTC+1) publication slots: 08:00, 10:00, 12:00, 14:00, 16:00. A day may have fewer posts, so only use as many slots as posts. The social copy may be adapted per channel; never exceed X's character limit. Prefer platform-native media and do not publish a text-only Instagram post when the integration requires media.

## Voice and editorial rules
1. Lead with the product's real strength or the problem it solves.
2. Explain one actionable workflow, limitation, or trade-off.
3. Offer respectful, specific criticism only when useful. Do not ridicule creators or software.
4. Distinguish verified facts from opinion and experience.
5. Do not invent features, prices, handles, benchmarks, quotes, or testimonials.
6. Use a human, hands-on voice. Avoid empty phrases such as “unlock your potential,” “game-changer,” “seamless,” and “revolutionary.”
7. Avoid repeated hooks, identical carousel layouts, and repetitive hashtags.
8. Keep claims about security, pricing, licensing, and availability linked to official documentation.
9. Include a soft, relevant BlueHaven CTA, not a sales pitch in every post.
10. Never claim content was published or scheduled unless the provider returns a successful result and the result is saved.

## 40-day editorial roadmap
| Day | Theme | Suggested angle |
|---:|---|---|
| 1 | OBS Studio | Build a reliable scene and audio-check routine |
| 2 | Streamlabs Desktop | When convenience beats a fully custom setup |
| 3 | vMix | Multi-camera production planning and input discipline |
| 4 | Restream | Simulcasting trade-offs and audience workflow |
| 5 | Audio routing | Diagnose mute, monitoring, and sync problems |
| 6 | Stream overlays | Visual hierarchy over decorative clutter |
| 7 | Live production checklist | Rehearsal, backups, and a calm operator |
| 8 | Figma | Components, variables, and collaborative design |
| 9 | Canva | Design systems and reusable brand templates |
| 10 | Adobe Express | Quick content production with brand consistency |
| 11 | Photoshop | Non-destructive editing and export discipline |
| 12 | CapCut | Short-form editing and caption readability |
| 13 | DaVinci Resolve | Timeline organization and audio finishing |
| 14 | Visual storytelling | Turn a feature list into a clear visual narrative |
| 15 | GitHub | Small commits, branches, and readable project history |
| 16 | VS Code | Editor workflow, extensions, and workspace hygiene |
| 17 | Next.js | Routes, server-side work, and deployment awareness |
| 18 | Vercel | Preview deployments and production safety |
| 19 | Neon Postgres | Schema design, migrations, and query discipline |
| 20 | Supabase | Know what the platform provides and what you own |
| 21 | API design | Validate inputs, authenticate, and report useful errors |
| 22 | Python automation | Automate repetitive file and reporting tasks |
| 23 | pandas | Clean data before drawing conclusions |
| 24 | Pillow | Batch image processing and export consistency |
| 25 | MoviePy / FFmpeg | Practical video batch workflows and limits |
| 26 | FastAPI | A small, well-documented API endpoint |
| 27 | Jupyter | Exploratory work that can be reproduced |
| 28 | Python packaging | Environments, pinned dependencies, and repeatability |
| 29 | AI prompting | Context, constraints, examples, and evaluation |
| 30 | OpenAI-compatible gateways | Provider flexibility and secret handling |
| 31 | AI agents | Separate model output from actual tool execution |
| 32 | Retrieval and knowledge bases | Ground answers in sources and show uncertainty |
| 33 | AI evaluation | Test cases, regressions, and human review |
| 34 | AI safety and permissions | Least privilege, approval gates, and audit trails |
| 35 | AI video tools | Plan consistency, rights, and clear disclosure |
| 36 | Creator analytics | Measure saves, clicks, watch time, and conversions |
| 37 | SEO fundamentals | Useful titles, internal links, and search intent |
| 38 | Google Search Console | Use impressions and queries to improve content |
| 39 | Repurposing | Turn one useful idea into distinct native formats |
| 40 | Campaign retrospective | Share learnings, best-performing formats, and next steps |

## Operational design
- The daily job should be idempotent: one campaign-date row and unique day/post keys prevent duplicate content on repeated cron calls.
- Store a campaign run and draft records before attempting any external publishing.
- Separate generation from publishing. A generated draft is not a scheduled post.
- Use a provider adapter interface so Metricool, X, Medium, Blogger, and Google integrations can be added independently.
- Persist provider responses and external post IDs. Retry transient failures with bounded backoff; do not blindly repeat non-idempotent publish calls.
- Never store OAuth access tokens in browser state or source control. Use server-side encrypted secrets / supported OAuth token storage.
- Provide a review mode and a clearly configured auto-publish mode. Default to drafts until each channel has been tested.
- Track each channel's capability separately: connected, authorised, media supported, scheduling supported, and last verified time.
- For Google: Blogger is a publishing platform; Search Console is analytics/indexing visibility, not an article publisher; Google Cloud is infrastructure/storage, not a generic social-publishing destination.

## Deployment notes
The current Vercel team is on the Hobby plan. Vercel Cron is UTC-based; on Hobby, cron execution is once daily and may occur within the scheduled hour. Use one daily job to prepare the next day's queue, then let a connected publishing scheduler release posts at the chosen slots. Five precise cron invocations daily would require a suitable scheduler or plan with per-minute scheduling precision. See https://vercel.com/docs/cron-jobs/usage-and-pricing and https://vercel.com/docs/cron-jobs/manage-cron-jobs.

The repository currently has a daily company-brief cron. Check Vercel's Hobby plan restrictions before enabling another cron route. Configure a server-only CRON_SECRET (at least 16 random characters) and verify it in the route. The current environment listing did not show CRON_SECRET or AGENT_SERVICE_TOKEN, so these must be configured before a protected campaign job can run.

## Definition of done
- 40 days are represented in the campaign ledger and editorial roadmap.
- Draft generation is repeatable and idempotent.
- Each draft has all required content fields and a unique topic.
- Provider connections are explicitly authorised and tested.
- Scheduled times are confirmed by provider responses.
- Failures are visible and recoverable.
- Analytics and publication receipts are stored.
- A daily run is not reported as successful if generation or scheduling failed.
