"use client";
import {useEffect,useState} from "react";
import {WorkspacePage,WorkspaceSection} from "@/components/WorkspacePage";
type Health={status?:string;implementation?:string;runtime?:string;authenticationConfigured?:boolean;configuredProviderCount?:number;providers?:{id:string;label:string;configured:boolean;mode:string}[];};
type VideoHealth={database?:string;engine?:string;generationEnabled?:boolean;};
export default function InfrastructurePage(){
 const [gateway,setGateway]=useState<Health|null>(null);const [video,setVideo]=useState<VideoHealth|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 async function load(){setLoading(true);setError("");try{const [a,b]=await Promise.all([fetch("/api/omniroute/health",{cache:"no-store"}),fetch("/api/video-studio/health",{cache:"no-store"})]);const [ga,vh]=await Promise.all([a.json(),b.json()]);setGateway(ga);setVideo(vh);if(!a.ok)throw new Error("Gateway status endpoint unavailable");}catch(e){setError(e instanceof Error?e.message:"Could not read system status");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 return <WorkspacePage eyebrow="AI INFRASTRUCTURE / SYSTEM HEALTH" title="The systems" accent="behind AI World." description="A single place to inspect the model gateway, configured providers, database readiness and the separate video-rendering service. Secret values are never displayed here." actions={[{href:"/features",label:"All Features"},{href:"/video-studio",label:"Video Studio"}]} metrics={[{label:"GATEWAY",value:gateway?.status==="ready"?"READY":"CHECK"},{label:"PROVIDERS CONFIGURED",value:String(gateway?.configuredProviderCount??"—")},{label:"VIDEO ENGINE",value:video?.engine==="configured_unverified"?"VERIFY":"OFFLINE"}]}>
 <WorkspaceSection eyebrow="LIVE SYSTEM CHECKS" title="Service readiness">
 {error&&<div className="workspace-alert">{error}</div>}
 <div className="infra-grid"><article><span>MODEL GATEWAY</span><strong>{gateway?.status||"Checking…"}</strong><p>{gateway?.implementation||"Vercel-native model adapter"}</p><small>Authentication configured: {gateway?gateway.authenticationConfigured?"Yes":"No":"—"}</small></article><article><span>NEON DATABASE</span><strong>{video?.database||"Checking…"}</strong><p>Workspace metadata and project persistence.</p><small>Video Studio health probe</small></article><article><span>MONEYPRINTERTURBO</span><strong>{video?.engine||"Checking…"}</strong><p>Private rendering worker connection.</p><small>Generation enabled: {video?video.generationEnabled?"Yes":"No":"—"}</small></article></div>
 </WorkspaceSection>
 <WorkspaceSection eyebrow="MODEL PROVIDERS" title="Configured provider credentials">
 {loading?<div className="workspace-empty">Checking providers…</div>:<div className="provider-directory">{(gateway?.providers||[]).map(p=><div key={p.id}><span>{p.label}</span><b className={p.configured?"configured":"not-configured"}>{p.configured?"CREDENTIAL PRESENT":"NOT CONFIGURED"}</b><small>{p.mode} integration</small></div>)}</div>}
 <p className="workspace-footnote">A credential being present does not prove that billing, permissions or a live model request has been verified. This screen intentionally never displays keys or connection strings.</p>
 <button className="workspace-refresh" onClick={()=>void load()} disabled={loading}>{loading?"Checking…":"Refresh system status ↻"}</button>
 </WorkspaceSection>
 </WorkspacePage>;
}
