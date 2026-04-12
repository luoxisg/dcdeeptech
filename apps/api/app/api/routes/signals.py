from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from ...db.session import get_db
from ...schemas.models import CompanySignalModel, SignalReviewRequestModel, SignalReviewResponseModel
from ...services.serializers import iso, signal_to_model
from packages.db.models import Company, CompanySignal, SignalReview

router = APIRouter()


@router.get("/leads/{company_id}/signals", response_model=list[CompanySignalModel])
def list_signals(company_id: str, db: Session = Depends(get_db)):
    company = db.query(Company).options(selectinload(Company.signals).selectinload("*")).filter(Company.company_id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Lead not found")
    return [signal_to_model(item) for item in sorted(company.signals, key=lambda signal: signal.source_date, reverse=True)]


@router.post("/signals/{signal_id}/review", response_model=SignalReviewResponseModel)
def review_signal(signal_id: str, payload: SignalReviewRequestModel, db: Session = Depends(get_db)):
    signal = db.query(CompanySignal).options(selectinload(CompanySignal.reviews)).filter(CompanySignal.signal_id == signal_id).first()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    review = signal.reviews[0] if signal.reviews else SignalReview(review_id=str(uuid4()), signal_id=signal.signal_id)
    review.review_status = payload.review_status
    review.note = payload.note or None
    db.add(review)
    db.commit()
    db.refresh(review)
    return {"signal_id": signal_id, "review_status": review.review_status, "note": review.note, "reviewed_at": iso(review.reviewed_at)}
