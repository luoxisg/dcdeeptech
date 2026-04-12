"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, Input, SectionHeading } from "@lead-intel/ui";
import { getLead, rescoreLead, reviewSignal, saveWatchlist } from "@/lib/api";
import { useState } from "react";

export function LeadDetailPage({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const query = useQuery({ queryKey: ["lead", companyId], queryFn: () => getLead(companyId) });

  const rescore = useMutation({
    mutationFn: () => rescoreLead(companyId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lead", companyId] })
  });

  const watchlist = useMutation({
    mutationFn: () => saveWatchlist({ company_id: companyId, notes: note, tags: ["manual-review"] }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lead", companyId] })
  });

  const signalReview = useMutation({
    mutationFn: ({ signalId, status }: { signalId: string; status: "valid" | "weak" }) =>
      reviewSignal(signalId, { review_status: status, note }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lead", companyId] })
  });

  const lead = query.data;
  if (!lead) {
    return <Card>Loading lead intelligence…</Card>;
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Lead Detail"
        title={lead.company.company_name_en}
        description={lead.company_summary}
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Badge tone="accent">{lead.primary_score.agent_type}</Badge>
            <Badge tone="success">Fit {lead.primary_score.fit_score}</Badge>
            <Badge tone="warning">{lead.primary_score.priority_tier}</Badge>
            <Badge>{lead.evidence_count} evidence items</Badge>
          </div>
          <p className="text-sm text-slate-300">{lead.company.description}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Info title="Likely needs" items={lead.likely_needs} />
            <Info title="Recommended roles" items={lead.recommended_roles} />
          </div>
          <Card className="bg-slate-950/40">
            <div className="text-sm font-medium">Opening angle</div>
            <p className="mt-2 text-sm text-slate-300">{lead.opening_angle}</p>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => rescore.mutate()}>{rescore.isPending ? "Rescoring…" : "Rescore lead"}</Button>
            <Button variant="secondary" onClick={() => watchlist.mutate()}>
              {watchlist.isPending ? "Saving…" : "Add to watchlist"}
            </Button>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="text-sm font-medium">Analyst note</div>
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add note before watchlist save or signal review…" />
          <div className="text-sm text-slate-400">Risk note: {lead.risk_note}</div>
          {lead.watchlist_entry ? (
            <Card className="bg-slate-950/40">
              <div className="font-medium">Watchlist status</div>
              <div className="mt-2 text-sm text-slate-300">{lead.watchlist_entry.notes || "No notes saved yet."}</div>
            </Card>
          ) : null}
        </Card>
      </div>

      <Card className="space-y-4">
        <SectionHeading title="Evidence Viewer" description="Review source signals, mapped fields, and confidence." />
        <div className="space-y-4">
          {lead.signals.map((signal) => (
            <Card key={signal.signal_id} className="bg-slate-950/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{signal.title}</div>
                  <div className="mt-2 text-sm text-slate-300">{signal.evidence_text}</div>
                  <div className="mt-2 text-xs text-slate-400">
                    {signal.source_date} · {signal.source_url}
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <Badge tone="success">{Math.round(signal.confidence * 100)} confidence</Badge>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => signalReview.mutate({ signalId: signal.signal_id, status: "valid" })}>
                      Mark valid
                    </Button>
                    <Button variant="secondary" onClick={() => signalReview.mutate({ signalId: signal.signal_id, status: "weak" })}>
                      Mark weak
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {signal.mapped_fields.map((field) => (
                  <Badge key={field}>{field}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Info({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="bg-slate-950/40">
      <div className="text-sm font-medium">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </Card>
  );
}
