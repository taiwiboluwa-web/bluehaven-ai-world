"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./connections.css";

type Connection = { accountId: string; accountLabel: string | null; status: string; scopes: string[]; expiresAt: string | null; lastVerifiedAt: string | null; lastError: string | null };
type Provider = { provider: string; label: string; configured: boolean; connected: boolean; missingConfiguration: string[]; connections: Connection[] };
type Unsupported = { provider: string; label: string; mode: string; note: string };
type StatusData = { providers: Provider[]; unsupported: Unsupported[] };

const descriptions: Record<string, string> = {
  meta: "Connect Instagram professional accounts and Facebook Pages using Meta's official consent flow.",
  x: "Authorize X account access for permitted post creation and account checks.",
  tiktok: "Authorize TikTok. Direct posting may require app review and approval.",
  pinterest: "Connect Pinterest to manage supported boards and Pins.",
  google: "One Google authorization can grant Blogger and YouTube scopes. Choose only the services you plan to use.",
  linkedin: "Authorize permitted member sharing. Organization publishing may need extra approval.",
  wordpress: "Connect WordPress.com for supported site publishing.",
};

export default function ConnectionsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [data, setData] = useState<StatusData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [testingProvider, setTestingProvider] = useState("");
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const response = await fetch("/api/connections", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not read connection status.");
    setData(result);
    setSignedIn(true);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    const errorMessage = url.searchParams.get("connection_error");
    const note = url.searchParams.get("notice");
    if (connected) setNotice(`${connected} authorization returned successfully. ${note || "Publishing still needs a test."}`);
    if (errorMessage) setError(errorMessage);
    void refresh().catch(() => {});
  }, [refresh]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/connections/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: adminToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      setAdminToken("");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }

  async function testProvider(provider: string) {\n    setTestingProvider(provider); setError("");\n    try {\n      const response = await fetch(`/api/connections/test/${provider}`, { method: "POST" });\n      const result = await response.json();\n      if (!response.ok) throw new Error(result.error || "Connection test failed.");\n      setTestResults((old) => ({ ...old, [provider]: `Identity verified${result.accountLabel ? `: ${result.accountLabel}` : ""}. Publishing has not been tested.` }));\n      await refresh();\n    } catch (e) { setTestResults((old) => ({ ...old, [provider]: e instanceof Error ? e.message : "Connection test failed." })); }\n    finally { setTestingProvider(""); }\n  }\n\n  async function signOut() {
    await fetch("/api/connections/session", { method: "DELETE" });
    setSignedIn(false); setData(null); setAdminToken("");
  }

  return <main className="connections-page">
    <header className="connections-nav">
      <Link href="/" className="connections-brand"><span>BH</span> BLUEHAVEN <i>AI WORLD</i></Link>
      <div><Link href="/company">Company operations</Link><span className="nav-divider">/</span><strong>Connections</strong></div>
    </header>
    <section className="connections-hero">
      <div className="connections-kicker">FIRST-PARTY ACCOUNT CONTROL</div>
      <h1>Your channels.<br/><em>One control room.</em></h1>
      <p>Authorize social accounts directly with their official providers. BlueHaven stores encrypted tokens server-side and will only mark publishing as ready after a successful test.</p>
      <div className="connections-callout"><strong>Important</strong><span>Never enter a social-media password here. The Connect buttons redirect to the platform's official authorization page.</span></div>
    </section>

    {!signedIn ? <section className="connections-login">
      <div className="connections-section-label">ADMIN ACCESS</div>
      <h2>Sign in to manage connections</h2>
      <p>Use the BlueHaven CHO admin token configured on the server. It is sent once to establish an eight-hour, HttpOnly session cookie and is not saved in browser storage.</p>
      <form onSubmit={signIn}>
        <label htmlFor="admin-token">CHO admin token</label>
        <input id="admin-token" type="password" autoComplete="current-password" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} required />
        <button type="submit" disabled={busy}>{busy ? "Checking…" : "Sign in securely"}</button>
      </form>
    </section> : <>
      <div className="connections-toolbar"><div><span className="secure-dot"/> Admin session active <span className="toolbar-note">· tokens are never returned to this page</span></div><button onClick={signOut} className="signout-button">Sign out</button></div>
      {notice && <div className="connections-notice">{notice}</div>}
      <section className="connections-section">
        <div className="connections-section-heading"><div><div className="connections-section-label">01 / SOCIAL + PUBLISHING</div><h2>Connect your channels</h2></div><p>OAuth credentials must be configured in Vercel before a provider can be connected.</p></div>
        <div className="provider-grid">{(data?.providers || []).map((provider) => {
          const connection = provider.connections[0];
          return <article className="provider-card" key={provider.provider}>
            <div className="provider-top"><span className="provider-symbol">{provider.label.split(/[ /]/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className={provider.connected ? "provider-status is-connected" : "provider-status"}>{provider.connected ? "AUTHORIZED" : provider.configured ? "NOT CONNECTED" : "SETUP REQUIRED"}</span></div>
            <h3>{provider.label}</h3>
            <p>{descriptions[provider.provider] || "Connect this provider using its official authorization flow."}</p>
            {connection && <div className="provider-detail"><span>Account</span><strong>{connection.accountLabel || connection.accountId}</strong><span>Last authorized</span><strong>{connection.lastVerifiedAt ? new Date(connection.lastVerifiedAt).toLocaleString() : "Not verified"}</strong></div>}
            {!provider.configured && <div className="provider-missing"><strong>Missing server settings</strong><span>{provider.missingConfiguration.join(", ")}</span></div>}
            {connection?.lastError && <div className="provider-error">{connection.lastError}</div>}
            {provider.configured ? <a className="provider-connect" href={`/api/connections/authorize/${provider.provider}`}>{provider.connected ? "Reconnect account ↗" : "Connect account ↗"}</a> : <button className="provider-disabled" disabled>Configure OAuth app first</button>}
          </article>;
        })}</div>
      </section>
      <section className="connections-section extra-section">
        <div className="connections-section-heading"><div><div className="connections-section-label">02 / DRAFT HANDOFFS + COMMERCE</div><h2>Other useful destinations</h2></div><p>These are deliberately separated from direct social publishing where a supported API is unavailable.</p></div>
        <div className="unsupported-grid">{(data?.unsupported || []).map((item) => <article className="unsupported-card" key={item.provider}><div><h3>{item.label}</h3><span>{item.mode.replaceAll("_", " ")}</span></div><p>{item.note}</p></article>)}</div>
      </section>
    </>}
    {error && <div className="connections-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    <footer className="connections-footer">BlueHaven AI World · Authorized APIs only · Draft-first until publishing is tested</footer>
  </main>;
}
