from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import TaskRelation, Task
from schemas import TaskRelationCreate, TaskRelationOut, RELATION_TYPES

router = APIRouter(prefix="/tasks", tags=["relations"])


def _build_out(rel: TaskRelation, task_id: int) -> dict:
    """Build a TaskRelationOut dict from the perspective of task_id."""
    other = rel.to_task if rel.from_task_id == task_id else rel.from_task
    return {
        "id": rel.id,
        "from_task_id": rel.from_task_id,
        "to_task_id": rel.to_task_id,
        "relation_type": rel.relation_type,
        "related_task_id": other.id,
        "related_task_title": other.title,
        "related_task_portal_id": other.portal_task_id,
        "created_at": rel.created_at,
    }


@router.get("/{task_id}/relations", response_model=list[TaskRelationOut])
def list_relations(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    rels = db.query(TaskRelation).filter(
        (TaskRelation.from_task_id == task_id) | (TaskRelation.to_task_id == task_id)
    ).all()
    return [_build_out(r, task_id) for r in rels]


@router.post("/{task_id}/relations", response_model=TaskRelationOut)
def add_relation(task_id: int, payload: TaskRelationCreate, db: Session = Depends(get_db)):
    if payload.relation_type not in RELATION_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid relation_type. Must be one of: {', '.join(RELATION_TYPES)}")
    if task_id == payload.to_task_id:
        raise HTTPException(status_code=400, detail="A task cannot be related to itself.")
    if not db.query(Task).filter(Task.id == task_id).first():
        raise HTTPException(status_code=404, detail="Source task not found")
    if not db.query(Task).filter(Task.id == payload.to_task_id).first():
        raise HTTPException(status_code=404, detail="Target task not found")

    # Prevent duplicate relation between same pair (any direction)
    exists = db.query(TaskRelation).filter(
        (
            (TaskRelation.from_task_id == task_id) & (TaskRelation.to_task_id == payload.to_task_id)
        ) | (
            (TaskRelation.from_task_id == payload.to_task_id) & (TaskRelation.to_task_id == task_id)
        )
    ).filter(TaskRelation.relation_type == payload.relation_type).first()
    if exists:
        raise HTTPException(status_code=409, detail="This relation already exists.")

    rel = TaskRelation(
        from_task_id=task_id,
        to_task_id=payload.to_task_id,
        relation_type=payload.relation_type,
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return _build_out(rel, task_id)


@router.delete("/{task_id}/relations/{relation_id}", status_code=204)
def delete_relation(task_id: int, relation_id: int, db: Session = Depends(get_db)):
    rel = db.query(TaskRelation).filter(
        TaskRelation.id == relation_id,
        (TaskRelation.from_task_id == task_id) | (TaskRelation.to_task_id == task_id)
    ).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relation not found")
    db.delete(rel)
    db.commit()
