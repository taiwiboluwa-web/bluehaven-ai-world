import Link from "next/link";
import { WorkspacePage, WorkspaceSection } from "@/components/WorkspacePage";

const features = [
  { number:"01", name:"AI Village", category:"OVERVIEW", description:"See your workspace as a living 3D village, inspect project buildings and monitor activity.", href:"/", status:"AVAILABLE" },
  { number:"02", name:"Projects", category:"BUILD & MANAGE", description:"Create, organise and monitor your AI projects, construction status and recent jobs.", href:"/projects", status:"AVAILABLE" },
  { number:"03", name:"Company HQ", category:"OPERATIONS", description:"Your executive office: CHO, Matthew, departments, workers, tasks, hiring and daily briefs.", href:"/company", status:"AVAILABLE" },
  { number:"04", name:"AI Agents", category:"INTELLIGENCE", description:"Explore the specialist roster, responsibilities and agent availability.", href:"/agents", status:"AVAILABLE" },
  { number:"05", name:"AI Missions", category:"ORCHESTRATION", description:"Give Atlas a goal and coordinate specialist agents to produce a joined-up outcome.", href:"/company/command", status:"AVAILABLE" },
  { number:"06", name:"Creator Command Center", category:"CONTENT", description:"Plan campaigns, create channel-ready drafts, manage approvals and content activity.", href:"/creator-command-center", status:"AVAILABLE" },
  { number:"07", name:"AI Video Studio", category:"PRODUCTION", description:"Manage video projects and production drafts, then connect the private rendering engine.", href:"/video-studio", status:"FOUNDATION" },
  { number:"08", name:"Channels & Publishing", category:"DISTRIBUTION", description:"Connect supported social accounts, check permissions and manage publishing workflows.", href:"/connections", status:"AVAILABLE" },
  { number:"09", name:"Knowledge Archive", category:"KNOWLEDGE", description:"A dedicated home for document sources, indexed knowledge and retrieval workflows.", href:"/knowledge", status:"IN DEVELOPMENT" },
  { number:"10", name:"AI Infrastructure", category:"SYSTEMS", description:"Inspect model gateway, provider readiness, database connectivity and system services.", href:"/infrastructure", status:"AVAILABLE" },
];
export default function FeaturesPage() {
  return <WorkspacePage eyebrow="BLUEHAVEN AI WORLD / WORKSPACE DIRECTORY" title="Every capability." accent="One place." description="Choose a workspace to open its own page. Each section has a clear purpose, its own tools and a consistent route back to the rest of AI World." actions={[{href:"/",label:"Open AI Village"},{href:"/company/command",label:"Start an AI Mission"}]}>
    <WorkspaceSection eyebrow="FEATURE DIRECTORY / 10 WORKSPACES" title="Explore AI World">
      <div className="feature-directory">{features.map((item) => <Link href={item.href} className="feature-tile" key={item.number}><span className="feature-number">{item.number}</span><div className="feature-copy"><small>{item.category}</small><h3>{item.name}</h3><p>{item.description}</p></div><div className="feature-meta"><span>{item.status}</span><b>↗</b></div></Link>)}</div>
    </WorkspaceSection>
  </WorkspacePage>;
}
