from fastapi.testclient import TestClient

from app.main import app
from db.models import seed_data


seed_data()
client = TestClient(app)


def test_list_companies():
    response = client.get("/lead-intel/companies", params={"min_score": 70})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert all(item["lead_score"]["final_lead_score"] >= 70 for item in data["items"])


def test_qualify_company():
    response = client.post("/lead-intel/qualify/aurora-semi")
    assert response.status_code == 200
    data = response.json()
    assert data["company_id"] == "aurora-semi"
    assert data["final_lead_score"] >= 70


def test_export_csv():
    response = client.get("/lead-intel/export", params={"format": "csv", "ids": "aurora-semi,jade-inference"})
    assert response.status_code == 200
    data = response.json()
    assert data["format"] == "csv"
    assert "company,hq_country,website" in data["payload"]
