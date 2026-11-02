import Link from "next/link";
import { getSql } from "@/lib/db";
import styles from "./video-studio.module.css";

export const dynamic = "force-dynamic";

type Summary = {
  projects: number;
  jobs: number;
  completed: number;
  awaiting: number;
};

type RecentJob = {
  id: string;
  project_name: string;
  status: string;
  progress: number;
  created_at: string;
};

async function loadStudio() {
  const empty: { summary: Summary; jobs: RecentJob[]; ready: boolean } = {
    summary: { projects: 0, jobs: 0, completed: 0, awaiting: 0 },
    jobs: [],
    ready: false,
  };
  try {
    const sql = getSql();
    const [summaryRows, jobs] = await Promise.all([
      sql`
        SELECT
          (SELECT count(*)::int FROM video_projects p JOIN video_workspaces w ON w.id = p.workspace_id WHERE w.slug = 'bluehaven-studios' AND p.status = 'active') AS projects,
          (SELECT count(*)::int FROM video_jobs j JOIN video_workspaces w ON w.id = j.workspace_id WHERE w.slug = 'bluehaven-studios') AS jobs,
          (SELECT count(*)::int FROM video_jobs j JOIN video_workspaces w ON w.id = j.workspace_id WHERE w.slug = 'bluehaven-studios' AND j.status = 'completed') AS completed,
          (SELECT count(*)::int FROM video_jobs j JOIN video_workspaces w ON w.id = j.workspace_id WHERE w.slug = 'bluehaven-studios' AND j.status = 'awaiting_approval') AS awaiting
      `,
      sql`
        SELECT j.id, p.name AS project_name, j.status, j.progress, j.created_at
        FROM video_jobs j
        JOIN video_projects p ON p.id = j.project_id
        JOIN video_workspaces w ON w.id = j.workspace_id
        WHERE w.slug = 'bluehaven-studios'
        ORDER BY j.created_at DESC
        LIMIT 6
      `,
    ]);
    return {
      summary: (summaryRows[0] as Summary) || empty.summary,
      jobs: jobs as RecentJob[],
      ready: true,
    };
  } catch {
    return empty;
  }
}

function prettyStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default async function VideoStudioPage() {
  const data = await loadStudio();
  const engineReady = process.env.VIDEO_ENGINE_ENABLED === "true" &&
    Boolean(process.env.VIDEO_ENGINE_BASE_URL && process.env.VIDEO_ENGINE_API_KEY);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.wordmark}>BLUEHAVEN <span>AI WORLD</span></Link>
        <div className={styles.topActions}>
          <span className={styles.privateTag}>PRIVATE WORKSPACE</span>
          <Link href="/" className={styles.backLink}>Back to AI World</Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.eyebrow}><span /> CREATIVE PRODUCTION SYSTEM</div>
        <h1>AI Video <em>Studio</em></h1>
        <p className={styles.intro}>From a simple idea to a finished video. Plan, direct, produce and review every frame from one BlueHaven workspace.</p>
        <div className={styles.heroMeta}>
          <span>CREATIVITY BEYOND LIMITS</span>
          <span>WORKSPACE / VIDEO-001</span>
        </div>
      </section>

      <section className={styles.statusPanel}>
        <div>
          <div className={styles.sectionLabel}>PRODUCTION ENGINE</div>
          <h2>{engineReady ? "Worker configured — verification pending" : "Engine connection in progress"}</h2>
          <p>{engineReady ? "The private worker credentials are present. A health check and first render test are still required." : "The studio workspace is ready, but MoneyPrinterTurbo has not yet been connected. No generation will start until the private worker is installed and verified."}</p>
        </div>
        <div className={styles.statusPill}><i className={engineReady ? styles.amberDot : ""} />{engineReady ? "VERIFY CONNECTION" : "NOT CONNECTED"}</div>
      </section>

      <section className={styles.metrics}>
        <article><span>ACTIVE PROJECTS</span><strong>{data.summary.projects}</strong><small>In this workspace</small></article>
        <article><span>PRODUCTION JOBS</span><strong>{data.summary.jobs}</strong><small>All job states</small></article>
        <article><span>COMPLETED VIDEOS</span><strong>{data.summary.completed}</strong><small>Successfully rendered</small></article>
        <article><span>AWAITING REVIEW</span><strong>{data.summary.awaiting}</strong><small>Human approval queue</small></article>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><div className={styles.sectionLabel}>YOUR WORKSPACE</div><h2>Production projects</h2></div>
            <span className={styles.count}>01 / PROJECT</span>
          </div>
          <article className={styles.projectCard}>
            <div className={styles.projectIcon}>BH</div>
            <div className={styles.projectInfo}>
              <h3>BlueHaven Video Studio</h3>
              <p>Central production workspace · 9:16 default</p>
              <div className={styles.tags}><span>SHORT-FORM</span><span>LONG-FORM</span><span>BRANDED CONTENT</span></div>
            </div>
            <span className={styles.projectState}>ACTIVE</span>
          </article>
          <div className={styles.brandStrip}>
            <span className={styles.sectionLabel}>DEFAULT BRAND KIT</span>
            <strong>BlueHaven Studios</strong>
            <div className={styles.swatches}><i /><i /></div>
            <span className={styles.brandTag}>CREATIVITY BEYOND LIMITS</span>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><div className={styles.sectionLabel}>PIPELINE</div><h2>Production flow</h2></div>
            <span className={styles.count}>01 — 06</span>
          </div>
          <ol className={styles.pipeline}>
            {[
              ["01", "Brief & direction", "Define the idea, audience and format"],
              ["02", "Script & scenes", "Build the narrative and scene plan"],
              ["03", "Voice & visuals", "Select narration and visual sources"],
              ["04", "Render & subtitles", "Assemble the video and captions"],
              ["05", "Quality review", "Preview, revise and approve"],
              ["06", "Export & publish", "Deliver files or prepare a channel post"],
            ].map(([number, title, description]) => (
              <li key={number}><span>{number}</span><div><strong>{title}</strong><small>{description}</small></div></li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><div className={styles.sectionLabel}>RECENT ACTIVITY</div><h2>Production history</h2></div>
          <span className={styles.count}>{data.jobs.length} / 06</span>
        </div>
        {data.jobs.length ? (
          <div className={styles.jobs}>
            {data.jobs.map((job) => (
              <div className={styles.jobRow} key={job.id}>
                <div><strong>{job.project_name}</strong><small>{new Date(job.created_at).toLocaleString("en-NG")}</small></div>
                <span>{prettyStatus(job.status)}</span>
                <div className={styles.progress}><i style={{ width: `${job.progress}%` }} /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <span>NO PRODUCTION RUNS YET</span>
            <p>Your first video will appear here after the engine is connected and a production brief is submitted.</p>
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <span>BLUEHAVEN STUDIOS / AI VIDEO STUDIO</span>
        <span>{data.ready ? "DATABASE CONNECTED" : "DATABASE STATUS UNAVAILABLE"} · {engineReady ? "ENGINE CONFIGURED" : "ENGINE OFFLINE"}</span>
      </footer>
    </main>
  );
}
