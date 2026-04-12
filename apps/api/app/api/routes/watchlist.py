from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from ...db.session import get_db
from ...schemas.models import WatchlistModel, WatchlistRequestModel
from ...services.serializers import build_lead_card, iso
from packages.db.models import Company, CompanySignal, Watchlist

router = APIRouter()


@router.post("/watchlist", response_model=WatchlistModel)
def upsert_watchlist(payload: WatchlistRequestModel, db: Session = Depends(get_db)):
    item = db.query(Watchlist).filter(Watchlist.company_id == payload.company_id).first()
    if not item:
        item = Watchlist(watchlist_id=str(uuid4()), company_id=payload.company_id)
        db.add(item)
    item.notes = payload.notes
    item.tags = payload.tags
    db.commit()
    db.refresh(item)
    return {
        "watchlist_id": item.watchlist_id,
        "company_id": item.company_id,
        "notes": item.notes,
        "tags": item.tags,
        "created_at": iso(item.created_at),
        "lead": None,
    }


@router.get("/watchlist", response_model=list[WatchlistModel])
def list_watchlist(db: Session = Depends(get_db)):
    items = (
        db.query(Watchlist)
        .options(
            selectinload(Watchlist.company).selectinload(Company.signals).selectinload(CompanySignal.reviews),
            selectinload(Watchlist.company).selectinload(Company.scores),
        )
        .all()
    )
    response = []
    for item in items:
        response.append(
            {
                "watchlist_id": item.watchlist_id,
                "company_id": item.company_id,
                "notes": item.notes,
                "tags": item.tags,
                "created_at": iso(item.created_at),
                "lead": build_lead_card(item.company),
            }
        )
    return response
