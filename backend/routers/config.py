from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import AppConfig

router = APIRouter(prefix="/config", tags=["config"])

RELEASE_DATE_KEY = "release_date"


class ReleaseDateIn(BaseModel):
    release_date: Optional[str] = None  # ISO date string YYYY-MM-DD or None


class ReleaseDateOut(BaseModel):
    release_date: Optional[str] = None


@router.get("/release-date", response_model=ReleaseDateOut)
def get_release_date(db: Session = Depends(get_db)):
    row = db.query(AppConfig).filter(AppConfig.key == RELEASE_DATE_KEY).first()
    return ReleaseDateOut(release_date=row.value if row else None)


@router.post("/release-date", response_model=ReleaseDateOut)
def set_release_date(payload: ReleaseDateIn, db: Session = Depends(get_db)):
    row = db.query(AppConfig).filter(AppConfig.key == RELEASE_DATE_KEY).first()
    if row:
        row.value = payload.release_date
    else:
        row = AppConfig(key=RELEASE_DATE_KEY, value=payload.release_date)
        db.add(row)
    db.commit()
    return ReleaseDateOut(release_date=payload.release_date)
