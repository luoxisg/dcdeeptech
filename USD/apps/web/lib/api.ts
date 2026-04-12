import type {
  ExportRequest,
  ExportResponse,
  LeadDetailResponse,
  PaginatedLeadsResponse,
  SearchRequest,
  SearchRecord,
  SignalReviewRequest,
  SignalReviewResponse,
  WatchlistEntry,
  WatchlistRequest
} from "@lead-intel/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getLeads(query = "") {
  return request<PaginatedLeadsResponse>(`/leads${query ? `?${query}` : ""}`);
}

export function searchLeads(payload: SearchRequest) {
  return request<PaginatedLeadsResponse>("/search", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getLead(companyId: string) {
  return request<LeadDetailResponse>(`/leads/${companyId}`);
}

export function rescoreLead(companyId: string) {
  return request<LeadDetailResponse>(`/leads/${companyId}/rescore`, { method: "POST" });
}

export function getWatchlist() {
  return request<WatchlistEntry[]>("/watchlist");
}

export function saveWatchlist(payload: WatchlistRequest) {
  return request<WatchlistEntry>("/watchlist", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getSearches() {
  return request<SearchRecord[]>("/searches");
}

export function exportLeads(payload: ExportRequest) {
  return request<ExportResponse>("/export", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function reviewSignal(signalId: string, payload: SignalReviewRequest) {
  return request<SignalReviewResponse>(`/signals/${signalId}/review`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
