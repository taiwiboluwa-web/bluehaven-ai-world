"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./company.css";

type Agent = { id: string; name: string; department: string; role_description: string; status: string; model_id?: string | null; connector_id: string };
type Task = { id: string; title: string; description: string; status: string; priority: string; created_by: string; result_summary?: string | null; agent_name?: string | null; department?: string | null; worker_name?: string | null; created_at: string; completed_at?: string | null };
type Hire = { id: string; proposed_name: string; role_title: string; business_case: string; estimated_monthly_cost: string; status: string; matthew_decision_note?: string | null; cho_decision_note?: string | null; created_at: string; agent_name: string; department: string };
type Brief = { id: string; brief_date: string; generated_at: string; summary: string; tasks_total: number; tasks_completed: number; tasks_failed: number; tasks_blocked: number; hiring_summary: Record<string, number>; notable_events: { tasks?: Task[]; hiringRequests?: Hire[]; auditEvents?: { actor_name: string; event_type: string; message: string; created_at: string }[] } };
type CompanyData = { people: { name: string; title: string; authority: string }[]; agents: Agent[]; workers: { id: string; name: string; role_title: string; status: string; manager_name: string; department: string }[]; tasks: Task[]; hiringRequests: Hire[]; notifications: { id: string; title: string; message: string; read_at: string | null; created_at: string }[]; dailyBriefs: Brief[]; connector: { configured: boolean; modelConfigured: boolean } };

function humanize(value: string) { return value.replaceAll("_", " "); }
function dateTime(value?: string | null) { return value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Not recorded"; }

export default function CompanyPage() {
  const [data, setData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [choToken, setChoToken] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentName, setAgentName] = useState("Atlas");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedBrief, setSelectedBrief] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/company", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load company data.");
      setData(result);
      setError("");
      setSelectedBrief((old) => old || result.dailyBriefs?.[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the company workspace.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!choToken || !title.trim()) { setMessage("Enter the CHO admin token and a task title."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${choToken}` },
        body: JSON.stringify({ action: "create_task", title: title.trim(), description: description.trim(), agentName, priority, createdBy: "CHO" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Task could not be created.");
      setTitle(""); setDescription(""); setMessage("Task added to the company ledger.");
      await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Task could not be created."); }
    finally { setSaving(false); }
  }

  async function decideHire(requestId: string, decision: "approve" | "reject") {
    if (!choToken) { setMessage("Enter the CHO admin token before making a hiring decision."); return; }
    const note = window.prompt(decision === "approve" ? "Approval note (optional):" : "Reason for declining (recommended):") || "";
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${choToken}` },
        body: JSON.stringify({ action: "cho_decision", requestId, decision, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Decision could not be saved.");
      setMessage(decision === "approve" ? "Hiring approved. The worker has now been added to the workforce." : "Hiring request declined and recorded.");
      await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Decision could not be saved."); }
    finally { setSaving(false); }
  }

  const brief = data?.dailyBriefs.find((item) => item.id === selectedBrief) || data?.dailyBriefs[0];
  const waitingForCho = data?.hiringRequests.filter((item) => ["pending_cho", "rejected_by_matthew"].includes(item.status)) || [];

  return <main className="company-shell">
    <header className="company-topbar">
      <Link href="/" className="company-brand"><span className="company-mark">B</span><span>BLUEHAVEN <i>AI WORLD</i></span></Link>
      <div className="company-top-actions"><span className="company-live"><i/> COMPANY SYSTEM</span><Link href="/company/command" className="company-command-link">Run AI mission ↗</Link><Link href="/creator-command-center" className="company-command-link">Creator Command Center ↗</Link><button onClick={() => { setLoading(true); void refresh(); }}>Refresh data ↻</button></div>
    </header>
    <section className="company-hero">
      <div><p className="company-eyebrow">EXECUTIVE OFFICE / COMPANY OPERATIONS</p><h1>The company<br/><em>behind the world.</em></h1><p>One human executive. One Chief of Staff. Ten AI department heads. Every task logged, every hire governed, every day accounted for.</p></div>
      <div className="company-authority"><span>FINAL AUTHORITY</span><strong>CHO</strong><small>Chief Human Officer</small><div className="authority-rule"/><strong>Matthew</strong><small>Chief of Staff · workforce coordination</small></div>
    </section>
    {error && <div className="company-alert">{error}</div>}
    {message && <div className="company-notice" role="status">{message}<button onClick={() => setMessage("")}>Dismiss</button></div>}
    <section className="company-metrics">
      <div><span>AI DEPARTMENT HEADS</span><strong>{data?.agents.length ?? "—"}</strong><small>All routed through one connector</small></div>
      <div><span>ACTIVE WORKERS</span><strong>{data?.workers.filter((w) => w.status === "active").length ?? "—"}</strong><small>Only approved hires enter the roster</small></div>
      <div><span>OPEN TASKS</span><strong>{data?.tasks.filter((t) => ["queued","in_progress","blocked"].includes(t.status)).length ?? "—"}</strong><small>Queued, in progress or blocked</small></div>
      <div><span>CHO ALERTS</span><strong>{data?.notifications.filter((n) => !n.read_at).length ?? "—"}</strong><small>Including Matthew&apos;s declined hires</small></div>
    </section>
    <section className="company-section">
      <div className="company-section-head"><div><span>01 / LEADERSHIP</span><h2>Executive chain</h2></div><p>Matthew coordinates. You retain final human authority.</p></div>
      <div className="leadership-grid">
        <article className="leader-card cho-card"><span className="leader-tag">HUMAN EXECUTIVE</span><div className="leader-avatar">CH</div><h3>CHO</h3><p>Chief Human Officer</p><ul><li>Final hiring approval</li><li>Receives escalation alerts</li><li>Reviews daily company briefs</li></ul></article>
        <article className="leader-card matthew-card"><span className="leader-tag">CHIEF OF STAFF</span><div className="leader-avatar">M</div><h3>Matthew</h3><p>Chief of Staff</p><ul><li>Reviews every worker request</li><li>Coordinates department heads</li><li>Cannot hire without CHO approval</li></ul></article>
      </div>
    </section>
    <section className="company-section">
      <div className="company-section-head"><div><span>02 / AI LEADERSHIP</span><h2>The ten department heads</h2></div><p><span className={data?.connector.configured && data.connector.modelConfigured ? "connector-ready" : "connector-pending"}>{data?.connector.configured && data.connector.modelConfigured ? "CONNECTOR CONFIGURED" : "CONNECTOR SETUP REQUIRED"}</span></p></div>
      <div className="department-grid">{(data?.agents || []).map((agent) => <article className="department-card" key={agent.id}><div className="department-card-top"><span className="department-avatar">{agent.name.slice(0,1)}</span><span className={`agent-state state-${agent.status}`}>{humanize(agent.status)}</span></div><h3>{agent.name}</h3><p className="department-name">{agent.department}</p><p>{agent.role_description}</p><div className="department-card-foot"><span>MODEL</span><strong>{agent.model_id || "Uses central default"}</strong><span className="connector-chip">{agent.connector_id}</span></div></article>)}</div>
    </section>
    <section className="company-section">
      <div className="company-section-head"><div><span>03 / TASK COMMAND</span><h2>Assign work</h2></div><p>Every assignment and outcome is recorded in the company ledger.</p></div>
      <div className="task-workspace">
        <form className="task-form" onSubmit={createTask}><div className="task-form-head"><span>CHO TASK ORDER</span><strong>New assignment</strong></div>
          <label>Task title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} placeholder="What needs to be done?" required/></label>
          <label>Brief / expected outcome<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} placeholder="Add context, constraints and what done looks like."/></label>
          <div className="task-form-row"><label>Department<select value={agentName} onChange={(e) => setAgentName(e.target.value)}>{(data?.agents || []).map((agent) => <option key={agent.id} value={agent.name}>{agent.name} — {agent.department}</option>)}</select></label><label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div>
          <label>CHO admin token <input type="password" autoComplete="off" value={choToken} onChange={(e) => setChoToken(e.target.value)} placeholder="Session only; not saved" required/></label>
          <small className="security-note">The token stays in this page&apos;s memory and is not written to the database or browser storage.</small>
          <button className="company-primary-button" disabled={saving || !data?.agents.length}>{saving ? "Working…" : "Add task to ledger ↗"}</button>
        </form>
        <div className="task-ledger"><div className="ledger-head"><span>RECENT ASSIGNMENTS</span><strong>{data?.tasks.length ?? 0} logged</strong></div>{loading && <p className="company-muted">Loading ledger…</p>}{!loading && !data?.tasks.length && <p className="company-muted">No tasks yet. New assignments will appear here.</p>}{(data?.tasks || []).slice(0,12).map((task) => <article className="ledger-task" key={task.id}><div><strong>{task.title}</strong><p>{task.agent_name || "Unassigned"}{task.worker_name ? ` · ${task.worker_name}` : ""} · {task.priority} priority</p>{task.result_summary && <small>{task.result_summary}</small>}</div><span className={`task-status task-${task.status}`}>{humanize(task.status)}</span></article>)}</div>
      </div>
    </section>
    <section className="company-section">
      <div className="company-section-head"><div><span>04 / WORKFORCE GOVERNANCE</span><h2>Hiring requires two approvals</h2></div><p>No worker can be created by an agent alone.</p></div>
      <div className="hiring-rule"><div><span>01</span><strong>Agent requests a worker</strong><p>Business case, role and estimated cost are recorded.</p></div><div><span>02</span><strong>Matthew reviews</strong><p>Approval forwards it to you. Rejection immediately creates a CHO alert.</p></div><div><span>03</span><strong>CHO decides</strong><p>Only your approval creates the named worker in the active workforce.</p></div></div>
      <div className="hiring-list"><div className="ledger-head"><span>REQUESTS NEEDING YOUR DECISION</span><strong>{waitingForCho.length} awaiting CHO</strong></div>{waitingForCho.length === 0 && <p className="company-muted">No hiring escalations are waiting for you.</p>}{waitingForCho.map((hire) => <article className="hiring-row" key={hire.id}><div className="hiring-person"><span className="department-avatar">{hire.proposed_name.slice(0,1).toUpperCase()}</span><div><strong>{hire.proposed_name}</strong><p>{hire.role_title} · for {hire.agent_name} / {hire.department}</p><small>{hire.business_case}</small>{hire.matthew_decision_note && <blockquote>Matthew: {hire.matthew_decision_note}</blockquote>}</div></div><div className="hiring-decision"><span className="task-status task-blocked">{humanize(hire.status)}</span><div><button disabled={saving} onClick={() => void decideHire(hire.id, "approve")}>Approve & hire</button><button disabled={saving} className="decline-button" onClick={() => void decideHire(hire.id, "reject")}>Decline</button></div></div></article>)}</div>
      <div className="hiring-list"><div className="ledger-head"><span>FULL REQUEST HISTORY</span><strong>{data?.hiringRequests.length ?? 0} requests</strong></div>{(data?.hiringRequests || []).slice(0,10).map((hire) => <article className="ledger-task" key={hire.id}><div><strong>{hire.proposed_name} — {hire.role_title}</strong><p>{hire.agent_name} · {dateTime(hire.created_at)}</p></div><span className={`task-status task-${hire.status === "hired" ? "completed" : hire.status.includes("reject") ? "failed" : "blocked"}`}>{humanize(hire.status)}</span></article>)}</div>
    </section>
    <section className="company-section">
      <div className="company-section-head"><div><span>05 / EXECUTIVE INBOX</span><h2>CHO notifications</h2></div><p>Matthew&apos;s hiring refusals and other escalations are recorded here.</p></div>
      <div className="notification-list">{(data?.notifications || []).slice(0,12).map((notification) => <article className="notification-row" key={notification.id}><span className="notification-mark">!</span><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{dateTime(notification.created_at)}</small></div><span className={notification.read_at ? "read-label" : "unread-label"}>{notification.read_at ? "READ" : "UNREAD"}</span></article>)}{!data?.notifications.length && <p className="company-muted">Your executive inbox is clear.</p>}</div>
    </section>
    <section className="company-section brief-section">
      <div className="company-section-head"><div><span>06 / DAILY ACCOUNTABILITY</span><h2>Your full-day brief</h2></div><p>Scheduled for 23:59 Africa/Lagos time, with tasks, results, hiring and audit events.</p></div>
      <div className="brief-layout"><aside className="brief-history"><span>BRIEF ARCHIVE</span>{(data?.dailyBriefs || []).map((item) => <button key={item.id} className={brief?.id === item.id ? "brief-selected" : ""} onClick={() => setSelectedBrief(item.id)}><strong>{item.brief_date}</strong><small>Generated {dateTime(item.generated_at)}</small></button>)}{!data?.dailyBriefs.length && <p className="company-muted">Your first scheduled brief will appear after the end-of-day run.</p>}</aside><article className="brief-paper"><div className="brief-paper-top"><span>BLUEHAVEN / EXECUTIVE REPORT</span><span>{brief?.brief_date || "AWAITING FIRST RUN"}</span></div>{brief ? <><h3>Daily operations<br/><em>in full.</em></h3><p className="brief-summary">{brief.summary}</p><div className="brief-counts"><div><strong>{brief.tasks_total}</strong><span>TASKS TOUCHED</span></div><div><strong>{brief.tasks_completed}</strong><span>COMPLETED</span></div><div><strong>{brief.tasks_failed}</strong><span>FAILED</span></div><div><strong>{brief.tasks_blocked}</strong><span>BLOCKED</span></div></div><h4>Task-by-task record</h4>{(brief.notable_events?.tasks || []).map((task) => <div className="brief-event" key={task.id}><strong>{task.title}</strong><span>{task.agent_name || "Unassigned"} · {humanize(task.status)}</span><p>{task.result_summary || task.description || "No completion summary recorded."}</p></div>)}<h4>Hiring decisions</h4>{(brief.notable_events?.hiringRequests || []).map((hire, index) => <div className="brief-event" key={hire.proposed_name + index}><strong>{hire.proposed_name} — {hire.role_title}</strong><span>{humanize(hire.status)} · requested by {hire.agent_name}</span><p>{hire.matthew_decision_note || hire.cho_decision_note || hire.business_case}</p></div>)}<h4>Activity and audit trail</h4>{(brief.notable_events?.auditEvents || []).map((event, index) => <div className="brief-event" key={event.event_type + index}><strong>{event.actor_name} · {humanize(event.event_type)}</strong><span>{dateTime(event.created_at)}</span><p>{event.message}</p></div>)}</> : <div className="brief-empty"><strong>No daily brief generated yet.</strong><p>The scheduled job will create a report from recorded work, results, hiring decisions and company audit events. A brief can only be complete when work is consistently logged.</p></div>}</article></div>
    </section>
    <footer className="company-footer"><Link href="/">← Return to the village</Link><span>BLUEHAVEN STUDIOS · CREATIVITY BEYOND LIMITS</span><span>EVERY TASK. EVERY DECISION. ACCOUNTED FOR.</span></footer>
  </main>;
}
