from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
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
    due_today = db.query(func.count(Task.id)).filter(
        Task.end_date == today,
        Task.status != "completed",
    ).scalar()
    due_this_week = db.query(func.count(Task.id)).filter(
        Task.end_date >= today,
        Task.end_date <= today + timedelta(days=7),
        Task.status != "completed",
    ).scalar()
    overdue = db.query(func.count(Task.id)).filter(
        Task.end_date < today,
        Task.status != "completed",
    ).scalar()

    members = db.query(TeamMember).all()
    workload = []
    for m in members:
        count = db.query(func.count(Task.id)).filter(
            Task.assignee_id == m.id,
            Task.status != "completed",
        ).scalar()
        workload.append({"id": m.id, "name": m.name, "role": m.role, "active_tasks": count})

    return {
        "total_tasks": total,
        "by_status": {s: c for s, c in by_status},
        "due_today": due_today,
        "due_this_week": due_this_week,
        "overdue": overdue,
        "workload": workload,
    }
