"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useWorldStore, type DistrictId } from "@/lib/world-store";

const WorldScene = dynamic(() => import("@/components/WorldScene"), {
  ssr: false,
  loading: () => <div className="scene-loading" role="status">Preparing your village…</div>,
});

type Project = {
  id: string;
  name: string;
  kind: string;
  status: string;
  description: string;
  purpose: string;
  template: string;
  tone: string;
  gridX?: number;
  gridZ?: number;
  lastError?: string | null;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    planned: "PLANNED",
    awaiting_construction: "AWAITING BUILD",
    under_construction: "CONSTRUCTING",
    initializing: "INITIALIZING",
    active: "ACTIVE",
    processing: "PROCESSING",
    paused: "PAUSED",
    updating: "UPDATING",
    failed: "BUILD FAILED",
    offline: "OFFLINE",
  };
  return labels[status] || status.toUpperCase();
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("Answer questions using my documents");
  const [template, setTemplate] = useState("Document Question-Answering Agent");
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const syncProjects = useWorldStore((state) => state.syncProjects);

  async function refreshProjects() {
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load the village.");
      setProjects(data.projects || []);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not connect to the project service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refreshProjects(); }, []);
  useEffect(() => { syncProjects(projects); }, [projects, syncProjects]);

  async function createProject() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setActionError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), purpose: purpose.trim(), template }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Project creation failed.");
      const created = data.project as Project;
      setProjects((old) => [...old, created]);
      setBuildingId(created.id);
      setSelected(created.id);
      setName("");
      setShowWizard(false);

      // The animation window is followed by a real backend/gateway health check.
      window.setTimeout(async () => {
        try {
          const result = await fetch(`/api/projects/${created.id}/construction`, { method: "POST" });
          const resultData = await result.json();
          if (!result.ok) setActionError(resultData.error || "The building could not be activated.");
        } catch {
          setActionError("The construction service could not be reached. Refresh to check the saved project.");
        } finally {
          setBuildingId((current) => current === created.id ? null : current);
          await refreshProjects();
        }
      }, 7000);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Project creation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function reactivateOfflineProjects() {
    setActionError("");
    setLoading(true);
    try {
      const response = await fetch("/api/projects/reactivate", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not bring offline projects back online.");
      await refreshProjects();
      setActionError(data.reactivated === 0 ? "There are no offline projects to reactivate." : "");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not reactivate offline projects.");
      setLoading(false);
    }
  }

  async function projectAction(id: string, action: "pause" | "resume" | "stop") {
    setActionError("");
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update project.");
      await refreshProjects();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not update project.");
    }
  }

  const selectedDistrict = useWorldStore((state) => state.selectedDistrict);
  const setSelectedDistrict = useWorldStore((state) => state.setSelectedDistrict);

  function handleDistrictSelect(district: DistrictId) {
    setSelectedDistrict(district);
    if (district === "builder") {
      setSelectedDistrict(null);
      setActionError("");
      setShowWizard(true);
    } else if (district === "hq") {
      window.location.href = "/company";
    }
  }

  const activeProject = projects.find((p) => p.id === selected);

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">B</span><span>BLUEHAVEN <i>AI WORLD</i></span></a><div className="top-status"><span className="online-dot" /> WORKSPACE CONTROL <span className="top-divider" /> <a className="company-hq-link" href="/company">COMPANY HQ ↗</a> <span className="profile">B</span></div></header>
    <section className="intro-row"><div><p className="kicker"><span /> BUILDER BASE / LEVEL 01</p><h1>Your AI village.<br/><em>Your rules.</em></h1><p className="intro-text">Build a living AI company in a 3D village. Create agents, give them dedicated buildings, and track real deployment status backed by your workspace services.</p><button className="gold-button" onClick={() => { setActionError(""); setShowWizard(true); }}>＋ Build a new project <span>↗</span></button></div><div className="village-stats"><div><strong>{projects.length.toString().padStart(2,"0")}</strong><span>PROJECT BUILDINGS</span></div><div><strong>{projects.filter((p) => ["active","processing"].includes(p.status)).length.toString().padStart(2,"0")}</strong><span>ACTIVE PROJECTS</span></div><div><strong>{projects.filter((p) => ["under_construction","initializing"].includes(p.status)).length.toString().padStart(2,"0")}</strong><span>UNDER CONSTRUCTION</span></div></div></section>
    <section className="world-section"><div className="world-heading"><div><span className="section-tag">01 / LIVE WORLD MAP</span><h2>World overview</h2></div><div className="world-legend"><span><i className="legend-green" /> Active</span><span><i className="legend-gold" /> Building</span><span className="camera-hint">DRAG TO ROTATE · SCROLL TO ZOOM</span></div></div>
      {loadError && <div className="service-alert" role="alert"><strong>Village connection issue</strong><span>{loadError}</span><button onClick={() => { setLoading(true); void refreshProjects(); }}>Retry</button></div>}
      {actionError && <div className="service-alert" role="alert"><strong>Action needs attention</strong><span>{actionError}</span><button onClick={() => setActionError("")}>Dismiss</button></div>}
      <div className="scene-wrap"><WorldScene projects={projects} buildingId={buildingId} onSelect={setSelected} onDistrictSelect={handleDistrictSelect}/><div className="village-ribbon"><span className="ribbon-level">01</span><span><b>BLUEHAVEN VILLAGE</b><small>{projects.length} BUILT PLOTS · SHARED WORLD</small></span><span className="ribbon-live"><i/> {loading ? "SYNCING" : "LIVE"}</span></div><div className="village-rail" aria-label="Village controls"><button title="Build a project" aria-label="Build a project" onClick={() => { setActionError(""); setShowWizard(true); }}><b>＋</b><small>BUILD</small></button><button title="View project roster" aria-label="View project roster" onClick={() => document.getElementById("project-operations")?.scrollIntoView({behavior:"smooth"})}><b>⌂</b><small>ROSTER</small></button><button title="Refresh village" aria-label="Refresh village" onClick={() => { setLoading(true); void refreshProjects(); }}><b>↻</b><small>SYNC</small></button></div><div className="builder-tip"><span className="builder-avatar">B</span><span><b>BUILDER</b><small>{buildingId ? "CONSTRUCTION IN PROGRESS" : "READY FOR ORDERS"}</small></span><i className={buildingId ? "builder-working" : ""}/></div><div className="map-compass">N<br/><span>＋</span></div><div className="scene-bottom"><span>BH / WORLD 001</span><span>PROJECT DISTRICT</span><span>{loading ? "SYNCING WORLD…" : "DRAG TO ROTATE · SCROLL TO ZOOM"}</span></div></div></section>
    <section className="districts-section" aria-labelledby="districts-title"><div className="districts-heading"><div><span className="section-tag">WORLD SYSTEMS / YOUR AI COMPANY</span><h2 id="districts-title">Explore your village</h2></div><p>Tap a landmark on the 3D map or choose a district here to open its workspace.</p></div><div className="district-grid">
      <button type="button" className="district-item district-hq" onClick={() => handleDistrictSelect("hq")}><span className="district-index">01</span><span className="district-symbol">⌂</span><div><h3>BlueHaven HQ</h3><p>Open the company command centre, teams, and operational overview.</p></div><span className="district-state">OPEN COMPANY HQ ↗</span></button>
      <button type="button" className="district-item district-builder" onClick={() => handleDistrictSelect("builder")}><span className="district-index">02</span><span className="district-symbol">⚒</span><div><h3>Builder Hut</h3><p>Create a project, reserve a plot, and run the real gateway validation.</p></div><span className="district-state">CREATE PROJECT +</span></button>
      <button type="button" className="district-item district-archive" onClick={() => handleDistrictSelect("archive")}><span className="district-index">03</span><span className="district-symbol">▤</span><div><h3>Knowledge Archive</h3><p>Dedicated district for document-grounded agents and knowledge tools.</p></div><span className="district-state">WORKSPACE STATUS</span></button>
      <button type="button" className="district-item district-infra" onClick={() => handleDistrictSelect("infrastructure")}><span className="district-index">04</span><span className="district-symbol">⌘</span><div><h3>AI Infrastructure</h3><p>Project persistence in Neon and server-side model gateway validation.</p></div><span className="district-state">SYSTEM STATUS</span></button>
    </div>
    {selectedDistrict && selectedDistrict !== "hq" && selectedDistrict !== "builder" && <aside className="district-detail" aria-live="polite"><button className="close-button" onClick={() => setSelectedDistrict(null)} aria-label="Close district details">×</button>{selectedDistrict === "archive" ? <><span className="section-tag">DISTRICT 03 / KNOWLEDGE</span><h3>Knowledge Archive</h3><p>Document Question-Answering Agent is available as a project template. A standalone upload, indexing, and source-management archive is not yet connected, so this panel does not pretend documents have been ingested.</p><button className="text-button" onClick={() => { setSelectedDistrict(null); setTemplate("Document Question-Answering Agent"); setShowWizard(true); }}>Create a document agent ↗</button></> : <><span className="section-tag">DISTRICT 04 / INFRASTRUCTURE</span><h3>AI Infrastructure</h3><p>Project records and jobs are persisted through the Neon-backed API. Project activation checks the configured server-side gateway and model availability; a successful visual build alone never marks a project active.</p><p className="district-detail-note">Secrets stay server-side. Configure DATABASE_URL, AI_GATEWAY_API_KEY, and AI_DEFAULT_MODEL in the deployment environment.</p></>}</aside>}
    </section>
    <section className="projects-section" id="project-operations"><div className="project-heading"><div><span className="section-tag">02 / PROJECT OPERATIONS</span><h2>Projects <span>{projects.length.toString().padStart(2,"0")}</span></h2></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="text-button" onClick={() => void reactivateOfflineProjects()} disabled={loading || !projects.some((p) => p.status === "offline")}>↻ Bring all offline online ({projects.filter((p) => p.status === "offline").length})</button><button className="text-button" onClick={() => setShowWizard(true)}>＋ New building</button></div></div>
      <div className="project-list">{!loading && projects.length === 0 && !loadError && <div className="empty-ledger"><strong>Your village is ready for its first build.</strong><span>Create a project to reserve a plot and save its building to Neon.</span><button className="text-button" onClick={() => setShowWizard(true)}>＋ Build your first project</button></div>}
      {projects.map((p) => <button className={`project-row ${selected === p.id ? "is-selected" : ""}`} key={p.id} onClick={() => setSelected(p.id)}><span className={`project-glyph ${p.tone}`}>{p.kind.includes("DOCUMENT") ? "▤" : p.kind.includes("WEB") ? "⌖" : "✳"}</span><span className="project-main"><strong>{p.name}</strong><small>{p.description}</small></span><span className="project-kind">{p.kind}</span><span className={`status-pill ${p.status === "under_construction" || p.status === "initializing" ? "building" : p.status === "active" || p.status === "processing" ? "active" : p.status === "failed" ? "failed" : "idle"}`}><i />{statusLabel(p.status)}</span><span className="row-arrow">↗</span></button>)}</div></section>
    <footer className="footer"><span>BLUEHAVEN STUDIOS</span><span>CREATIVITY BEYOND LIMITS</span><span>THE WORLD GROWS WITH YOU.</span></footer>

    {showWizard && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setShowWizard(false); }}><section className="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title"><div className="modal-top"><span className="section-tag">NEW CONSTRUCTION / STEP 01</span><button className="close-button" onClick={() => setShowWizard(false)} aria-label="Close">×</button></div><h2 id="wizard-title">Name your <em>next build.</em></h2><p className="modal-copy">Choose what this agent does. Your builder will reserve a plot, save the project, and verify the AI gateway before the building becomes operational.</p><label>PROJECT NAME<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer Support Archive" maxLength={80}/></label><label>WHAT SHOULD THIS AGENT DO?<textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} maxLength={2000}/></label><label>STARTING TEMPLATE<select value={template} onChange={(e) => setTemplate(e.target.value)}><option>Document Question-Answering Agent</option><option>Web Research Scout</option><option>AI Workflow Forge</option><option>API Integration Gateway</option><option>Custom AI Agent</option></select></label><div className="wizard-note"><span>⌂</span><p><strong>Builder deployment</strong><br/>The project and job are saved in Neon. The building activates only after the server confirms that the AI gateway is configured and reachable.</p></div><button className="gold-button modal-submit" disabled={!name.trim() || !purpose.trim() || saving} onClick={createProject}>{saving ? "Saving project…" : "Choose plot & build"} <span>↗</span></button></section></div>}

    {activeProject && !showWizard && <aside className="detail-panel"><button className="close-button" onClick={() => setSelected(null)} aria-label="Close details">×</button><span className="section-tag">BUILDING DETAILS / {activeProject.id.slice(0,8).toUpperCase()}</span><h3>{activeProject.name}</h3><p>{activeProject.description}</p><div className={`status-pill ${activeProject.status === "under_construction" || activeProject.status === "initializing" ? "building" : activeProject.status === "active" ? "active" : activeProject.status === "failed" ? "failed" : "idle"}`}><i />{statusLabel(activeProject.status)}</div>{activeProject.lastError && <p className="detail-error">{activeProject.lastError}</p>}<div className="detail-divider"/><span className="detail-label">PROJECT TEMPLATE</span><strong className="detail-value">{activeProject.template}</strong><span className="detail-label">VILLAGE COORDINATES</span><strong className="detail-value">{activeProject.gridX ?? "—"} / {activeProject.gridZ ?? "—"}</strong><span className="detail-label">BUILDER SYSTEM</span><strong className="detail-value">{activeProject.status === "under_construction" || activeProject.status === "initializing" ? "Construction / gateway check" : activeProject.status === "active" ? "Operational" : activeProject.status === "failed" ? "Needs configuration or retry" : "Saved project"}</strong>{activeProject.status === "under_construction" && <div className="progress-track"><span/></div>}<div className="detail-actions">{activeProject.status === "active" && <button className="detail-action" onClick={() => void projectAction(activeProject.id,"pause")}>Pause agent <span>Ⅱ</span></button>}{activeProject.status === "paused" && <button className="detail-action" onClick={() => void projectAction(activeProject.id,"resume")}>Resume agent <span>↗</span></button>}{!["offline","under_construction","initializing"].includes(activeProject.status) && <button className="detail-action" onClick={() => void projectAction(activeProject.id,"stop")}>Stop agent <span>×</span></button>}</div><button className="detail-action" onClick={() => setSelected(null)}>Back to village <span>↗</span></button></aside>}
  </main>;
}
