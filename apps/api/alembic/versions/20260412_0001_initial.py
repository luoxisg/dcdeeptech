"""initial lead intelligence schema

Revision ID: 20260412_0001
Revises:
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa


revision = "20260412_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("company_id", sa.String(length=64), primary_key=True),
        sa.Column("company_name_cn", sa.String(length=255), nullable=False),
        sa.Column("company_name_en", sa.String(length=255), nullable=False),
        sa.Column("website", sa.String(length=255)),
        sa.Column("domain", sa.String(length=255)),
        sa.Column("industry_primary", sa.String(length=120), nullable=False),
        sa.Column("industry_secondary", sa.String(length=120)),
        sa.Column("company_type", sa.String(length=120), nullable=False),
        sa.Column("china_linked", sa.Boolean(), nullable=False),
        sa.Column("china_link_strength", sa.Integer(), nullable=False),
        sa.Column("hq_country", sa.String(length=120), nullable=False),
        sa.Column("hq_city", sa.String(length=120)),
        sa.Column("operating_regions", sa.JSON(), nullable=False),
        sa.Column("english_site", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source_count", sa.Integer(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "company_signals",
        sa.Column("signal_id", sa.String(length=64), primary_key=True),
        sa.Column("company_id", sa.String(length=64), sa.ForeignKey("companies.company_id"), nullable=False),
        sa.Column("signal_type", sa.String(length=120), nullable=False),
        sa.Column("signal_subtype", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("evidence_text", sa.Text(), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=False),
        sa.Column("source_date", sa.DateTime(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("raw_metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "funding_events",
        sa.Column("funding_id", sa.String(length=64), primary_key=True),
        sa.Column("company_id", sa.String(length=64), sa.ForeignKey("companies.company_id"), nullable=False),
        sa.Column("round_name", sa.String(length=120), nullable=False),
        sa.Column("announce_date", sa.DateTime(), nullable=False),
        sa.Column("amount_text", sa.String(length=120), nullable=False),
        sa.Column("currency_hint", sa.String(length=32)),
        sa.Column("investors", sa.JSON(), nullable=False),
        sa.Column("international_investor_flag", sa.Boolean(), nullable=False),
        sa.Column("offshore_entity_hint", sa.Boolean(), nullable=False),
        sa.Column("source_url", sa.String(length=500)),
        sa.Column("confidence", sa.Float(), nullable=False),
    )
    op.create_table(
        "agent_scores",
        sa.Column("score_id", sa.String(length=64), primary_key=True),
        sa.Column("company_id", sa.String(length=64), sa.ForeignKey("companies.company_id"), nullable=False),
        sa.Column("agent_type", sa.String(length=32), nullable=False),
        sa.Column("fit_score", sa.Float(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("priority_tier", sa.String(length=16), nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=False),
        sa.Column("recommended_roles", sa.JSON(), nullable=False),
        sa.Column("opening_angle", sa.Text(), nullable=False),
        sa.Column("next_action", sa.Text(), nullable=False),
        sa.Column("likely_needs", sa.JSON(), nullable=False),
        sa.Column("hybrid_tag", sa.String(length=64)),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "searches",
        sa.Column("search_id", sa.String(length=64), primary_key=True),
        sa.Column("user_query_name", sa.String(length=255), nullable=False),
        sa.Column("filters_json", sa.JSON(), nullable=False),
        sa.Column("result_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "watchlists",
        sa.Column("watchlist_id", sa.String(length=64), primary_key=True),
        sa.Column("company_id", sa.String(length=64), sa.ForeignKey("companies.company_id"), nullable=False, unique=True),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "signal_reviews",
        sa.Column("review_id", sa.String(length=64), primary_key=True),
        sa.Column("signal_id", sa.String(length=64), sa.ForeignKey("company_signals.signal_id"), nullable=False, unique=True),
        sa.Column("review_status", sa.String(length=16), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("signal_reviews")
    op.drop_table("watchlists")
    op.drop_table("searches")
    op.drop_table("agent_scores")
    op.drop_table("funding_events")
    op.drop_table("company_signals")
    op.drop_table("companies")
