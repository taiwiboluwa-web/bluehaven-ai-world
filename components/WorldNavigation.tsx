"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/features", label: "All Features", description: "Workspace directory" },
  { href: "/", label: "AI Village", description: "3D workspace overview" },
  { href: "/projects", label: "Projects", description: "Project portfolio and status" },
  { href: "/company", label: "Company HQ", description: "Leadership and operations" },
  { href: "/agents", label: "AI Agents", description: "Agent roster and departments" },
  { href: "/company/command", label: "AI Missions", description: "Coordinate specialist agents" },
  { href: "/creator-command-center", label: "Creator Studio", description: "Campaigns, drafts and approvals" },
  { href: "/video-studio", label: "Video Studio", description: "Video production workspace" },
  { href: "/connections", label: "Channels", description: "Social accounts and publishing" },
  { href: "/knowledge", label: "Knowledge", description: "Documents and knowledge workflows" },
  { href: "/infrastructure", label: "Infrastructure", description: "Models, gateway and database" },
];

export default function WorldNavigation() {
  const pathname = usePathname();
  return (
    <nav className="world-navigation" aria-label="BlueHaven AI World main navigation">
      <Link className="world-navigation-label" href="/features">AI WORLD / MENU</Link>
      <div className="world-navigation-links">
        {links.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`world-navigation-link${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              title={item.description}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
