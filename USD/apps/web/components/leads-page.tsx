"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, SectionHeading } from "@lead-intel/ui";
import type { AgentType, LeadCard, SearchRequest } from "@lead-intel/types";
import Link from "next/link";
import { useMemo } from "react";
import { searchLeads } from "@/lib/api";

export function LeadsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const payload = useMemo<SearchRequest>(
    () => ({
      user_query_name: searchParams.user_query_name || "Ad hoc search",
      filters: {
        agent_type: (searchParams.agent_type as AgentType | undefined) || undefined,
        industry: searchParams.industry || undefined,
        geography: searchParams.geography || undefined,
        funding_stage: searchParams.funding_stage || undefined,
        minimum_score: Number(searchParams.minimum_score || 0),
        page: 1,
        page_size: 50,
        sort_by: "fit_score",
        sort_order: "desc"
      }
    }),
    [searchParams]
  );

  const query = useQuery({
    queryKey: ["leads", payload],
    queryFn: () => searchLeads(payload)
  });

  const rows = query.data?.items ?? [];

  const columns = useMemo<ColumnDef<LeadCard>[]>(
    () => [
      {
        header: "Company",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.company.company_name_en}</div>
            <div className="text-sm text-slate-400">{row.original.company.industry_primary}</div>
          </div>
        )
      },
      {
        header: "Agent",
        cell: ({ row }) => <Badge tone="accent">{row.original.primary_score.agent_type}</Badge>
      },
      {
        header: "Regions",
        cell: ({ row }) => <span className="text-sm text-slate-300">{row.original.company.operating_regions.join(", ")}</span>
      },
      {
        header: "Score",
        cell: ({ row }) => <Badge tone="success">{row.original.primary_score.fit_score}</Badge>
      },
      {
        header: "Priority",
        cell: ({ row }) => <Badge tone="warning">{row.original.primary_score.priority_tier}</Badge>
      },
      {
        header: "Roles",
        cell: ({ row }) => <span className="text-sm text-slate-300">{row.original.recommended_roles.slice(0, 2).join(", ")}</span>
      },
      {
        header: "Action",
        cell: ({ row }) => (
          <Link href={`/leads/${row.original.company.company_id}`}>
            <Button variant="secondary">Open</Button>
          </Link>
        )
      }
    ],
    []
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Lead List"
        title="Ranked target companies"
        description="Evidence-backed lead cards ranked by fit score and qualification confidence."
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="border-b border-white/10 px-4 py-4">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-4 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
