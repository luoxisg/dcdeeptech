"use client";

import { useMutation } from "@tanstack/react-query";
import { Button, Card, SectionHeading, Select } from "@lead-intel/ui";
import { exportLeads } from "@/lib/api";
import { useState } from "react";

export function ExportPage() {
  const [format, setFormat] = useState<"csv" | "xlsx" | "json">("csv");
  const mutation = useMutation({
    mutationFn: () => exportLeads({ format, watchlist_only: false })
  });

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Export Center" title="Export CRM-ready lead cards" description="Generate CSV, XLSX, or JSON from normalized lead intelligence." />
      <Card className="space-y-4">
        <div className="max-w-sm">
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Format</label>
          <Select value={format} onChange={(event) => setFormat(event.target.value as "csv" | "xlsx" | "json")}>
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
            <option value="json">JSON</option>
          </Select>
        </div>
        <Button onClick={() => mutation.mutate()}>{mutation.isPending ? "Generating…" : "Generate export"}</Button>
        <pre className="overflow-auto rounded-3xl border border-white/10 bg-slate-950/70 p-5 text-xs text-emerald-100">
          {mutation.data?.payload || "No export generated yet."}
        </pre>
      </Card>
    </div>
  );
}
