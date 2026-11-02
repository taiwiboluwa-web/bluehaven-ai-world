import Link from "next/link";

export type WorkspaceAction = { href: string; label: string };
export type WorkspaceMetric = { label: string; value: string; note?: string };
export function WorkspacePage({ eyebrow, title, accent, description, actions = [], metrics = [], children }: {
  eyebrow: string; title: string; accent?: string; description: string;
  actions?: WorkspaceAction[]; metrics?: WorkspaceMetric[]; children?: React.ReactNode;
}) {
  return <main className="workspace-page">
    <header className="workspace-hero">
      <div><p className="workspace-eyebrow">{eyebrow}</p><h1>{title} {accent && <em>{accent}</em>}</h1><p>{description}</p>
      {actions.length > 0 && <div className="workspace-actions">{actions.map((a) => <Link key={a.href} href={a.href}>{a.label} ↗</Link>)}</div>}</div>
    </header>
    {metrics.length > 0 && <section className="workspace-metrics">{metrics.map((m) => <article key={m.label}><span>{m.label}</span><strong>{m.value}</strong>{m.note && <small>{m.note}</small>}</article>)}</section>}
    {children}
  </main>;
}
export function WorkspaceSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="workspace-section"><div className="workspace-section-heading"><div><span>{eyebrow}</span><h2>{title}</h2></div></div>{children}</section>;
}
