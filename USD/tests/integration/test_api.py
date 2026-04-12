from fastapi.testclient import TestClient

from apps.api.app.main import app


client = TestClient(app)


def test_search_endpoint_returns_ranked_results():
    response = client.post(
        "/api/search",
        json={
            "user_query_name": "Agent A targets",
            "filters": {"agent_type": "vie_usd", "minimum_score": 50, "page": 1, "page_size": 20},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert all(item["primary_score"]["fit_score"] >= 50 for item in body["items"])


def test_get_lead_detail():
    response = client.get("/api/leads/nebula-interactive")
    assert response.status_code == 200
    body = response.json()
    assert body["company"]["company_id"] == "nebula-interactive"
    assert len(body["signals"]) >= 1


def test_watchlist_and_export_and_signal_review():
    watch_response = client.post("/api/watchlist", json={"company_id": "latticeflow-cloud", "notes": "Monitor finance hiring", "tags": ["monitor"]})
    assert watch_response.status_code == 200
    review_response = client.post("/api/signals/sig-lattice-1/review", json={"review_status": "valid", "note": "Strong evidence"})
    assert review_response.status_code == 200
    export_response = client.post("/api/export", json={"format": "csv", "watchlist_only": True})
    assert export_response.status_code == 200
    assert "company_id,company_name_cn" in export_response.json()["payload"]
