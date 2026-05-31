from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Label
from schemas import LabelCreate, LabelOut

router = APIRouter(prefix="/labels", tags=["labels"])


@router.get("", response_model=List[LabelOut])
def list_labels(db: Session = Depends(get_db)):
    return db.query(Label).order_by(Label.name).all()


@router.post("", response_model=LabelOut, status_code=201)
def create_label(payload: LabelCreate, db: Session = Depends(get_db)):
    existing = db.query(Label).filter(Label.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Label name already exists.")
    label = Label(**payload.model_dump())
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.put("/{label_id}", response_model=LabelOut)
def update_label(label_id: int, payload: LabelCreate, db: Session = Depends(get_db)):
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found.")
    label.name = payload.name
    label.color = payload.color
    db.commit()
    db.refresh(label)
    return label


@router.delete("/{label_id}", status_code=204)
def delete_label(label_id: int, db: Session = Depends(get_db)):
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found.")
    db.delete(label)
    db.commit()
