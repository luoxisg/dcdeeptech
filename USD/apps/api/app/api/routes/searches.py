from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...services.serializers import iso
from packages.db.models import Search

router = APIRouter()


@router.get("/searches", response_model=list[dict])
def list_searches(db: Session = Depends(get_db)):
    searches = db.query(Search).order_by(Search.created_at.desc()).limit(20).all()
    return [
        {
            "search_id": item.search_id,
            "user_query_name": item.user_query_name,
            "filters_json": item.filters_json,
            "result_count": item.result_count,
            "created_at": iso(item.created_at),
        }
        for item in searches
    ]
