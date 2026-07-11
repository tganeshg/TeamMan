from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date, timedelta

from database import get_db
from models import Task, TeamMember

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(db: Session = Depends(get_db)):
    today = date.today()

    total = db.query(func.count(Task.id)).scalar()
    by_status = (
        db.query(Task.status, func.count(Task.id))
        .group_by(Task.status)
        .all()
    )
    _terminal = ["SID12", "SID13"]
    due_today = db.query(func.count(Task.id)).filter(
        Task.end_date == today,
        Task.status.notin_(_terminal),
    ).scalar()
    due_this_week = db.query(func.count(Task.id)).filter(
        Task.end_date >= today,
        Task.end_date <= today + timedelta(days=7),
        Task.status.notin_(_terminal),
    ).scalar()
    overdue = db.query(func.count(Task.id)).filter(
        Task.end_date < today,
        Task.status.notin_(_terminal),
    ).scalar()
    closed = db.query(func.count(Task.id)).filter(
        Task.status.in_(["SID12", "SID13"]),
    ).scalar()

    members = db.query(TeamMember).all()
    workload = []
    for m in members:
        count = db.query(func.count(Task.id)).filter(
            Task.assignee_id == m.id,
            Task.status.notin_(["SID12", "SID13"]),
        ).scalar()
        workload.append({"id": m.id, "name": m.name, "role": m.role, "active_tasks": count})

    return {
        "total_tasks": total,
        "by_status": {s: c for s, c in by_status},
        "due_today": due_today,
        "due_this_week": due_this_week,
        "overdue": overdue,
        "closed": closed,
        "workload": workload,
    }


@router.get("/activity")
def get_activity(db: Session = Depends(get_db)):
    tasks = (
        db.query(Task)
        .options(joinedload(Task.assignee))
        .order_by(Task.updated_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            "assignee": t.assignee.name if t.assignee else None,
        }
        for t in tasks
    ]
