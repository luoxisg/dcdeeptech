from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AgentType(str, Enum):
    VIE_USD = "vie_usd"
    DIGITAL_GLOBAL = "digital_global"
    HEAVY_ASSET_GLOBAL = "heavy_asset_global"


class PriorityTier(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    REJECT = "Reject"


class ReviewStatus(str, Enum):
    VALID = "valid"
    WEAK = "weak"


class Company(Base):
    __tablename__ = "companies"

    company_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_name_cn: Mapped[str] = mapped_column(String(255))
    company_name_en: Mapped[str] = mapped_column(String(255), index=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    industry_primary: Mapped[str] = mapped_column(String(120), index=True)
    industry_secondary: Mapped[str | None] = mapped_column(String(120), nullable=True)
    company_type: Mapped[str] = mapped_column(String(120))
    china_linked: Mapped[bool] = mapped_column(Boolean, default=True)
    china_link_strength: Mapped[int] = mapped_column(Integer, default=0)
    hq_country: Mapped[str] = mapped_column(String(120), index=True)
    hq_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    operating_regions: Mapped[list[str]] = mapped_column(JSON, default=list)
    english_site: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(64), default="active")
    description: Mapped[str] = mapped_column(Text)
    source_count: Mapped[int] = mapped_column(Integer, default=0)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    signals: Mapped[list["CompanySignal"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    funding_events: Mapped[list["FundingEvent"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    scores: Mapped[list["AgentScore"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    watchlists: Mapped[list["Watchlist"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class CompanySignal(Base):
    __tablename__ = "company_signals"

    signal_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.company_id"), index=True)
    signal_type: Mapped[str] = mapped_column(String(120), index=True)
    signal_subtype: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(255))
    evidence_text: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(String(500))
    source_date: Mapped[datetime] = mapped_column(DateTime)
    confidence: Mapped[float] = mapped_column(Float)
    raw_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="signals")
    reviews: Mapped[list["SignalReview"]] = relationship(back_populates="signal", cascade="all, delete-orphan")


class FundingEvent(Base):
    __tablename__ = "funding_events"

    funding_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.company_id"), index=True)
    round_name: Mapped[str] = mapped_column(String(120))
    announce_date: Mapped[datetime] = mapped_column(DateTime)
    amount_text: Mapped[str] = mapped_column(String(120))
    currency_hint: Mapped[str | None] = mapped_column(String(32), nullable=True)
    investors: Mapped[list[str]] = mapped_column(JSON, default=list)
    international_investor_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    offshore_entity_hint: Mapped[bool] = mapped_column(Boolean, default=False)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    company: Mapped["Company"] = relationship(back_populates="funding_events")


class AgentScore(Base):
    __tablename__ = "agent_scores"

    score_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.company_id"), index=True)
    agent_type: Mapped[str] = mapped_column(String(32), index=True)
    fit_score: Mapped[float] = mapped_column(Float)
    confidence_score: Mapped[float] = mapped_column(Float)
    priority_tier: Mapped[str] = mapped_column(String(16))
    reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    recommended_roles: Mapped[list[str]] = mapped_column(JSON, default=list)
    opening_angle: Mapped[str] = mapped_column(Text)
    next_action: Mapped[str] = mapped_column(Text)
    likely_needs: Mapped[list[str]] = mapped_column(JSON, default=list)
    hybrid_tag: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="scores")


class Search(Base):
    __tablename__ = "searches"

    search_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_query_name: Mapped[str] = mapped_column(String(255))
    filters_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    result_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Watchlist(Base):
    __tablename__ = "watchlists"

    watchlist_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.company_id"), unique=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="watchlists")


class SignalReview(Base):
    __tablename__ = "signal_reviews"

    review_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    signal_id: Mapped[str] = mapped_column(ForeignKey("company_signals.signal_id"), unique=True)
    review_status: Mapped[str] = mapped_column(String(16))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    signal: Mapped["CompanySignal"] = relationship(back_populates="reviews")
