from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from database import get_db
from models import TeamMember, Task
from schemas import MemberCreate, MemberUpdate, MemberOut

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=List[MemberOut])
def list_members(db: Session = Depends(get_db)):
    members = db.query(TeamMember).order_by(TeamMember.name).all()
    result = []
    for m in members:
        count = db.query(func.count(Task.id)).filter(Task.assignee_id == m.id).scalar()
        out = MemberOut.model_validate(m)
        out.task_count = count
        result.append(out)
    return result


@router.post("", response_model=MemberOut, status_code=201)
def create_member(payload: MemberCreate, db: Session = Depends(get_db)):
    existing = db.query(TeamMember).filter(TeamMember.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    member = TeamMember(**payload.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    out = MemberOut.model_validate(member)
    out.task_count = 0
    return out


@router.put("/{member_id}", response_model=MemberOut)
def update_member(member_id: int, payload: MemberUpdate, db: Session = Depends(get_db)):
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    count = db.query(func.count(Task.id)).filter(Task.assignee_id == member.id).scalar()
    out = MemberOut.model_validate(member)
    out.task_count = count
    return out


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")
    db.delete(member)
    db.commit()
