"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "AI Village", description: "Main workspace" },
  { href: "/company", label: "Company HQ", description: "Teams and operations" },
  { href: "/company/command", label: "AI Missions", description: "Orchestrate agents" },
  { href: "/creator-command-center", label: "Creator Command", description: "Content planning and approvals" },
  { href: "/video-studio", label: "Video Studio", description: "Create and manage videos" },
  { href: "/connections", label: "Channels", description: "Accounts and publishing" },
];

export default function WorldNavigation() {
  const pathname = usePathname();
  return (
    <nav className="world-navigation" aria-label="BlueHaven AI World features">
      <div className="world-navigation-label">WORKSPACE</div>
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
