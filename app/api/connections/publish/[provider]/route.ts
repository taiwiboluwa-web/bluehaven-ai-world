import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { decryptSecret, isSocialProvider } from "@/lib/social-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "bluehaven_social_admin";

type PublishBody = { title?: string; content?: string; text?: string; labels?: string[]; blogId?: string; siteId?: string; idempotencyKey?: string; confirmPublish?: boolean };
type ProviderJson = { [key: string]: unknown; error_description?: string; message?: string; error?: string; data?: { id?: string | number }; items?: { id?: string | number }[]; sites?: { ID?: string | number }[]; id?: string | number; url?: string; ID?: string | number; URL?: string };

function hashPayload(provider: string, body: PublishBody) {
  return createHash("sha256").update(JSON.stringify({ provider, title: body.title || "", content: body.content || "", text: body.text || "", labels: body.labels || [], blogId: body.blogId || "", siteId: body.siteId || "" })).digest("hex");
}

async function jsonOrError(response: Response) {
  const body = await response.json().catch(() => ({})) as ProviderJson;
  if (!response.ok) {
    const message = typeof body.error_description === "string" ? body.error_description
      : typeof body.message === "string" ? body.message
      : typeof body.error === "string" ? body.error
      : `Provider returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return body;
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const expected = process.env.CHO_ADMIN_TOKEN;
  const jar = await cookies();
  const cookieAuthorized = Boolean(expected && jar.get(COOKIE)?.value === expected);
  const bearerAuthorized = Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
  if (!expected || (!cookieAuthorized && !bearerAuthorized)) return NextResponse.json({ error: "CHO authorization is required to publish from BlueHaven." }, { status: 401 });
  const { provider } = await context.params;
  if (!isSocialProvider(provider)) return NextResponse.json({ error: "Unsupported provider." }, { status: 404 });
  if (!["x", "linkedin", "google", "wordpress"].includes(provider)) {
    return NextResponse.json({ error: "Direct publishing is not yet implemented for this provider. No post was sent.", provider, status: "adapter_pending" }, { status: 501 });
  }

  let body: PublishBody;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  if (body.confirmPublish !== true) return NextResponse.json({ error: "Explicit confirmation is required before a live post is sent." }, { status: 400 });
  if (!body.idempotencyKey || !/^[a-zA-Z0-9_-]{12,100}$/.test(body.idempotencyKey)) return NextResponse.json({ error: "Provide a unique idempotencyKey (12–100 letters, numbers, underscores or hyphens)." }, { status: 400 });
  const text = (provider === "x" ? body.text : body.content)?.trim() || "";
  if (!text) return NextResponse.json({ error: provider === "x" ? "Post text is required." : "Article content is required." }, { status: 400 });
  if (provider === "x" && text.length > 280) return NextResponse.json({ error: "X post text must be no longer than 280 characters in this initial publisher." }, { status: 400 });
  if (!["x", "linkedin"].includes(provider) && !body.title?.trim()) return NextResponse.json({ error: "Article title is required." }, { status: 400 });
  if (text.length > 100000 || (body.title || "").length > 500) return NextResponse.json({ error: "Content exceeds the allowed length." }, { status: 400 });

  const payloadHash = hashPayload(provider, body);
  try {
    const sql = getSql();
    const tokenRows = await sql`SELECT access_token_ciphertext, expires_at, status, capabilities FROM social_provider_tokens WHERE provider = ${provider} AND account_id = 'default' LIMIT 1`;
    if (!tokenRows.length) return NextResponse.json({ error: "Connect and test this provider before publishing." }, { status: 409 });
    const tokenRow = tokenRows[0] as { access_token_ciphertext: string; expires_at: string | null; status: string; capabilities: Record<string, unknown> };
    if (tokenRow.status !== "connected") return NextResponse.json({ error: "This provider connection is not active. Reauthorize and test it first." }, { status: 409 });
    if (tokenRow.capabilities?.identityCheck !== "passed") return NextResponse.json({ error: "Run Test connection successfully before publishing." }, { status: 409 });
    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() <= Date.now()) {
      await sql`UPDATE social_provider_tokens SET status = 'needs_reauthorization', last_error = 'Access token expired.', updated_at = now() WHERE provider = ${provider} AND account_id = 'default'`;
      return NextResponse.json({ error: "The saved access token has expired. Reconnect the account before publishing." }, { status: 401 });
    }

    const inserted = await sql`INSERT INTO social_publication_receipts (provider, idempotency_key, payload_hash, status) VALUES (${provider}, ${body.idempotencyKey}, ${payloadHash}, 'started') ON CONFLICT (provider, idempotency_key) DO NOTHING RETURNING id`;
    if (!inserted.length) {
      const existingRows = await sql`SELECT status, payload_hash, remote_post_id, published_url, error_message FROM social_publication_receipts WHERE provider = ${provider} AND idempotency_key = ${body.idempotencyKey} LIMIT 1`;
      const existing = existingRows[0] as { status: string; payload_hash: string; remote_post_id: string | null; published_url: string | null; error_message: string | null } | undefined;
      if (!existing) return NextResponse.json({ error: "Could not verify the previous publishing attempt." }, { status: 500 });
      if (existing.payload_hash !== payloadHash) return NextResponse.json({ error: "This idempotency key was already used for different content." }, { status: 409 });
      if (existing.status === "published") return NextResponse.json({ ok: true, duplicate: true, status: existing.status, remotePostId: existing.remote_post_id, publishedUrl: existing.published_url });
      return NextResponse.json({ error: "A previous attempt with this idempotency key is already recorded. Review its receipt before creating a new attempt.", previousStatus: existing.status, previousError: existing.error_message }, { status: 409 });
    }

    const token = decryptSecret(tokenRow.access_token_ciphertext);
    if (!token) throw new Error("The saved provider token could not be decrypted.");
    let remotePostId = "";
    let publishedUrl = "";
    let summary: Record<string, unknown> = {};

    if (provider === "x") {
      const response = await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        cache: "no-store",
      });
      const result = await jsonOrError(response);
      remotePostId = String(result.data?.id || "");
      if (!remotePostId) throw new Error("X did not return a post ID.");
      publishedUrl = `https://x.com/i/web/status/${remotePostId}`;
      summary = { text: text.slice(0, 280), response: { id: remotePostId } };
    } else if (provider === "linkedin") {
      const accountId = String(tokenRow.capabilities?.remoteAccountId || "");
      if (!accountId) throw new Error("Run Test connection again so BlueHaven can verify the LinkedIn member ID.");
      const author = accountId.startsWith("urn:li:person:") ? accountId : `urn:li:person:${accountId}`;
      const response = await fetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": process.env.LINKEDIN_API_VERSION || "202610",
        },
        body: JSON.stringify({
          author,
          commentary: text,
          visibility: "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
        cache: "no-store",
      });
      if (!response.ok) await jsonOrError(response);
      const post = await response.json().catch(() => ({})) as ProviderJson;
      remotePostId = response.headers.get("x-restli-id") || String(post.id || post.data?.id || "");
      if (!remotePostId) throw new Error("LinkedIn did not return a post ID; verify the app's Community Management access and w_member_social permission.");
      publishedUrl = `https://www.linkedin.com/feed/update/${remotePostId}`;
      summary = { text: text.slice(0, 5000), author, postId: remotePostId };
    } else if (provider === "google") {
      let blogId = body.blogId;
      if (!blogId) {
        const blogsResponse = await fetch("https://www.googleapis.com/blogger/v3/users/self/blogs", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const blogs = await jsonOrError(blogsResponse);
        const firstBlog = blogs.items?.[0];
        blogId = firstBlog?.id ? String(firstBlog.id) : undefined;
      }
      if (!blogId) throw new Error("No Blogger blog was found for this Google account. Create a Blogger blog first.");
      const postResponse = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/posts/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "blogger#post", title: body.title!.trim(), content: text, labels: (body.labels || []).slice(0, 20) }),
        cache: "no-store",
      });
      const post = await jsonOrError(postResponse);
      remotePostId = String(post.id || "");
      publishedUrl = String(post.url || "");
      if (!remotePostId) throw new Error("Blogger did not return a post ID.");
      summary = { title: body.title!.trim(), blogId, url: publishedUrl };
    } else {
      let siteId = body.siteId;
      if (!siteId) {
        const sitesResponse = await fetch("https://public-api.wordpress.com/rest/v1.1/me/sites", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const sites = await jsonOrError(sitesResponse);
        const firstSite = sites.sites?.[0];
        siteId = firstSite?.ID ? String(firstSite.ID) : "";
      }
      if (!siteId) throw new Error("No WordPress.com site was found for this account. Create or connect a site first.");
      const form = new URLSearchParams({ title: body.title!.trim(), content: text, status: "publish" });
      const postResponse = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(siteId)}/posts/new`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        cache: "no-store",
      });
      const post = await jsonOrError(postResponse);
      remotePostId = String(post.ID || post.id || "");
      publishedUrl = String(post.URL || post.url || "");
      if (!remotePostId) throw new Error("WordPress.com did not return a post ID.");
      summary = { title: body.title!.trim(), siteId, url: publishedUrl };
    }

    await sql`UPDATE social_publication_receipts SET status = 'published', remote_post_id = ${remotePostId}, published_url = ${publishedUrl || null}, response_summary = ${JSON.stringify(summary)}::jsonb, completed_at = now() WHERE provider = ${provider} AND idempotency_key = ${body.idempotencyKey}`;
    await sql`UPDATE social_provider_tokens SET capabilities = capabilities || ${JSON.stringify({ publishing: "confirmed", lastPublishedAt: new Date().toISOString() })}::jsonb, last_verified_at = now(), last_error = NULL, updated_at = now() WHERE provider = ${provider} AND account_id = 'default'`;
    return NextResponse.json({ ok: true, provider, status: "published", remotePostId, publishedUrl, receiptKey: body.idempotencyKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publishing failed.";
    try {
      const sql = getSql();
      await sql`UPDATE social_publication_receipts SET status = 'failed', error_message = ${message.slice(0, 500)}, response_summary = ${JSON.stringify({ error: message.slice(0, 500) })}::jsonb, completed_at = now() WHERE provider = ${provider} AND idempotency_key = ${body.idempotencyKey}`;
      await sql`UPDATE social_provider_tokens SET last_error = ${message.slice(0, 300)}, updated_at = now() WHERE provider = ${provider} AND account_id = 'default'`;
    } catch {}
    return NextResponse.json({ error: message.slice(0, 500), status: "failed", receiptKey: body.idempotencyKey }, { status: 502 });
  }
}
