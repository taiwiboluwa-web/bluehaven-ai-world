"use client";
import { useEffect,useState } from "react";
import { WorkspacePage,WorkspaceSection } from "@/components/WorkspacePage";
type Agent={id:string;name:string;department:string;role_description:string;status:string;model_id?:string|null;};
export default function AgentsPage(){
 const [agents,setAgents]=useState<Agent[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 useEffect(()=>{fetch("/api/company",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load agent roster");setAgents(d.agents||[]);}).catch(e=>setError(e instanceof Error?e.message:"Agent roster unavailable")).finally(()=>setLoading(false));},[]);
 return <WorkspacePage eyebrow="AI AGENTS / INTELLIGENCE LAYER" title="Meet your" accent="specialists." description="A dedicated directory for the AI department heads and specialist workers inside BlueHaven. Use AI Missions to give them a coordinated objective." actions={[{href:"/company/command",label:"Launch AI Mission"},{href:"/company",label:"Company HQ"}]} metrics={[{label:"REGISTERED AGENTS",value:String(agents.length).padStart(2,"0")},{label:"AVAILABLE",value:String(agents.filter(a=>a.status==="active"||a.status==="available").length).padStart(2,"0")},{label:"ON STANDBY",value:String(agents.filter(a=>a.status!=="active"&&a.status!=="available").length).padStart(2,"0")}]}>
 <WorkspaceSection eyebrow="DEPARTMENT DIRECTORY" title="Specialist roster">
 {error&&<div className="workspace-alert">{error}</div>}
 {loading?<div className="workspace-empty">Loading the department roster…</div>:agents.length===0?<div className="workspace-empty">No agent records were returned by Company HQ.</div>:<div className="agent-directory">{agents.map(a=><article className="agent-tile" key={a.id}><span className="agent-monogram">{a.name.slice(0,2).toUpperCase()}</span><div><small>{a.department}</small><h3>{a.name}</h3><p>{a.role_description}</p></div><span className="workspace-status">{a.status.replaceAll("_"," ")}</span></article>)}</div>}
 </WorkspaceSection></WorkspacePage>;
}
