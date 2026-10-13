"use client";

import { useState } from "react";
import WorldScene from "@/components/WorldScene";

const initialProjects = [
  { id: 1, name: "Knowledge Archive", kind: "DOCUMENT AI", status: "ACTIVE", description: "Answers questions from your files", tone: "gold" },
  { id: 2, name: "Scout Outpost", kind: "WEB RESEARCH", status: "ACTIVE", description: "Collects and organises web data", tone: "mint" },
  { id: 3, name: "Agent Forge", kind: "AI WORKFLOW", status: "IDLE", description: "Runs repeatable AI workflows", tone: "violet" },
];

export default function Home() {
  const [projects, setProjects] = useState(initialProjects);
  const [showWizard, setShowWizard] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("Answer questions using my documents");
  const [template, setTemplate] = useState("Document Question-Answering Agent");
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  function createProject() {
    if (!name.trim()) return;
    const id = Math.max(0, ...projects.map((p) => p.id)) + 1;
    setProjects((old) => [...old, { id, name: name.trim(), kind: template.toUpperCase(), status: "BUILDING", description: purpose, tone: "violet" }]);
    setBuildingId(id);
    setSelected(id);
    setName("");
    setShowWizard(false);
    window.setTimeout(() => {
      setProjects((old) => old.map((p) => p.id === id ? { ...p, status: "ACTIVE" } : p));
      setBuildingId((current) => current === id ? null : current);
    }, 6500);
  }

  const activeProject = projects.find((p) => p.id === selected);

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">B</span><span>BLUEHAVEN <i>AI WORLD</i></span></a><div className="top-status"><span className="online-dot" /> VILLAGE SYSTEMS ONLINE <span className="top-divider" /> <span className="profile">T</span></div></header>
    <section className="intro-row"><div><p className="kicker"><span /> YOUR IDEAS, BUILT INTO A WORLD</p><h1>Build something<br/><em>that comes alive.</em></h1><p className="intro-text">Your AI projects are more than cards on a screen. Give each one a place in your village, then watch your builder agents bring it to life.</p><button className="gold-button" onClick={() => setShowWizard(true)}>＋ Build a new project <span>↗</span></button></div><div className="village-stats"><div><strong>{projects.length.toString().padStart(2,"0")}</strong><span>PROJECT BUILDINGS</span></div><div><strong>{projects.filter((p) => p.status === "ACTIVE").length.toString().padStart(2,"0")}</strong><span>AGENTS ACTIVE</span></div><div><strong>{projects.filter((p) => p.status === "BUILDING").length.toString().padStart(2,"0")}</strong><span>UNDER CONSTRUCTION</span></div></div></section>
    <section className="world-section"><div className="world-heading"><div><span className="section-tag">01 / THE OVERWORLD</span><h2>Your village</h2></div><div className="world-legend"><span><i className="legend-green" /> Active</span><span><i className="legend-gold" /> Building</span><span className="camera-hint">DRAG TO ROTATE · SCROLL TO ZOOM</span></div></div><div className="scene-wrap"><WorldScene projects={projects} buildingId={buildingId} onSelect={setSelected}/><div className="map-compass">N<br/><span>＋</span></div><div className="scene-bottom"><span>BH / WORLD 001</span><span>THE CREATIVE FRONTIER</span><span>ISOMETRIC VIEW</span></div></div></section>
    <section className="projects-section"><div className="project-heading"><div><span className="section-tag">02 / YOUR BUILDINGS</span><h2>Project ledger <span>{projects.length.toString().padStart(2,"0")}</span></h2></div><button className="text-button" onClick={() => setShowWizard(true)}>＋ New building</button></div><div className="project-list">{projects.map((p) => <button className={`project-row ${selected === p.id ? "is-selected" : ""}`} key={p.id} onClick={() => setSelected(p.id)}><span className={`project-glyph ${p.tone}`}>{p.kind.includes("DOCUMENT") ? "▤" : p.kind.includes("WEB") ? "⌖" : "✳"}</span><span className="project-main"><strong>{p.name}</strong><small>{p.description}</small></span><span className="project-kind">{p.kind}</span><span className={`status-pill ${p.status.toLowerCase()}`}><i />{p.status === "BUILDING" ? "CONSTRUCTING" : p.status}</span><span className="row-arrow">↗</span></button>)}</div></section>
    <footer className="footer"><span>BLUEHAVEN STUDIOS</span><span>CREATIVITY BEYOND LIMITS</span><span>THE WORLD GROWS WITH YOU.</span></footer>

    {showWizard && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowWizard(false); }}><section className="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title"><div className="modal-top"><span className="section-tag">NEW CONSTRUCTION / STEP 01</span><button className="close-button" onClick={() => setShowWizard(false)} aria-label="Close">×</button></div><h2 id="wizard-title">Name your <em>next build.</em></h2><p className="modal-copy">Choose what this agent does. Your builder will find a plot and raise its building in the village.</p><label>PROJECT NAME<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer Support Archive" maxLength={60}/></label><label>WHAT SHOULD THIS AGENT DO?<textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3}/></label><label>STARTING TEMPLATE<select value={template} onChange={(e) => setTemplate(e.target.value)}><option>Document Question-Answering Agent</option><option>Web Research Scout</option><option>AI Workflow Forge</option><option>API Integration Gateway</option><option>Custom AI Agent</option></select></label><div className="wizard-note"><span>⌂</span><p><strong>Builder deployment</strong><br/>A builder agent will travel to a free plot, raise scaffolding, and construct your project building.</p></div><button className="gold-button modal-submit" disabled={!name.trim()} onClick={createProject}>Choose plot & build <span>↗</span></button></section></div>}

    {activeProject && !showWizard && <aside className="detail-panel"><button className="close-button" onClick={() => setSelected(null)} aria-label="Close details">×</button><span className="section-tag">BUILDING DETAILS / BH-{String(activeProject.id).padStart(3,"0")}</span><h3>{activeProject.name}</h3><p>{activeProject.description}</p><div className={`status-pill ${activeProject.status.toLowerCase()}`}><i />{activeProject.status === "BUILDING" ? "CONSTRUCTING" : activeProject.status}</div><div className="detail-divider"/><span className="detail-label">PROJECT TEMPLATE</span><strong className="detail-value">{activeProject.kind}</strong><span className="detail-label">BUILDER SYSTEM</span><strong className="detail-value">{activeProject.status === "BUILDING" ? "Builder agent dispatched" : "Village builder network"}</strong>{activeProject.status === "BUILDING" && <div className="progress-track"><span/></div>}<button className="detail-action" onClick={() => setSelected(null)}>Back to village <span>↗</span></button></aside>}
  </main>;
}
