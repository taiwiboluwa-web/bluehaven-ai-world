"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Agent = { id: string; name: string; department: string; role_description: string; status: string };
type Provider = { id: string; label: string; status: string; configuredCount: number; requiredCount: number; missing: string[]; note: string };
type Draft = { id: string; title: string; body: string; platforms: string[]; status: string; created_at: string };
type Mission = { missionId: string; selectedAgents: string[]; standbyAgents: string[]; routingNote: string; coordinationBrief: string; succeeded: number; total: number; results: { agent: string; status: string; output?: string; error?: string }[] };

const platformOptions = [
  { id: "instagram", label: "Instagram" }, { id: "facebook", label: "Facebook" }, { id: "x", label: "X" },
  { id: "tiktok", label: "TikTok" }, { id: "linkedin", label: "LinkedIn" }, { id: "youtube", label: "YouTube" }, { id: "pinterest", label: "Pinterest" },
];

export default function CreatorCommandCenter() {
  const [token, setToken] = useState("");
  const [goal, setGoal] = useState("Create a 7-day BlueHaven Studios content campaign that promotes our creative services, practical training, and creator resources. Produce channel-specific post copy and a publishing plan.");
  const [mission, setMission] = useState<Mission | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [title, setTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "facebook", "x"]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [companyRes, statusRes] = await Promise.all([
        fetch("/api/company", { cache: "no-store" }),
        fetch("/api/creator/status", { cache: "no-store" }),
      ]);
      const company = await companyRes.json();
      const status = await statusRes.json();
      if (companyRes.ok) setAgents(company.agents || []);
      if (statusRes.ok) setProviders(status.providers || []);
    } catch { setError("Some live status data could not be loaded."); }
  }, []);

  const loadDrafts = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/creator/content", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (response.ok) setDrafts(data.drafts || []);
    } catch { /* draft list remains available after a successful reload */ }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadDrafts(); }, [loadDrafts]);

  async function runPrompt(event: React.FormEvent) {
    event.preventDefault();
    if (!token) { setError("Enter the CHO admin token or agent service token to start an execution."); return; }
    setBusy(true); setError(""); setNotice(""); setMission(null);
    try {
      const response = await fetch("/api/company/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goal, dispatchMode: "auto" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Agent execution failed.");
      setMission(data);
      setNotice("Atlas routed the prompt to the best-fit specialists. Other agents remain on standby.");
    } catch (e) { setError(e instanceof Error ? e.message : "Agent execution failed."); }
    finally { setBusy(false); }
  }

  async function saveDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!token) { setError("Enter the CHO admin token or agent service token to save a draft."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/creator/content", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, body: draftBody, platforms }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Draft could not be saved.");
      setNotice("Draft saved to the persistent Creator Command Center queue. Nothing has been published.");
      setTitle(""); setDraftBody("");
      await loadDrafts();
    } catch (e) { setError(e instanceof Error ? e.message : "Draft could not be saved."); }
    finally { setBusy(false); }
  }

  function togglePlatform(id: string) { setPlatforms((old) => old.includes(id) ? old.filter((p) => p !== id) : [...old, id]); }

  return <main style={{ minHeight: "100vh", background: "#0b0d11", color: "#f4f0e8", padding: "clamp(20px,5vw,64px)", fontFamily: "Arial,sans-serif" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14, borderBottom: "1px solid #2a2d33", paddingBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/company" style={{ color: "#ffde59", textDecoration: "none" }}>← COMPANY HQ</Link>
          <Link href="/connections" style={{ color: "#bcb0ff", textDecoration: "none" }}>Connect accounts & publish ↗</Link>
        </div>
        <span style={{ color: "#9299a6", fontSize: 12, letterSpacing: 2 }}>BLUEHAVEN / CREATOR OPERATIONS</span>
      </nav>
      <header style={{ padding: "44px 0 28px", maxWidth: 850 }}>
        <p style={{ color: "#ffde59", letterSpacing: 3, fontSize: 12 }}>CREATOR COMMAND CENTER / 01</p>
        <h1 style={{ fontSize: "clamp(38px,7vw,76px)", lineHeight: .98, letterSpacing: -3, margin: "16px 0" }}>All nine on standby.<br/><span style={{ color: "#9c8bff" }}>The right team runs.</span></h1>
        <p style={{ color: "#a9adb7", lineHeight: 1.7, fontSize: 17 }}>Send one prompt. Atlas routes it to the best-fit specialists, records the work in the company ledger, and leaves every other agent available for the next job.</p>
      </header>

      <section style={{ border: "1px solid #34303f", background: "#12151b", padding: 20, borderRadius: 14, marginBottom: 24 }}>
        <label style={{ display: "block", color: "#c4c8d0", fontSize: 12, marginBottom: 8 }}>CHO ADMIN TOKEN OR AGENT SERVICE TOKEN</label>
        <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Used in memory for authorized requests only" style={{ width: "100%", maxWidth: 600, boxSizing: "border-box", padding: 13, background: "#090b0f", border: "1px solid #363b45", borderRadius: 9, color: "#fff" }} />
        <p style={{ color: "#858b97", fontSize: 12, marginBottom: 0 }}>Token is not stored in the database. Never paste it into a prompt or repository.</p>
      </section>

      {error && <div role="alert" style={{ padding: 14, marginBottom: 16, border: "1px solid #824448", background: "#32191a", borderRadius: 9 }}>{error}</div>}
      {notice && <div role="status" style={{ padding: 14, marginBottom: 16, border: "1px solid #3a624a", background: "#12251a", borderRadius: 9 }}>{notice}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 18 }}>
        <section style={{ border: "1px solid #2b3038", background: "#12151b", padding: 22, borderRadius: 14 }}>
          <p style={{ color: "#ffde59", fontSize: 12, letterSpacing: 2 }}>01 / AUTO-DISPATCH</p>
          <h2 style={{ marginTop: 0 }}>Give the team a prompt</h2>
          <form onSubmit={runPrompt}>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} minLength={12} maxLength={6000} required style={{ width: "100%", minHeight: 190, resize: "vertical", boxSizing: "border-box", padding: 13, background: "#090b0f", border: "1px solid #363b45", borderRadius: 9, color: "#f4f0e8", font: "inherit", lineHeight: 1.55 }} />
            <button disabled={busy} style={{ width: "100%", marginTop: 12, padding: 14, border: 0, borderRadius: 9, background: "#ffde59", fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>{busy ? "ROUTING AND EXECUTING…" : "LET ATLAS PICK THE TEAM ↗"}</button>
          </form>
          <p style={{ color: "#9299a6", fontSize: 12, lineHeight: 1.5 }}>Agent outputs are model-backed deliverables. External actions like posting or pushing code remain gated until the corresponding connector is implemented and approved.</p>
        </section>

        <section style={{ border: "1px solid #2b3038", background: "#12151b", padding: 22, borderRadius: 14 }}>
          <p style={{ color: "#ffde59", fontSize: 12, letterSpacing: 2 }}>02 / THE STANDBY ROSTER</p>
          <h2 style={{ marginTop: 0 }}>Nine available agents</h2>
          <div style={{ display: "grid", gap: 8 }}>{agents.map((agent) => <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: "#0d1015", border: "1px solid #303540", borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: agent.status === "working" ? "#ffb547" : "#72d69a", flex: "0 0 auto" }} />
            <span style={{ flex: 1 }}><strong>{agent.name}</strong><span style={{ display: "block", color: "#9299a6", fontSize: 12, marginTop: 3 }}>{agent.department}</span></span>
            <span style={{ color: agent.status === "working" ? "#ffb547" : "#72d69a", fontSize: 10, letterSpacing: 1 }}>{(agent.status || "idle").toUpperCase()}</span>
          </div>)}</div>
        </section>
      </div>

      {mission && <section style={{ marginTop: 22, border: "1px solid #3b345c", background: "#171423", padding: 22, borderRadius: 14 }}>
        <p style={{ color: "#ffde59", fontSize: 12, letterSpacing: 2 }}>MISSION RESULT · {mission.succeeded}/{mission.total} CONTRIBUTIONS</p>
        <h2>Selected: {mission.selectedAgents?.join(", ") || "See results below"}</h2>
        <p style={{ color: "#b6b4c5", lineHeight: 1.6 }}>{mission.routingNote}</p>
        <p style={{ color: "#9299a6", fontSize: 12 }}>Standby: {mission.standbyAgents?.join(", ")}</p>
        <details><summary style={{ cursor: "pointer", color: "#d8d2ff" }}>Open coordination brief</summary><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{mission.coordinationBrief}</p></details>
        {mission.results?.map((result, i) => <details key={result.agent + i} style={{ borderTop: "1px solid #343044", padding: "14px 0" }}><summary style={{ cursor: "pointer" }}>{result.agent} · {result.status}</summary><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{result.output || result.error}</p></details>)}
      </section>}

      <section style={{ marginTop: 28 }}>
        <div style={{ marginBottom: 14 }}><p style={{ color: "#ffde59", fontSize: 12, letterSpacing: 2 }}>03 / SOCIAL CONNECTIONS</p><h2>Publishing readiness</h2><p style={{ color: "#a9adb7", lineHeight: 1.6 }}>Credentials are checked without exposing their values. A credential is not treated as a connected account until OAuth, permissions, and a live test are verified.</p></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>{providers.map((provider) => <article key={provider.id} style={{ padding: 16, background: "#12151b", border: "1px solid #2b3038", borderRadius: 12 }}>
          <strong>{provider.label}</strong>
          <p style={{ color: provider.status === "connected_verified" ? "#72d69a" : provider.status === "credentials_present_unverified" || provider.status === "connected_unverified" ? "#ffcf74" : "#9299a6", fontSize: 11, letterSpacing: 1 }}>{provider.status === "connected_verified" ? "ACCOUNT CONNECTED · IDENTITY VERIFIED" : provider.status === "connected_unverified" ? "OAUTH CONNECTED · TEST REQUIRED" : provider.status === "credentials_present_unverified" ? "APP CREDENTIALS PRESENT · ACCOUNT NOT VERIFIED" : provider.status === "reauthorization_required" ? "REAUTHORIZATION REQUIRED" : "SETUP REQUIRED"}</p>
          <p style={{ color: "#a9adb7", fontSize: 13, lineHeight: 1.5 }}>{provider.note}</p>
          {provider.missing.length > 0 && <details><summary style={{ cursor: "pointer", color: "#9c8bff", fontSize: 12 }}>Missing environment keys ({provider.missing.length})</summary><ul style={{ color: "#9299a6", fontSize: 12, paddingLeft: 18 }}>{provider.missing.map((name) => <li key={name}><code>{name}</code></li>)}</ul></details>}
        </article>)}</div>
      </section>

      <section style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 18 }}>
        <form onSubmit={saveDraft} style={{ border: "1px solid #2b3038", background: "#12151b", padding: 22, borderRadius: 14 }}>
          <p style={{ color: "#ffde59", fontSize: 12, letterSpacing: 2 }}>04 / DRAFT QUEUE</p><h2 style={{ marginTop: 0 }}>Prepare a post</h2>
          <label style={{ display: "block", color: "#a9adb7", fontSize: 12, marginBottom: 6 }}>Draft title</label><input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={180} placeholder="Campaign / post title" style={{ width: "100%", boxSizing: "border-box", padding: 12, background: "#090b0f", border: "1px solid #363b45", borderRadius: 8, color: "#fff", marginBottom: 12 }} />
          <label style={{ display: "block", color: "#a9adb7", fontSize: 12, marginBottom: 6 }}>Caption / post copy</label><textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} required minLength={5} maxLength={12000} placeholder="Write or paste the content to prepare for publishing…" style={{ width: "100%", minHeight: 140, boxSizing: "border-box", padding: 12, background: "#090b0f", border: "1px solid #363b45", borderRadius: 8, color: "#fff", font: "inherit", lineHeight: 1.5 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "14px 0" }}>{platformOptions.map((p) => <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#c4c8d0" }}><input type="checkbox" checked={platforms.includes(p.id)} onChange={() => togglePlatform(p.id)} />{p.label}</label>)}</div>
          <button disabled={busy || platforms.length === 0} style={{ width: "100%", padding: 13, background: "#9c8bff", border: 0, borderRadius: 8, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>SAVE DRAFT — DO NOT PUBLISH</button>
          <p style={{ color: "#9299a6", fontSize: 12, lineHeight: 1.5 }}>Live publishing is deliberately disabled until OAuth, provider permissions, token refresh, and CHO approval gates are verified.</p>
        </form>
        <section style={{ border: "1px solid #2b3038", background: "#12151b", padding: 22, borderRadius: 14 }}>
          <p style={{ color: "#ffde59", fontSize: 12, letterSpacing: 2 }}>05 / CONTENT QUEUE</p><h2 style={{ marginTop: 0 }}>Saved drafts</h2>
          {!token && <p style={{ color: "#9299a6" }}>Enter your token to load the private draft queue.</p>}
          {token && drafts.length === 0 && <p style={{ color: "#9299a6" }}>No drafts loaded yet. Save a draft to begin the queue.</p>}
          <div style={{ display: "grid", gap: 10 }}>{drafts.map((draft) => <article key={draft.id} style={{ padding: 12, border: "1px solid #303540", borderRadius: 8, background: "#0d1015" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{draft.title}</strong><span style={{ color: "#ffcf74", fontSize: 10 }}>{draft.status.toUpperCase()}</span></div><p style={{ color: "#a9adb7", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5 }}>{draft.body}</p><small style={{ color: "#9299a6" }}>{(draft.platforms || []).join(" · ")} · {new Date(draft.created_at).toLocaleString()}</small></article>)}</div>
        </section>
      </section>

      <footer style={{ borderTop: "1px solid #2a2d33", marginTop: 36, paddingTop: 18, color: "#7e8490", fontSize: 12 }}>BlueHaven Studios · Creativity Beyond Limits · Draft-first publishing · Human approval remains in control</footer>
    </div>
  </main>;
}
