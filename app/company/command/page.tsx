"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Agent = { id: string; name: string; department: string; role_description: string };
type Outcome = { agent: string; department: string; taskId: string; status: "completed" | "failed"; output?: string; error?: string; model?: string };
type Mission = { missionId: string; goal: string; coordinationBrief: string; finalAnswer?: string; status: string; succeeded: number; total: number; results: Outcome[] };

const defaults = ["Forge", "Quinn"];
type DispatchMode = "auto" | "manual";
const suggestions = [
  "Plan a new BlueHaven service launch with deliverables, timeline, risks, and quality checks.",
  "Review a website feature idea and produce an implementation plan, content outline, and QA checklist.",
  "Create a practical growth plan for BlueHaven Studios with measurable experiments and reporting."
];

export default function CompanyCommandPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<string[]>(defaults);
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>("auto");
  const [goal, setGoal] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mission, setMission] = useState<Mission | null>(null);

  useEffect(() => {
    fetch("/api/company", { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load company roster."); return d; })
      .then((d) => setAgents(d.agents || []))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load company roster."));
  }, []);

  function toggle(name: string) {
    setSelected((old) => old.includes(name) ? old.filter((n) => n !== name) : old.length >= 4 ? old : [...old, name]);
  }

  async function runMission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dispatchMode === "manual" && selected.length < 2) { setError("Choose at least two specialist agents."); return; }
    setLoading(true); setError(""); setMission(null);
    try {
      const response = await fetch("/api/company/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goal, dispatchMode, ...(dispatchMode === "manual" ? { agentNames: selected } : {}) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mission failed.");
      setMission(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mission failed.");
    } finally { setLoading(false); }
  }

  return <main style={{ minHeight: "100vh", background: "#0b0d11", color: "#f4f0e8", fontFamily: "Arial, sans-serif", padding: "clamp(20px, 5vw, 64px)", boxSizing: "border-box" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", borderBottom: "1px solid #2a2d33", paddingBottom: 20 }}>
        <Link href="/company" style={{ color: "#ffde59", textDecoration: "none" }}>← COMPANY HQ</Link>
        <span style={{ color: "#8f96a3", fontSize: 12, letterSpacing: 2 }}>BLUEHAVEN / MULTI-AGENT OPERATIONS</span>
      </nav>
      <header style={{ padding: "48px 0 30px", maxWidth: 800 }}>
        <p style={{ color: "#ffde59", letterSpacing: 3, fontSize: 12 }}>COMMAND LAYER / 01</p>
        <h1 style={{ fontSize: "clamp(38px, 7vw, 76px)", lineHeight: 0.98, letterSpacing: -3, margin: "16px 0" }}>Give the company<br/><span style={{ color: "#9c8bff" }}>a real mission.</span></h1>
        <p style={{ color: "#a9adb7", lineHeight: 1.7, fontSize: 17 }}>One goal. A coordination brief from Atlas. Department leads produce separate work products, report outcomes, and leave an audit trail in the company ledger.</p>
      </header>

      <form onSubmit={runMission} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)", gap: 20, alignItems: "start" }}>
        <section style={{ background: "#12151b", border: "1px solid #2b3038", padding: 24, borderRadius: 16 }}>
          <label style={{ display: "block", color: "#c4c8d0", fontSize: 13, marginBottom: 10 }}>MISSION BRIEF</label>
          <div role="group" aria-label="Team selection mode" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
            <button type="button" onClick={() => setDispatchMode("auto")} aria-pressed={dispatchMode === "auto"} style={{ padding: "12px 14px", textAlign: "left", borderRadius: 9, cursor: "pointer", border: dispatchMode === "auto" ? "1px solid #ffde59" : "1px solid #343a45", background: dispatchMode === "auto" ? "#292512" : "#0d1015", color: "#f4f0e8" }}>
              <strong>Let Atlas pick the team</strong><span style={{ display: "block", marginTop: 5, color: "#a9adb7", fontSize: 12 }}>Recommended · route by task fit</span>
            </button>
            <button type="button" onClick={() => setDispatchMode("manual")} aria-pressed={dispatchMode === "manual"} style={{ padding: "12px 14px", textAlign: "left", borderRadius: 9, cursor: "pointer", border: dispatchMode === "manual" ? "1px solid #9c8bff" : "1px solid #343a45", background: dispatchMode === "manual" ? "#211d35" : "#0d1015", color: "#f4f0e8" }}>
              <strong>Choose specialists</strong><span style={{ display: "block", marginTop: 5, color: "#a9adb7", fontSize: 12 }}>Manually choose 2–4 agents</span>
            </button>
          </div>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} required minLength={12} maxLength={6000} placeholder="Describe the outcome, context, constraints, and what done looks like…" style={{ width: "100%", minHeight: 190, resize: "vertical", boxSizing: "border-box", padding: 16, background: "#090b0f", border: "1px solid #363b45", borderRadius: 10, color: "#f4f0e8", font: "inherit", lineHeight: 1.6 }} />
          <div style={{ marginTop: 18, color: "#9fa4af", fontSize: 12 }}>QUICK STARTS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{suggestions.map((s) => <button key={s} type="button" onClick={() => setGoal(s)} style={{ background: "#1a1e26", color: "#cbd0db", border: "1px solid #343a45", borderRadius: 8, padding: "9px 11px", cursor: "pointer", textAlign: "left" }}>{s}</button>)}</div>
          <label style={{ display: "block", color: "#c4c8d0", fontSize: 13, margin: "22px 0 8px" }}>CHO ADMIN TOKEN OR AGENT SERVICE TOKEN</label>
          <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} required placeholder="Used for this request only; never saved" style={{ width: "100%", boxSizing: "border-box", padding: 13, background: "#090b0f", border: "1px solid #363b45", borderRadius: 9, color: "#fff" }} />
          <p style={{ color: "#858b97", fontSize: 12, lineHeight: 1.6 }}>The token remains in this page&apos;s memory. This version runs model-backed work and records results; it does not silently access shell, browser, GitHub, email, or deployment tools.</p>
          <button disabled={loading} type="submit" style={{ marginTop: 12, width: "100%", border: 0, borderRadius: 10, padding: 15, background: loading ? "#746b42" : "#ffde59", color: "#141414", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>{loading ? "COORDINATING AGENTS…" : "START COLLABORATIVE MISSION ↗"}</button>
        </section>

        <section style={{ background: "#12151b", border: "1px solid #2b3038", padding: 24, borderRadius: 16 }}>
          <div style={{ color: "#ffde59", fontSize: 12, letterSpacing: 2 }}>AVAILABLE DEPARTMENT HEADS</div>
          <p style={{ color: "#9fa4af", fontSize: 13, lineHeight: 1.6 }}>{dispatchMode === "auto" ? "Atlas selects the smallest relevant specialist team from your goal. These checkboxes are ignored in auto mode." : "Choose 2–4 specialists. Atlas coordinates the mission and is not a specialist option."}</p>
          <div style={{ display: "grid", gap: 8 }}>{agents.map((agent) => {
            const checked = selected.includes(agent.name);
            return <label key={agent.id} style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: 12, border: `1px solid ${checked ? "#8170e8" : "#303540"}`, background: checked ? "#211d35" : "#0d1015", borderRadius: 10, cursor: dispatchMode === "auto" ? "default" : selected.length >= 4 && !checked ? "not-allowed" : "pointer" }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(agent.name)} disabled={dispatchMode === "auto" || (selected.length >= 4 && !checked)} style={{ marginTop: 3, accentColor: "#9c8bff" }}/>
              <span><strong>{agent.name}</strong><span style={{ display: "block", color: "#a2a8b3", fontSize: 12, marginTop: 3 }}>{agent.department}</span><span style={{ display: "block", color: "#7e8490", fontSize: 12, marginTop: 5, lineHeight: 1.45 }}>{agent.role_description}</span></span>
            </label>;
          })}</div>
          <div style={{ color: "#9fa4af", fontSize: 12, marginTop: 14 }}>{dispatchMode === "auto" ? "Atlas selects 1–4 specialists automatically." : `${selected.length}/4 selected · minimum 2`}</div>
        </section>
      </form>

      {error && <div role="alert" style={{ marginTop: 20, padding: 16, background: "#32191a", border: "1px solid #824448", color: "#ffd9da", borderRadius: 10 }}>{error}</div>}
      {loading && <div role="status" style={{ marginTop: 20, padding: 22, border: "1px solid #3b345c", background: "#171423", borderRadius: 12 }}>The coordinator is preparing the brief, then each selected agent will work through the shared gateway. This can take up to a few minutes.</div>}
      {mission && <section style={{ marginTop: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <div><div style={{ color: "#ffde59", fontSize: 12, letterSpacing: 2 }}>MISSION REPORT</div><h2 style={{ fontSize: 30, margin: "8px 0" }}>{mission.succeeded}/{mission.total} agent contributions completed</h2></div>
          <span style={{ border: "1px solid #5a536f", padding: "8px 12px", borderRadius: 30, color: mission.status === "completed" ? "#a6f0c0" : "#ffcf9c" }}>{mission.status.toUpperCase()}</span>
        </div>
        <article style={{ padding: 22, border: "1px solid #383343", background: "#15131e", borderRadius: 14, marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Atlas · coordination brief</h3><pre style={{ whiteSpace: "pre-wrap", font: "inherit", lineHeight: 1.7, color: "#c8c3d7" }}>{mission.coordinationBrief}</pre>
        </article>
        <div style={{ display: "grid", gap: 14 }}>{mission.results.map((r) => <article key={r.taskId} style={{ padding: 22, border: "1px solid #303540", background: "#12151b", borderRadius: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}><div><h3 style={{ margin: 0 }}>{r.agent} <span style={{ color: "#8f96a3", fontWeight: 400 }}>· {r.department}</span></h3><p style={{ color: "#818895", fontSize: 12 }}>Task ledger ID: {r.taskId}{r.model ? ` · ${r.model}` : ""}</p></div><span style={{ color: r.status === "completed" ? "#a6f0c0" : "#ffb0a8" }}>{r.status.toUpperCase()}</span></div>
          {r.output ? <pre style={{ whiteSpace: "pre-wrap", font: "inherit", lineHeight: 1.75, color: "#d6d9df" }}>{r.output}</pre> : <p style={{ color: "#ffb0a8" }}>{r.error}</p>}
        </article>)}</div>
        <p style={{ color: "#8f96a3", fontSize: 12, lineHeight: 1.6 }}>The mission and department contributions are saved in the company task ledger and audit trail. Model output is work product, not proof of external execution.</p>
      </section>}
      <footer style={{ borderTop: "1px solid #2a2d33", marginTop: 44, paddingTop: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: "#737a86", fontSize: 12 }}><span>BLUEHAVEN AI WORLD · EXECUTION WITH ACCOUNTABILITY</span><Link href="/" style={{ color: "#ffde59" }}>RETURN TO VILLAGE ↗</Link></footer>
    </div>
    <style>{`@media (max-width: 800px) { form { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
  </main>;
}
