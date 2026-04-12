"""Pydantic models for lead intelligence endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class FundingEvent(BaseModel):
    id: str
    company_id: str
    announced_at: str
    round_name: str
    amount_usd_m: float
    investors: list[str]
    funding_signal_summary: str


class LeadScore(BaseModel):
    company_id: str
    funding_score: int
    globalization_score: int
    infra_fit_score: int
    qualification_confidence: int
    final_lead_score: int
    score_rationale: str
    last_qualified_at: str
    target_roles: list[str]
    opening_angle: str


class LeadCard(BaseModel):
    id: str
    name: str
    normalized_name: str
    website: str
    hq_country: str
    china_link_type: str
    global_regions: list[str]
    summary: str
    company_profile: str
    funding_signal_summary: str
    globalization_signal_summary: str
    infra_demand_likelihood: str
    target_contact_roles: list[str]
    recommended_opening_angle: str
    employee_band: str
    stage: str
    is_usd_backed: bool
    international_backing: bool
    latest_funding_event: FundingEvent
    lead_score: LeadScore


class LeadSearchResponse(BaseModel):
    total: int
    items: list[LeadCard]


class DiscoveryRequest(BaseModel):
    query: str
    region_focus: str | None = None
    min_score: int = 0


class DiscoveryResponse(BaseModel):
    query: str
    candidates_found: int
    shortlisted: list[LeadCard]
    connector_notes: list[str]


class QualificationResponse(BaseModel):
    company_id: str
    status: Literal["qualified", "watchlist"]
    company_profile: str
    funding_signal_summary: str
    globalization_signal_summary: str
    infra_demand_likelihood: str
    target_contact_roles: list[str]
    recommended_opening_angle: str
    final_lead_score: int
    confidence: int
    rationale: str


class ExportResponse(BaseModel):
    format: Literal["json", "csv"]
    generated_at: str
    record_count: int
    columns: list[str]
    payload: str
