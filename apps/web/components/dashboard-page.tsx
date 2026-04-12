"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card, SectionHeading } from "@lead-intel/ui";
import Link from "next/link";
import { getLeads, getSearches, getWatchlist } from "@/lib/api";

export function DashboardPage() {
  const leadsQuery = useQuery({ queryKey: ["dashboard", "leads"], queryFn: () => getLeads("page=1&page_size=100") });
  const searchesQuery = useQuery({ queryKey: ["dashboard", "searches"], queryFn: getSearches });
  const watchlistQuery = useQuery({ queryKey: ["dashboard", "watchlist"], queryFn: getWatchlist });

  const leads = leadsQuery.data?.items ?? [];
  const counts = {
    vie_usd: leads.filter((item) => item.primary_score.agent_type === "vie_usd").length,
    digital_global: leads.filter((item) => item.primary_score.agent_type === "digital_global").length,
    heavy_asset_global: leads.filter((item) => item.primary_score.agent_type === "heavy_asset_global").length,
    P1: leads.filter((item) => item.primary_score.priority_tier === "P1").length,
    P2: leads.filter((item) => item.primary_score.priority_tier === "P2").length,
    P3: leads.filter((item) => item.primary_score.priority_tier === "P3").length
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Dashboard"
        title="China Outbound Enterprise Lead Intelligence Platform"
        description="Operational overview for BD, consulting, tax, compliance, and strategy teams."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total leads" value={leads.length} />
        <MetricCard title="Watchlist" value={watchlistQuery.data?.length ?? 0} />
        <MetricCard title="Recent searches" value={searchesQuery.data?.length ?? 0} />
        <MetricCard title="P1 leads" value={counts.P1} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-4">
          <SectionHeading title="Agent coverage" description="Count by primary lead agent." />
          <div className="flex flex-wrap gap-3">
            <Badge tone="accent">Agent A: {counts.vie_usd}</Badge>
            <Badge tone="success">Agent B: {counts.digital_global}</Badge>
            <Badge tone="warning">Agent C: {counts.heavy_asset_global}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {leads.slice(0, 3).map((lead) => (
              <Card key={lead.company.company_id} className="bg-slate-950/50">
                <div className="text-sm text-slate-300">{lead.company.industry_primary}</div>
                <div className="mt-2 text-lg font-semibold">{lead.company.company_name_en}</div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge tone="accent">{lead.primary_score.priority_tier}</Badge>
                  <span className="text-sm text-slate-300">{lead.primary_score.fit_score}</span>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <SectionHeading title="Quick actions" description="Jump into the most common analyst flows." />
          <ActionLink href="/search" title="Run filtered search" subtitle="Persist a search and rank lead fit." />
          <ActionLink href="/leads" title="Open lead list" subtitle="Review ranked companies with evidence counts." />
          <ActionLink href="/watchlist" title="Open watchlist" subtitle="Monitor favorites and update notes." />
          <ActionLink href="/export" title="Export CRM-ready cards" subtitle="CSV, XLSX, and JSON payloads." />
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <div className="text-sm text-slate-300">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </Card>
  );
}

function ActionLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href}>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
        <div className="font-medium">{title}</div>
        <div className="mt-1 text-sm text-slate-300">{subtitle}</div>
      </div>
    </Link>
  );
}
