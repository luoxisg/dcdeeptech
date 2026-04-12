from __future__ import annotations

from pydantic import BaseModel, Field


class CompanySummaryModel(BaseModel):
    company_id: str
    company_name_cn: str
    company_name_en: str
    website: str | None
    domain: str | None
    industry_primary: str
    industry_secondary: str | None
    company_type: str
    china_linked: bool
    china_link_strength: int
    hq_country: str
    hq_city: str | None
    operating_regions: list[str]
    english_site: bool
    status: str
    description: str
    source_count: int
    last_seen_at: str
    created_at: str
    updated_at: str


class CompanySignalModel(BaseModel):
    signal_id: str
    company_id: str
    signal_type: str
    signal_subtype: str
    title: str
    evidence_text: str
    source_url: str
    source_date: str
    confidence: float
    raw_metadata: dict
    mapped_fields: list[str]
    created_at: str
    review_status: str | None
    review_note: str | None
    reviewed_at: str | None


class FundingEventModel(BaseModel):
    funding_id: str
    company_id: str
    round_name: str
    announce_date: str
    amount_text: str
    currency_hint: str | None
    investors: list[str]
    international_investor_flag: bool
    offshore_entity_hint: bool
    source_url: str | None
    confidence: float


class AgentScoreModel(BaseModel):
    score_id: str
    company_id: str
    agent_type: str
    fit_score: float
    confidence_score: float
    priority_tier: str
    reasons: list[str]
    recommended_roles: list[str]
    opening_angle: str
    next_action: str
    likely_needs: list[str]
    hybrid_tag: str | None
    updated_at: str


class LeadCardModel(BaseModel):
    company: CompanySummaryModel
    primary_score: AgentScoreModel
    secondary_score: AgentScoreModel | None
    latest_signal: CompanySignalModel | None
    evidence_count: int
    why_matched: list[str]
    likely_needs: list[str]
    recommended_roles: list[str]
    opening_angle_summary: str


class LeadDetailModel(BaseModel):
    company: CompanySummaryModel
    primary_score: AgentScoreModel
    secondary_score: AgentScoreModel | None
    funding_events: list[FundingEventModel]
    signals: list[CompanySignalModel]
    timeline: list[CompanySignalModel]
    evidence_count: int
    company_summary: str
    why_matched: list[str]
    likely_needs: list[str]
    recommended_roles: list[str]
    opening_angle: str
    risk_note: str
    watchlist_entry: dict | None


class SearchFiltersModel(BaseModel):
    agent_type: str | None = None
    industry: str | None = None
    geography: str | None = None
    recent_activity_window_days: int | None = None
    funding_stage: str | None = None
    english_website: bool | None = None
    offshore_structure_hint: bool | None = None
    multi_country_operations: bool | None = None
    overseas_factory: bool | None = None
    minimum_score: int = 0
    page: int = 1
    page_size: int = 20
    sort_by: str = "fit_score"
    sort_order: str = "desc"


class SearchRequestModel(BaseModel):
    user_query_name: str
    filters: SearchFiltersModel


class PaginatedLeadsModel(BaseModel):
    items: list[LeadCardModel]
    total: int
    page: int
    page_size: int
    sort_by: str
    sort_order: str


class SearchRecordModel(BaseModel):
    search_id: str
    user_query_name: str
    filters_json: dict
    result_count: int
    created_at: str


class ExportRequestModel(BaseModel):
    format: str = Field(pattern="^(csv|xlsx|json)$")
    company_ids: list[str] | None = None
    watchlist_only: bool = False


class ExportResponseModel(BaseModel):
    format: str
    filename: str
    content_type: str
    payload: str
    exported_count: int


class WatchlistRequestModel(BaseModel):
    company_id: str
    notes: str = ""
    tags: list[str] = Field(default_factory=list)


class WatchlistModel(BaseModel):
    watchlist_id: str
    company_id: str
    notes: str
    tags: list[str]
    created_at: str
    lead: LeadCardModel | None = None


class SignalReviewRequestModel(BaseModel):
    review_status: str = Field(pattern="^(valid|weak)$")
    note: str = ""


class SignalReviewResponseModel(BaseModel):
    signal_id: str
    review_status: str
    note: str | None
    reviewed_at: str
