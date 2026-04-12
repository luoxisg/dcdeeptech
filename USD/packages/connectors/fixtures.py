from __future__ import annotations

DEMO_FIXTURES = [
    {
        "company": {
            "company_id": "nebula-interactive",
            "company_name_cn": "星云互动控股",
            "company_name_en": "Nebula Interactive Holdings",
            "website": "https://nebula-interactive.example",
            "domain": "nebula-interactive.example",
            "industry_primary": "Gaming",
            "industry_secondary": "Digital Entertainment",
            "company_type": "Private Group",
            "china_linked": True,
            "china_link_strength": 92,
            "hq_country": "Singapore",
            "hq_city": "Singapore",
            "operating_regions": ["China", "Singapore", "Japan", "United States"],
            "english_site": True,
            "status": "active",
            "description": "China-founded mobile game publisher with offshore group structure, overseas publishing revenue, and finance expansion across APAC.",
            "source_count": 4
        },
        "signals": [
            {
                "signal_id": "sig-nebula-1",
                "signal_type": "funding",
                "signal_subtype": "usd_round",
                "title": "Series B announcement references US dollar financing",
                "evidence_text": "The company announced a US$45M Series B led by international venture investors through its Singapore holding company.",
                "source_url": "https://news.example/nebula-series-b",
                "source_date": "2025-11-08T00:00:00",
                "confidence": 0.95,
                "raw_metadata": {"mapped_fields": ["usd_funding", "offshore_structure", "regional_hq"], "flags": ["usd", "holdco", "international_vc"]}
            },
            {
                "signal_id": "sig-nebula-2",
                "signal_type": "hiring",
                "signal_subtype": "finance_legal",
                "title": "Head of Finance APAC and Legal Counsel roles posted",
                "evidence_text": "Hiring page seeks APAC Head of Finance and Legal Counsel with ESOP administration and regional compliance experience.",
                "source_url": "https://jobs.example/nebula",
                "source_date": "2026-02-10T00:00:00",
                "confidence": 0.88,
                "raw_metadata": {"mapped_fields": ["contactability", "compliance_need"], "flags": ["esop", "finance_hiring", "legal_hiring"]}
            }
        ],
        "funding_events": [
            {
                "funding_id": "fund-nebula-1",
                "round_name": "Series B",
                "announce_date": "2025-11-08T00:00:00",
                "amount_text": "US$45M",
                "currency_hint": "USD",
                "investors": ["Harbor Peak Ventures", "Global Catalyst Capital"],
                "international_investor_flag": True,
                "offshore_entity_hint": True,
                "source_url": "https://news.example/nebula-series-b",
                "confidence": 0.95
            }
        ],
        "watchlist": {"notes": "Strong CFO / founder office angle", "tags": ["P1", "Agent A"]}
    },
    {
        "company": {
            "company_id": "orchid-bio",
            "company_name_cn": "兰科生物",
            "company_name_en": "Orchid Bio Ventures",
            "website": "https://orchid-bio.example",
            "domain": "orchid-bio.example",
            "industry_primary": "Biotech",
            "industry_secondary": "Healthcare",
            "company_type": "Private Venture-backed",
            "china_linked": True,
            "china_link_strength": 84,
            "hq_country": "Hong Kong",
            "hq_city": "Hong Kong",
            "operating_regions": ["China", "Hong Kong", "United States"],
            "english_site": True,
            "status": "active",
            "description": "Cross-border biotech venture with offshore holding entities, international investors, and expanding finance operations.",
            "source_count": 3
        },
        "signals": [
            {
                "signal_id": "sig-orchid-1",
                "signal_type": "corporate",
                "signal_subtype": "offshore_restructure",
                "title": "Corporate materials reference Cayman and HK subsidiaries",
                "evidence_text": "The group structure chart references a Cayman parent, Hong Kong holding company, and mainland operating entities.",
                "source_url": "https://orchid-bio.example/structure",
                "source_date": "2025-09-20T00:00:00",
                "confidence": 0.91,
                "raw_metadata": {"mapped_fields": ["offshore_structure"], "flags": ["cayman", "hong_kong", "spv"]}
            },
            {
                "signal_id": "sig-orchid-2",
                "signal_type": "hiring",
                "signal_subtype": "finance",
                "title": "Regional finance manager posting mentions FX and stock option administration",
                "evidence_text": "Job description covers FX settlement, stock option tracking, and board reporting for offshore entities.",
                "source_url": "https://jobs.example/orchid",
                "source_date": "2026-01-13T00:00:00",
                "confidence": 0.82,
                "raw_metadata": {"mapped_fields": ["compliance_need", "contactability"], "flags": ["fx", "stock_option", "finance_hiring"]}
            }
        ],
        "funding_events": [
            {
                "funding_id": "fund-orchid-1",
                "round_name": "Series A",
                "announce_date": "2025-05-17T00:00:00",
                "amount_text": "US$18M",
                "currency_hint": "USD",
                "investors": ["North Shore Ventures", "Atlas Healthcare Fund"],
                "international_investor_flag": True,
                "offshore_entity_hint": True,
                "source_url": "https://news.example/orchid-series-a",
                "confidence": 0.9
            }
        ],
        "watchlist": None
    },
    {
        "company": {
            "company_id": "pixelport",
            "company_name_cn": "像素港科技",
            "company_name_en": "PixelPort Games",
            "website": "https://pixelport.example",
            "domain": "pixelport.example",
            "industry_primary": "Gaming",
            "industry_secondary": "Subscription Software",
            "company_type": "Private Growth",
            "china_linked": True,
            "china_link_strength": 86,
            "hq_country": "Singapore",
            "hq_city": "Singapore",
            "operating_regions": ["China", "Singapore", "Korea", "Germany", "Brazil"],
            "english_site": True,
            "status": "active",
            "description": "Game and subscription platform operator managing cross-border app store revenue, regional pricing, and payments complexity.",
            "source_count": 5
        },
        "signals": [
            {
                "signal_id": "sig-pixelport-1",
                "signal_type": "product",
                "signal_subtype": "multi_country_pricing",
                "title": "App store pages show localized pricing and subscriptions",
                "evidence_text": "The company sells digital subscriptions with localized pricing across more than 20 countries via Apple and Google ecosystems.",
                "source_url": "https://apps.example/pixelport",
                "source_date": "2026-02-20T00:00:00",
                "confidence": 0.93,
                "raw_metadata": {"mapped_fields": ["digital_globalization", "tax_complexity"], "flags": ["app_store", "subscriptions", "multi_country_pricing"]}
            },
            {
                "signal_id": "sig-pixelport-2",
                "signal_type": "hiring",
                "signal_subtype": "payments_tax",
                "title": "Payments operations lead hiring references VAT and merchant routing",
                "evidence_text": "Role requires ownership of VAT/GST issues, payment service providers, and regional merchant-of-record design.",
                "source_url": "https://jobs.example/pixelport",
                "source_date": "2026-03-03T00:00:00",
                "confidence": 0.9,
                "raw_metadata": {"mapped_fields": ["tax_complexity", "platform_infra_need", "contactability"], "flags": ["vat_gst", "payments", "platform_hiring"]}
            }
        ],
        "funding_events": [
            {
                "funding_id": "fund-pixelport-1",
                "round_name": "Growth",
                "announce_date": "2025-08-22T00:00:00",
                "amount_text": "US$30M",
                "currency_hint": "USD",
                "investors": ["Delta Consumer Tech", "Sea Lane Capital"],
                "international_investor_flag": True,
                "offshore_entity_hint": False,
                "source_url": "https://news.example/pixelport-growth",
                "confidence": 0.84
            }
        ],
        "watchlist": {"notes": "Useful for international COO outreach", "tags": ["Agent B"]}
    },
    {
        "company": {
            "company_id": "latticeflow-cloud",
            "company_name_cn": "矩阵流云",
            "company_name_en": "LatticeFlow Cloud",
            "website": "https://latticeflow.example",
            "domain": "latticeflow.example",
            "industry_primary": "SaaS",
            "industry_secondary": "Developer Tools",
            "company_type": "Private SaaS",
            "china_linked": True,
            "china_link_strength": 76,
            "hq_country": "United Arab Emirates",
            "hq_city": "Dubai",
            "operating_regions": ["China", "UAE", "Singapore", "Europe"],
            "english_site": True,
            "status": "active",
            "description": "Developer-facing SaaS with international recurring revenue, regional operations hiring, and payments/compliance complexity.",
            "source_count": 4
        },
        "signals": [
            {
                "signal_id": "sig-lattice-1",
                "signal_type": "operations",
                "signal_subtype": "regional_hq",
                "title": "Regional HQ announcement in Dubai references EMEA billing operations",
                "evidence_text": "The company opened a Dubai regional HQ to coordinate EMEA sales contracts, partner billing, and platform compliance.",
                "source_url": "https://news.example/lattice-hq",
                "source_date": "2025-12-02T00:00:00",
                "confidence": 0.85,
                "raw_metadata": {"mapped_fields": ["digital_globalization", "platform_infra_need"], "flags": ["regional_hq", "billing", "compliance"]}
            },
            {
                "signal_id": "sig-lattice-2",
                "signal_type": "hiring",
                "signal_subtype": "tax_compliance",
                "title": "International tax and platform operations roles posted",
                "evidence_text": "Hiring for international tax manager and platform operations roles covering VAT, data compliance, and payments routing.",
                "source_url": "https://jobs.example/lattice",
                "source_date": "2026-03-01T00:00:00",
                "confidence": 0.87,
                "raw_metadata": {"mapped_fields": ["tax_complexity", "contactability"], "flags": ["vat_gst", "platform_hiring", "tax_hiring"]}
            }
        ],
        "funding_events": [
            {
                "funding_id": "fund-lattice-1",
                "round_name": "Series B",
                "announce_date": "2025-10-11T00:00:00",
                "amount_text": "US$22M",
                "currency_hint": "USD",
                "investors": ["Meridian SaaS Fund"],
                "international_investor_flag": True,
                "offshore_entity_hint": False,
                "source_url": "https://news.example/lattice-series-b",
                "confidence": 0.83
            }
        ],
        "watchlist": None
    },
    {
        "company": {
            "company_id": "atlas-battery",
            "company_name_cn": "远图电池集团",
            "company_name_en": "Atlas Battery Group",
            "website": "https://atlas-battery.example",
            "domain": "atlas-battery.example",
            "industry_primary": "Battery",
            "industry_secondary": "Manufacturing",
            "company_type": "Listed Group",
            "china_linked": True,
            "china_link_strength": 95,
            "hq_country": "China",
            "hq_city": "Shenzhen",
            "operating_regions": ["China", "Thailand", "Mexico", "Germany"],
            "english_site": True,
            "status": "active",
            "description": "Large battery manufacturer building overseas plants and redesigning procurement, customs, and treasury operations.",
            "source_count": 6
        },
        "signals": [
            {
                "signal_id": "sig-atlas-1",
                "signal_type": "expansion",
                "signal_subtype": "overseas_factory",
                "title": "Mexico battery plant investment announced",
                "evidence_text": "The group announced a new battery plant in Mexico to support North American customers and regional trade flows.",
                "source_url": "https://news.example/atlas-mexico-plant",
                "source_date": "2026-01-19T00:00:00",
                "confidence": 0.96,
                "raw_metadata": {"mapped_fields": ["overseas_factory", "enterprise_value"], "flags": ["factory", "capex", "listed_group"]}
            },
            {
                "signal_id": "sig-atlas-2",
                "signal_type": "operations",
                "signal_subtype": "treasury_center",
                "title": "Treasury and customs specialists hired for Thailand and Mexico entities",
                "evidence_text": "Job postings seek treasury, transfer pricing, and customs valuation specialists for cross-border manufacturing flows.",
                "source_url": "https://jobs.example/atlas",
                "source_date": "2026-02-27T00:00:00",
                "confidence": 0.92,
                "raw_metadata": {"mapped_fields": ["tp_customs_complexity", "treasury_hq", "contactability"], "flags": ["transfer_pricing", "customs", "treasury"]}
            }
        ],
        "funding_events": [],
        "watchlist": {"notes": "High-value Group Tax and Treasury angle", "tags": ["P1", "Agent C"]}
    },
    {
        "company": {
            "company_id": "solarmesh-industrial",
            "company_name_cn": "光网工业",
            "company_name_en": "SolarMesh Industrial",
            "website": "https://solarmesh.example",
            "domain": "solarmesh.example",
            "industry_primary": "Solar",
            "industry_secondary": "Industrial Equipment",
            "company_type": "Private Industrial Group",
            "china_linked": True,
            "china_link_strength": 88,
            "hq_country": "China",
            "hq_city": "Suzhou",
            "operating_regions": ["China", "Vietnam", "Hungary"],
            "english_site": True,
            "status": "active",
            "description": "Solar equipment supplier with new Vietnam assembly capacity and emerging European procurement and treasury structures.",
            "source_count": 4
        },
        "signals": [
            {
                "signal_id": "sig-solar-1",
                "signal_type": "expansion",
                "signal_subtype": "supply_chain_relocation",
                "title": "Vietnam assembly hub launched for overseas customers",
                "evidence_text": "The company launched Vietnam assembly operations and a regional procurement center to support European deliveries.",
                "source_url": "https://news.example/solarmesh-vietnam",
                "source_date": "2025-12-15T00:00:00",
                "confidence": 0.89,
                "raw_metadata": {"mapped_fields": ["overseas_factory", "treasury_hq"], "flags": ["vietnam", "procurement_center"]}
            },
            {
                "signal_id": "sig-solar-2",
                "signal_type": "finance",
                "signal_subtype": "trade_flows",
                "title": "Finance team references customs and intercompany pricing controls",
                "evidence_text": "Finance process memo references customs valuation, intercompany pricing alignment, and regional cash management.",
                "source_url": "https://news.example/solarmesh-finance",
                "source_date": "2026-02-06T00:00:00",
                "confidence": 0.84,
                "raw_metadata": {"mapped_fields": ["tp_customs_complexity", "treasury_hq"], "flags": ["customs", "intercompany", "cash_management"]}
            }
        ],
        "funding_events": [],
        "watchlist": None
    }
]
