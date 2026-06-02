from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Release
from schemas import ReleaseCreate, ReleaseUpdate, ReleaseOut

router = APIRouter(prefix="/releases", tags=["releases"])


@router.get("", response_model=List[ReleaseOut])
def list_releases(db: Session = Depends(get_db)):
    return db.query(Release).order_by(Release.release_date.desc()).all()


@router.post("", response_model=ReleaseOut, status_code=201)
def create_release(payload: ReleaseCreate, db: Session = Depends(get_db)):
    release = Release(name=payload.name, release_date=payload.release_date)
    db.add(release)
    db.commit()
    db.refresh(release)
    return release


@router.put("/{release_id}", response_model=ReleaseOut)
def update_release(release_id: int, payload: ReleaseUpdate, db: Session = Depends(get_db)):
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(release, field, value)
    db.commit()
    db.refresh(release)
    return release


@router.delete("/{release_id}", status_code=204)
def delete_release(release_id: int, db: Session = Depends(get_db)):
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    db.delete(release)
    db.commit()
