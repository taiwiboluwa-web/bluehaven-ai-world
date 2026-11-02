"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { WorkspacePage, WorkspaceSection } from "@/components/WorkspacePage";
type Project={id:string;name:string;kind:string;status:string;description:string;purpose:string;template:string;createdAt?:string;updatedAt?:string;};
export default function ProjectsPage(){
 const [projects,setProjects]=useState<Project[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 async function load(){setLoading(true);try{const r=await fetch("/api/projects",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load projects");setProjects(d.projects||[]);setError("");}catch(e){setError(e instanceof Error?e.message:"Project service unavailable");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 return <WorkspacePage eyebrow="PROJECTS / BUILD & MANAGE" title="Your project" accent="portfolio." description="A dedicated view of every AI project in your BlueHaven world, with status, purpose and a direct route into the village workspace." actions={[{href:"/",label:"Open AI Village"},{href:"/features",label:"All Features"}]} metrics={[{label:"TOTAL PROJECTS",value:String(projects.length).padStart(2,"0")},{label:"ACTIVE",value:String(projects.filter(p=>["active","processing"].includes(p.status)).length).padStart(2,"0")},{label:"IN PROGRESS",value:String(projects.filter(p=>["under_construction","initializing","awaiting_construction"].includes(p.status)).length).padStart(2,"0")}]}>
 <WorkspaceSection eyebrow="PROJECT LEDGER" title="All projects">
 {error&&<div className="workspace-alert">{error}<button onClick={()=>void load()}>Retry</button></div>}
 {loading?<div className="workspace-empty">Loading project portfolio…</div>:projects.length===0?<div className="workspace-empty"><strong>No projects have been created yet.</strong><p>Start in AI Village and use the Builder Hut to create your first project.</p><Link href="/">Go to AI Village ↗</Link></div>:<div className="workspace-list">{projects.map(p=><article className="workspace-list-row" key={p.id}><div><span className="workspace-overline">{p.kind||p.template||"AI PROJECT"}</span><h3>{p.name}</h3><p>{p.purpose||p.description||"No project description yet."}</p></div><span className={"workspace-status "+p.status}>{p.status.replaceAll("_"," ")}</span><Link href="/">OPEN IN VILLAGE ↗</Link></article>)}</div>}
 </WorkspaceSection></WorkspacePage>;
}
