#!/usr/bin/env node
/**
 * BlueHaven AI World production smoke test.
 *
 * Safe by default: never publishes social posts and never prints secret values.
 * Optional environment variables:
 *   BLUEHAVEN_BASE_URL       (default: https://bluehaven-ai-world.vercel.app)
 *   OMNIROUTE_API_KEY        (required for authenticated model test)
 *   CHO_ADMIN_TOKEN          (required to test valid CHO login and protected connections)
 *   OMNIROUTE_TEST_MODEL     (optional; defaults to google/gemma-4-26b-a4b-it)
 */
const baseUrl = (process.env.BLUEHAVEN_BASE_URL || "https://bluehaven-ai-world.vercel.app").replace(/\/$/, "");
const results = [];
const report = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
async function request(path, init = {}) {
  const response = await fetch(baseUrl + path, { ...init, redirect: "manual" });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
  return { response, body };
}

try {
  const health = await request("/api/omniroute/health");
  report("Health endpoint responds", health.response.ok, `HTTP ${health.response.status}`);
  report("Health reports gateway configuration", health.response.ok && (
    health.body.status === "ready" ||
    (health.body.configured === true && health.body.modelAvailable === true)
  ), health.body.status || health.body.message || "configuration not confirmed");

  const unauth = await request("/api/omniroute/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.OMNIROUTE_TEST_MODEL || "google/gemma-4-26b-a4b-it", messages: [{ role: "user", content: "Reply with exactly: smoke-test-ok" }] })
  });
  report("Unauthenticated chat request is rejected", [401, 403].includes(unauth.response.status), `HTTP ${unauth.response.status}`);

  if (process.env.OMNIROUTE_API_KEY) {
    const chat = await request("/api/omniroute/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OMNIROUTE_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OMNIROUTE_TEST_MODEL || "google/gemma-4-26b-a4b-it",
        messages: [{ role: "user", content: "Reply with exactly: smoke-test-ok" }],
        max_tokens: 20,
        temperature: 0
      })
    });
    const text = chat.body?.choices?.[0]?.message?.content;
    report("Authenticated upstream chat completion", chat.response.ok && typeof text === "string" && text.length > 0,
      chat.response.ok ? (text ? "model returned a message" : "response missing choices[0].message.content") : `HTTP ${chat.response.status}: ${chat.body?.error?.message || chat.body?.error || "request failed"}`);
  } else {
    report("Authenticated upstream chat completion", false, "skipped: set OMNIROUTE_API_KEY in your local shell to run this test");
  }

  const wrongCho = await request("/api/connections/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "invalid-smoke-test-token" })
  });
  report("Invalid CHO token is rejected", wrongCho.response.status === 401 || wrongCho.response.status === 503,
    `HTTP ${wrongCho.response.status}`);

  if (process.env.CHO_ADMIN_TOKEN) {
    const login = await request("/api/connections/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: process.env.CHO_ADMIN_TOKEN })
    });
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
    report("Valid CHO token establishes admin session", login.response.ok && Boolean(cookie),
      `HTTP ${login.response.status}`);
    if (login.response.ok && cookie) {
      const status = await request("/api/connections", { headers: { cookie } });
      report("Protected social connections status endpoint", status.response.ok,
        `HTTP ${status.response.status}${status.response.ok ? "" : " — database/schema or session issue"}`);
    }
  } else {
    report("Valid CHO token establishes admin session", false, "skipped: set CHO_ADMIN_TOKEN in your local shell");
  }
} catch (error) {
  report("Production smoke-test requests", false, error instanceof Error ? error.message : "network error");
}

const failed = results.filter((item) => !item.ok);
console.log(`\nResult: ${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
