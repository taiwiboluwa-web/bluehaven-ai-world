import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const SOCIAL_PROVIDERS = {
  meta: {
    label: "Instagram / Facebook",
    env: ["META_APP_ID", "META_APP_SECRET"],
    authorizationUrl: "https://www.facebook.com/v23.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v23.0/oauth/access_token",
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish"],
    responseMode: "json",
  },
  x: {
    label: "X",
    env: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    authorizationUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    responseMode: "form",
    pkce: true,
  },
  tiktok: {
    label: "TikTok",
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    authorizationUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.publish", "video.upload"],
    responseMode: "form",
  },
  pinterest: {
    label: "Pinterest",
    env: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"],
    authorizationUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    scopes: ["user_accounts:read", "boards:read", "pins:read", "pins:write"],
    responseMode: "basic",
  },
  google: {
    label: "Blogger / YouTube",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/blogger", "https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    responseMode: "json",
  },
  linkedin: {
    label: "LinkedIn",
    env: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    responseMode: "form",
  },
  wordpress: {
    label: "WordPress.com",
    env: ["WORDPRESS_CLIENT_ID", "WORDPRESS_CLIENT_SECRET"],
    authorizationUrl: "https://public-api.wordpress.com/oauth2/authorize",
    tokenUrl: "https://public-api.wordpress.com/oauth2/token",
    scopes: [],
    responseMode: "json",
  },
} as const;

export type SocialProvider = keyof typeof SOCIAL_PROVIDERS;

export function isSocialProvider(value: string): value is SocialProvider {
  return Object.prototype.hasOwnProperty.call(SOCIAL_PROVIDERS, value);
}

export function getRedirectUri(provider: SocialProvider) {
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://bluehaven-ai-world.vercel.app";
  return new URL(`/api/connections/callback/${provider}`, base).toString();
}

export function isProviderConfigured(provider: SocialProvider) {
  const encryptionKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || "";
  return SOCIAL_PROVIDERS[provider].env.every((key) => Boolean(process.env[key])) && /^[a-f0-9]{64}$/i.test(encryptionKey);
}

export function missingProviderConfiguration(provider: SocialProvider) {
  const missing: string[] = SOCIAL_PROVIDERS[provider].env.filter((key) => !process.env[key]);
  const encryptionKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(encryptionKey)) missing.push("SOCIAL_TOKEN_ENCRYPTION_KEY");
  return missing;
}

export function makeRandomState() {
  return randomBytes(32).toString("base64url");
}

export function hashState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

function encryptionKey() {
  const value = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters (32 random bytes).");
  return Buffer.from(value, "hex");
}

export function encryptSecret(value: string | undefined | null) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Encrypted token format is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}
