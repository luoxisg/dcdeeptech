"""SQLite schema and repository helpers for lead intelligence."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = os.environ.get(
    "LEAD_INTEL_DB_PATH",
    str(Path(__file__).resolve().parent.parent / "lead_intel.db"),
)


def conn() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    return connection


SEED_COMPANIES: list[dict[str, Any]] = [
    {
        "id": "aurora-semi",
        "name": "Aurora Semi Systems",
        "normalized_name": "aurora semi systems",
        "website": "https://aurorasemi.example",
        "hq_country": "Singapore",
        "china_link_type": "founder-origin",
        "global_regions": ["Singapore", "Shenzhen", "San Jose"],
        "summary": "Designs edge AI accelerator modules for robotics and industrial vision teams expanding outside China.",
        "company_profile": "Singapore-headquartered semiconductor platform with China-origin founders, US reseller relationships, and stated plans to support OEM customers in North America and ASEAN.",
        "globalization_signal_summary": "Operates bilingual hiring pages, lists Singapore HQ, Shenzhen hardware team, and US channel coverage with overseas customer support hours.",
        "infra_demand_likelihood": "High likelihood of needing burst inference, cross-border API mediation, and export-aware infrastructure for customer demos and partner integrations.",
        "target_contact_roles": json.dumps(["CTO", "VP Engineering", "Head of Platform", "Global IT Director"]),
        "recommended_opening_angle": "Position DCDeepTech as the fastest route to compliant Singapore-to-China inference access plus OCP-aligned racks for hardware labs and customer POCs.",
        "employee_band": "120-250",
        "stage": "Series B",
        "is_usd_backed": 1,
        "international_backing": 1,
    },
    {
        "id": "harbor-robotics",
        "name": "Harbor Robotics Cloud",
        "normalized_name": "harbor robotics cloud",
        "website": "https://harborrobotics.example",
        "hq_country": "Hong Kong",
        "china_link_type": "ops-in-mainland",
        "global_regions": ["Hong Kong", "Shanghai", "Munich"],
        "summary": "Runs fleet orchestration and simulation infrastructure for warehouse robot operators across Europe and Greater China.",
        "company_profile": "International robotics SaaS firm with operations in mainland China and Europe, selling uptime-critical simulation and model serving workflows to logistics operators.",
        "globalization_signal_summary": "Mentions EU deployments, multilingual support, and integration partnerships with European systems integrators.",
        "infra_demand_likelihood": "Strong need for API gateway controls, global inference endpoints, and policy separation between China operations and overseas customer data.",
        "target_contact_roles": json.dumps(["COO", "Head of AI Infrastructure", "Director of Solutions", "CISO"]),
        "recommended_opening_angle": "Lead with resilient gateway + compliance posture for cross-border robot telemetry and model routing, then expand into dedicated inference clusters.",
        "employee_band": "250-500",
        "stage": "Series C",
        "is_usd_backed": 1,
        "international_backing": 1,
    },
    {
        "id": "jade-inference",
        "name": "Jade Inference Labs",
        "normalized_name": "jade inference labs",
        "website": "https://jadeinference.example",
        "hq_country": "United States",
        "china_link_type": "research-team",
        "global_regions": ["Palo Alto", "Beijing", "Singapore"],
        "summary": "Builds vertical inference tooling for multilingual customer support and developer copilots.",
        "company_profile": "US-incorporated applied AI company with research and annotation presence in Beijing, plus commercial expansion in Singapore for APAC accounts.",
        "globalization_signal_summary": "Highlights US fundraising, APAC go-to-market hiring, and cross-border data handling constraints in customer security docs.",
        "infra_demand_likelihood": "High demand for compliance-aware gatewaying, managed inference, and traffic localization for enterprise accounts that split workloads by region.",
        "target_contact_roles": json.dumps(["CEO", "Head of Infrastructure", "VP Product", "Solutions Architect"]),
        "recommended_opening_angle": "Offer DCDeepTech as a launchpad for APAC enterprise expansion with Singapore control plane governance and China-compatible deployment options.",
        "employee_band": "80-150",
        "stage": "Series A",
        "is_usd_backed": 1,
        "international_backing": 1,
    },
    {
        "id": "silkchain-health",
        "name": "SilkChain Health AI",
        "normalized_name": "silkchain health ai",
        "website": "https://silkchainhealth.example",
        "hq_country": "Singapore",
        "china_link_type": "supply-chain",
        "global_regions": ["Singapore", "Suzhou", "Dubai"],
        "summary": "Develops imaging analysis and hospital workflow tools for clinics serving medical tourists and regional health groups.",
        "company_profile": "Healthcare AI operator serving hospital groups across Southeast Asia and China-linked device partners, with growing regional compliance obligations.",
        "globalization_signal_summary": "Signals regional expansion through distributor programs, Gulf partnerships, and multilingual product releases.",
        "infra_demand_likelihood": "Moderate to high need for secure inference service, auditability, and compliance support where patient data and overseas deployment intersect.",
        "target_contact_roles": json.dumps(["Chief Digital Officer", "VP Partnerships", "Head of Compliance", "CTO"]),
        "recommended_opening_angle": "Start from regulated AI infrastructure and audit logging for regional health deployments, then discuss managed inference and gateway controls.",
        "employee_band": "150-300",
        "stage": "Series B",
        "is_usd_backed": 0,
        "international_backing": 1,
    },
    {
        "id": "red-dune-autonomy",
        "name": "Red Dune Autonomy",
        "normalized_name": "red dune autonomy",
        "website": "https://reddune.example",
        "hq_country": "United Arab Emirates",
        "china_link_type": "joint-venture",
        "global_regions": ["Abu Dhabi", "Shenzhen", "Singapore"],
        "summary": "Provides autonomy stack and fleet analytics for port, mining, and special vehicle operators.",
        "company_profile": "UAE-based autonomy company with China-linked hardware partnerships and international investors backing expansion into industrial AI deployments.",
        "globalization_signal_summary": "Shows overseas tender participation, English-first materials, and multinational board/adviser presence.",
        "infra_demand_likelihood": "Likely buyer of edge inference hardware, OCP-inspired rack layouts, and cross-border gatewaying for mixed on-prem and cloud operations.",
        "target_contact_roles": json.dumps(["GM International", "Head of AI Ops", "Platform Lead", "VP Strategy"]),
        "recommended_opening_angle": "Open on ruggedized edge inference plus compliant regional control architecture for industrial autonomy projects spanning China-linked hardware and foreign operators.",
        "employee_band": "60-120",
        "stage": "Growth",
        "is_usd_backed": 1,
        "international_backing": 1,
    },
    {
        "id": "lotus-grid",
        "name": "Lotus Grid Vision",
        "normalized_name": "lotus grid vision",
        "website": "https://lotusgrid.example",
        "hq_country": "Malaysia",
        "china_link_type": "manufacturing",
        "global_regions": ["Kuala Lumpur", "Guangzhou"],
        "summary": "Industrial inspection startup serving power electronics and battery manufacturers.",
        "company_profile": "Growing computer vision vendor with manufacturing ties in China and early Southeast Asia enterprise customers.",
        "globalization_signal_summary": "Exports product collateral in English, attends regional trade events, but has fewer hard international operating signals than top-tier prospects.",
        "infra_demand_likelihood": "Some need for gateway and inference support, but urgency appears lower until export customers or funding increase.",
        "target_contact_roles": json.dumps(["Founder", "Manufacturing IT Lead", "Head of Delivery"]),
        "recommended_opening_angle": "Lead with scalable pilot infrastructure for factory AI deployments and introduce cross-border readiness as they expand outside current markets.",
        "employee_band": "30-80",
        "stage": "Seed",
        "is_usd_backed": 0,
        "international_backing": 0,
    },
]

SEED_FUNDING_EVENTS: list[dict[str, Any]] = [
    {
        "id": "fund-aurora-1",
        "company_id": "aurora-semi",
        "announced_at": "2025-09-18",
        "round_name": "Series B",
        "amount_usd_m": 42.0,
        "investors": json.dumps(["North Bridge Capital", "Temasek-backed deep tech fund", "US strategic semiconductor investor"]),
        "funding_signal_summary": "Series B included US strategic investor participation and Singapore institutional backing, indicating comfort with cross-border scaling.",
    },
    {
        "id": "fund-harbor-1",
        "company_id": "harbor-robotics",
        "announced_at": "2025-04-03",
        "round_name": "Series C",
        "amount_usd_m": 65.0,
        "investors": json.dumps(["Atlantic Horizon Ventures", "European logistics fund", "Existing Hong Kong family office"]),
        "funding_signal_summary": "Large USD-denominated growth round with European logistics participation supports international expansion and enterprise infrastructure spend.",
    },
    {
        "id": "fund-jade-1",
        "company_id": "jade-inference",
        "announced_at": "2025-11-08",
        "round_name": "Series A",
        "amount_usd_m": 18.5,
        "investors": json.dumps(["US enterprise AI fund", "Singapore operator angel syndicate"]),
        "funding_signal_summary": "US-led Series A plus Singapore go-to-market angels suggest fast overseas customer acquisition and willingness to buy infrastructure.",
    },
    {
        "id": "fund-silk-1",
        "company_id": "silkchain-health",
        "announced_at": "2024-12-15",
        "round_name": "Series B",
        "amount_usd_m": 27.0,
        "investors": json.dumps(["Regional healthcare fund", "Middle East hospital group"]),
        "funding_signal_summary": "International healthcare strategic participation raises compliance and regional deployment complexity even without a clear USD-led cap table.",
    },
    {
        "id": "fund-reddune-1",
        "company_id": "red-dune-autonomy",
        "announced_at": "2025-07-29",
        "round_name": "Growth",
        "amount_usd_m": 33.0,
        "investors": json.dumps(["US industrial tech investor", "GCC sovereign innovation arm"]),
        "funding_signal_summary": "Industrial growth capital from US and GCC investors points to urgent infrastructure build-out for large-scale autonomy programs.",
    },
    {
        "id": "fund-lotus-1",
        "company_id": "lotus-grid",
        "announced_at": "2024-08-11",
        "round_name": "Seed",
        "amount_usd_m": 3.2,
        "investors": json.dumps(["Local angel network"]),
        "funding_signal_summary": "Early seed financing exists, but there is limited evidence of international backing or imminent enterprise-scale infra demand.",
    },
]


def init_schema() -> None:
    with conn() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS companies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                normalized_name TEXT NOT NULL,
                website TEXT NOT NULL,
                hq_country TEXT NOT NULL,
                china_link_type TEXT NOT NULL,
                global_regions TEXT NOT NULL,
                summary TEXT NOT NULL,
                company_profile TEXT NOT NULL,
                globalization_signal_summary TEXT NOT NULL,
                infra_demand_likelihood TEXT NOT NULL,
                target_contact_roles TEXT NOT NULL,
                recommended_opening_angle TEXT NOT NULL,
                employee_band TEXT NOT NULL,
                stage TEXT NOT NULL,
                is_usd_backed INTEGER NOT NULL DEFAULT 0,
                international_backing INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS funding_events (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                announced_at TEXT NOT NULL,
                round_name TEXT NOT NULL,
                amount_usd_m REAL NOT NULL,
                investors TEXT NOT NULL,
                funding_signal_summary TEXT NOT NULL,
                FOREIGN KEY(company_id) REFERENCES companies(id)
            );
            CREATE INDEX IF NOT EXISTS idx_funding_company_id
            ON funding_events(company_id);

            CREATE TABLE IF NOT EXISTS lead_scores (
                company_id TEXT PRIMARY KEY,
                funding_score INTEGER NOT NULL,
                globalization_score INTEGER NOT NULL,
                infra_fit_score INTEGER NOT NULL,
                qualification_confidence INTEGER NOT NULL,
                final_lead_score INTEGER NOT NULL,
                score_rationale TEXT NOT NULL,
                last_qualified_at TEXT NOT NULL,
                target_roles TEXT NOT NULL,
                opening_angle TEXT NOT NULL,
                FOREIGN KEY(company_id) REFERENCES companies(id)
            );
            """
        )


def seed_data() -> None:
    init_schema()
    with conn() as connection:
        company_count = connection.execute("SELECT COUNT(*) AS count FROM companies").fetchone()["count"]
        if company_count:
            return

        connection.executemany(
            """
            INSERT INTO companies (
                id, name, normalized_name, website, hq_country, china_link_type, global_regions,
                summary, company_profile, globalization_signal_summary, infra_demand_likelihood,
                target_contact_roles, recommended_opening_angle, employee_band, stage,
                is_usd_backed, international_backing
            ) VALUES (
                :id, :name, :normalized_name, :website, :hq_country, :china_link_type, :global_regions,
                :summary, :company_profile, :globalization_signal_summary, :infra_demand_likelihood,
                :target_contact_roles, :recommended_opening_angle, :employee_band, :stage,
                :is_usd_backed, :international_backing
            )
            """,
            [
                {**company, "global_regions": json.dumps(company["global_regions"])}
                for company in SEED_COMPANIES
            ],
        )

        connection.executemany(
            """
            INSERT INTO funding_events (
                id, company_id, announced_at, round_name, amount_usd_m, investors, funding_signal_summary
            ) VALUES (
                :id, :company_id, :announced_at, :round_name, :amount_usd_m, :investors, :funding_signal_summary
            )
            """,
            SEED_FUNDING_EVENTS,
        )

        score_rows = [build_score_row(company["id"]) for company in SEED_COMPANIES]
        connection.executemany(
            """
            INSERT INTO lead_scores (
                company_id, funding_score, globalization_score, infra_fit_score,
                qualification_confidence, final_lead_score, score_rationale, last_qualified_at,
                target_roles, opening_angle
            ) VALUES (
                :company_id, :funding_score, :globalization_score, :infra_fit_score,
                :qualification_confidence, :final_lead_score, :score_rationale, :last_qualified_at,
                :target_roles, :opening_angle
            )
            """,
            score_rows,
        )


def build_score_row(company_id: str) -> dict[str, Any]:
    company = next(item for item in SEED_COMPANIES if item["id"] == company_id)
    funding_event = next(item for item in SEED_FUNDING_EVENTS if item["company_id"] == company_id)

    funding_score = 90 if company["is_usd_backed"] else 68 if company["international_backing"] else 42
    globalization_score = min(95, 55 + len(company["global_regions"]) * 12 + (8 if company["international_backing"] else 0))

    infra_keywords = company["infra_demand_likelihood"].lower()
    infra_fit_score = 58
    for needle, bonus in {
        "high": 22,
        "strong": 18,
        "api gateway": 8,
        "managed inference": 10,
        "ocp": 7,
        "compliance": 6,
    }.items():
        if needle in infra_keywords:
            infra_fit_score += bonus
    infra_fit_score = min(96, infra_fit_score)

    qualification_confidence = min(
        97,
        60 + (12 if funding_event["amount_usd_m"] >= 15 else 0) + (10 if company["international_backing"] else 0),
    )
    final_lead_score = round(
        funding_score * 0.3
        + globalization_score * 0.25
        + infra_fit_score * 0.3
        + qualification_confidence * 0.15
    )
    return {
        "company_id": company_id,
        "funding_score": funding_score,
        "globalization_score": globalization_score,
        "infra_fit_score": infra_fit_score,
        "qualification_confidence": qualification_confidence,
        "final_lead_score": final_lead_score,
        "score_rationale": (
            f"{company['name']} scores well because it shows {company['china_link_type']} ties, "
            f"{'clear' if company['international_backing'] else 'limited'} international backing, "
            f"and a {company['stage']} budget profile with {funding_event['round_name']} momentum."
        ),
        "last_qualified_at": "2026-04-12T10:00:00Z",
        "target_roles": company["target_contact_roles"],
        "opening_angle": company["recommended_opening_angle"],
    }
