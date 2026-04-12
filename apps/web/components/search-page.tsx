"use client";

import { Button, Card, Input, SectionHeading, Select } from "@lead-intel/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({
    user_query_name: "Outbound expansion targets",
    agent_type: "",
    industry: "",
    geography: "",
    funding_stage: "",
    minimum_score: "60"
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Search & Filter"
        title="Find high-potential target companies fast"
        description="Search by agent, industry, geography, funding, and structural signals."
      />
      <Card className="space-y-5 lg:sticky lg:top-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Saved search name">
            <Input value={filters.user_query_name} onChange={(event) => setFilters((state) => ({ ...state, user_query_name: event.target.value }))} />
          </Field>
          <Field label="Agent type">
            <Select value={filters.agent_type} onChange={(event) => setFilters((state) => ({ ...state, agent_type: event.target.value }))}>
              <option value="">All agents</option>
              <option value="vie_usd">Agent A</option>
              <option value="digital_global">Agent B</option>
              <option value="heavy_asset_global">Agent C</option>
            </Select>
          </Field>
          <Field label="Industry">
            <Input value={filters.industry} onChange={(event) => setFilters((state) => ({ ...state, industry: event.target.value }))} placeholder="Gaming, Battery, SaaS..." />
          </Field>
          <Field label="Geography">
            <Input value={filters.geography} onChange={(event) => setFilters((state) => ({ ...state, geography: event.target.value }))} placeholder="Singapore, Vietnam..." />
          </Field>
          <Field label="Funding stage">
            <Input value={filters.funding_stage} onChange={(event) => setFilters((state) => ({ ...state, funding_stage: event.target.value }))} placeholder="Series A, Growth..." />
          </Field>
          <Field label="Minimum score">
            <Input type="number" value={filters.minimum_score} onChange={(event) => setFilters((state) => ({ ...state, minimum_score: event.target.value }))} />
          </Field>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              const params = new URLSearchParams({
                user_query_name: filters.user_query_name,
                minimum_score: filters.minimum_score,
                agent_type: filters.agent_type,
                industry: filters.industry,
                geography: filters.geography,
                funding_stage: filters.funding_stage
              });
              router.push(`/leads?${params.toString()}`);
            }}
          >
            Run search
          </Button>
          <Button variant="secondary" onClick={() => router.push("/export")}>
            Open export center
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}
