from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import date, timedelta

from database import get_db
from models import Task, Label, TeamMember
from schemas import TaskCreate, TaskUpdate, TaskOut, TaskDetail, AssignRequest

router = APIRouter(prefix="/tasks", tags=["tasks"])


_TERMINAL  = {"SID12", "SID13"}           # Closed, Released
_PROBLEM   = {"SID07", "SID11"}           # Rework, Reopened
_WAITING   = {"SID10", "SID14"}           # Waiting, On Hold
_READY     = {"SID08", "SID09"}           # Ready to Merge / Release


def compute_color(task: Task) -> str:
    today = date.today()
    if task.status in _TERMINAL:
        return "green"
    if task.status in _PROBLEM:
        return "red"
    if task.status in _WAITING:
        return "orange"
    if task.end_date:
        if task.end_date < today:
            return "red"
        if task.end_date <= today + timedelta(days=2):
            return "orange"
    if task.status in _READY:
        return "green"
    return "blue"


def enrich(task: Task) -> TaskOut:
    out = TaskOut.model_validate(task)
    out.color = compute_color(task)
    return out


def _reorder_priorities(db: Session, assignee_id: int, from_priority: int, exclude_task_id: Optional[int] = None):
    q = db.query(Task).filter(
        Task.assignee_id == assignee_id,
        Task.priority >= from_priority,
    )
    if exclude_task_id is not None:
        q = q.filter(Task.id != exclude_task_id)
    for t in q.all():
        t.priority = t.priority + 1


@router.get("", response_model=List[TaskOut])
def list_tasks(
    assignee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    task_type: Optional[str] = Query(None),
    label_ids: Optional[str] = Query(None),
    start_date_from: Optional[date] = Query(None),
    start_date_to: Optional[date] = Query(None),
    end_date_from: Optional[date] = Query(None),
    end_date_to: Optional[date] = Query(None),
    sort_by: str = Query("priority"),
    sort_order: str = Query("asc"),
    db: Session = Depends(get_db),
):
    q = db.query(Task).options(
        joinedload(Task.assignee),
        joinedload(Task.labels),
    )

    if assignee_id is not None:
        q = q.filter(Task.assignee_id == assignee_id)
    if status:
        q = q.filter(Task.status == status)
    if task_type:
        q = q.filter(Task.task_type == task_type)
    if start_date_from:
        q = q.filter(Task.start_date >= start_date_from)
    if start_date_to:
        q = q.filter(Task.start_date <= start_date_to)
    if end_date_from:
        q = q.filter(Task.end_date >= end_date_from)
    if end_date_to:
        q = q.filter(Task.end_date <= end_date_to)
    if label_ids:
        ids = [int(i) for i in label_ids.split(",") if i.strip().isdigit()]
        if ids:
            q = q.filter(Task.labels.any(Label.id.in_(ids)))

    col_map = {
        "priority": Task.priority,
        "title": Task.title,
        "start_date": Task.start_date,
        "end_date": Task.end_date,
        "created_at": Task.created_at,
    }
    col = col_map.get(sort_by, Task.priority)
    q = q.order_by(col.asc() if sort_order == "asc" else col.desc())

    tasks = q.all()
    return [enrich(t) for t in tasks]


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    label_ids = payload.label_ids or []
    task_data = payload.model_dump(exclude={"label_ids"})

    if task_data.get("assignee_id") and task_data.get("priority") is not None:
        _reorder_priorities(db, task_data["assignee_id"], task_data["priority"])

    task = Task(**task_data)
    if label_ids:
        labels = db.query(Label).filter(Label.id.in_(label_ids)).all()
        task.labels = labels

    db.add(task)
    db.commit()
    db.refresh(task)
    return enrich(task)


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).options(
        joinedload(Task.assignee),
        joinedload(Task.labels),
        joinedload(Task.comments),
        joinedload(Task.attachments),
    ).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    out = TaskDetail.model_validate(task)
    out.color = compute_color(task)
    return out


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    data = payload.model_dump(exclude_unset=True)
    label_ids = data.pop("label_ids", None)

    new_priority = data.get("priority")
    new_assignee = data.get("assignee_id", task.assignee_id)

    if new_priority is not None and new_assignee:
        if new_priority != task.priority or new_assignee != task.assignee_id:
            # free old slot
            if task.priority is not None and task.assignee_id:
                _compact_priorities(db, task.assignee_id, task.priority, task.id)
            _reorder_priorities(db, new_assignee, new_priority, exclude_task_id=task.id)

    for field, value in data.items():
        setattr(task, field, value)

    if label_ids is not None:
        labels = db.query(Label).filter(Label.id.in_(label_ids)).all()
        task.labels = labels

    db.commit()
    db.refresh(task)
    return enrich(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    if task.assignee_id and task.priority is not None:
        _compact_priorities(db, task.assignee_id, task.priority, task_id)

    db.delete(task)
    db.commit()


@router.post("/{task_id}/assign", response_model=TaskOut)
def assign_task(task_id: int, payload: AssignRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    member = db.query(TeamMember).filter(TeamMember.id == payload.assignee_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    # free old priority slot
    if task.assignee_id and task.priority is not None:
        _compact_priorities(db, task.assignee_id, task.priority, task_id)

    _reorder_priorities(db, payload.assignee_id, payload.priority, exclude_task_id=task_id)
    task.assignee_id = payload.assignee_id
    task.priority = payload.priority

    db.commit()
    db.refresh(task)
    return enrich(task)


@router.post("/{task_id}/labels/{label_id}", response_model=TaskOut)
def add_label(task_id: int, label_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found.")
    if label not in task.labels:
        task.labels.append(label)
        db.commit()
        db.refresh(task)
    return enrich(task)


@router.delete("/{task_id}/labels/{label_id}", response_model=TaskOut)
def remove_label(task_id: int, label_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    label = db.query(Label).filter(Label.id == label_id).first()
    if label and label in task.labels:
        task.labels.remove(label)
        db.commit()
        db.refresh(task)
    return enrich(task)


def _compact_priorities(db: Session, assignee_id: int, freed_priority: int, skip_task_id: int):
    tasks = db.query(Task).filter(
        Task.assignee_id == assignee_id,
        Task.priority > freed_priority,
        Task.id != skip_task_id,
    ).all()
    for t in tasks:
        t.priority = t.priority - 1
