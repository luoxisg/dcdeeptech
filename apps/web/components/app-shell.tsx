"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@lead-intel/ui";
import { BarChart3, Download, Files, LayoutDashboard, Search, Star } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search },
  { href: "/leads", label: "Lead List", icon: Files },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/export", label: "Export", icon: Download }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="sticky top-0 hidden h-screen w-[290px] shrink-0 border-r border-white/10 bg-[#09111b]/90 px-6 py-8 backdrop-blur lg:block">
        <div className="mb-8 space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-emerald-400 shadow-glow">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Lead Intelligence</h1>
            <p className="mt-2 text-sm text-slate-300">
              China outbound enterprise qualification across VIE/USD, digital globalization, and heavy-asset expansion.
            </p>
          </div>
          <Badge tone="accent">No outreach automation in v1</Badge>
        </div>

        <nav className="space-y-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                  active
                    ? "border-orange-300/25 bg-orange-400/12 text-white"
                    : "border-white/5 bg-white/[0.03] text-slate-300 hover:bg-white/[0.05]"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 px-5 py-6 lg:px-8">{children}</main>
    </div>
  );
}
