"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card, SectionHeading } from "@lead-intel/ui";
import Link from "next/link";
import { getWatchlist } from "@/lib/api";

export function WatchlistPage() {
  const query = useQuery({ queryKey: ["watchlist"], queryFn: getWatchlist });
  const items = query.data ?? [];

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Watchlist" title="Tracked companies" description="Favorites, notes, and status tags for monitored targets." />
      <div className="grid gap-4">
        {items.map((item) => (
          <Link key={item.watchlist_id} href={`/leads/${item.company_id}`}>
            <Card className="space-y-3 transition hover:bg-white/[0.08]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{item.lead?.company.company_name_en}</div>
                  <div className="text-sm text-slate-300">{item.notes}</div>
                </div>
                <Badge tone="accent">{item.lead?.primary_score.priority_tier}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
