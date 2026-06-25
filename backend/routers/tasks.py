from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date, timedelta

from database import get_db
from models import Task, Label, TeamMember, TaskChecklistItem
from schemas import TaskCreate, TaskUpdate, TaskOut, TaskDetail, AssignRequest

router = APIRouter(prefix="/tasks", tags=["tasks"])

_TERMINAL = {"SID12", "SID13"}   # Closed, Released
_PROBLEM  = {"SID07", "SID11"}   # Rework, Reopened
_WAITING  = {"SID10", "SID14"}   # Waiting, On Hold
_READY    = {"SID08", "SID09"}   # Ready to Merge / Release


# ── Color ─────────────────────────────────────────────────────────────────────

def compute_color(task: Task) -> str:
    today = date.today()
    if task.status in _TERMINAL: return "green"
    if task.status in _PROBLEM:  return "red"
    if task.status in _WAITING:  return "orange"
    if task.end_date:
        if task.end_date < today:                      return "red"
        if task.end_date <= today + timedelta(days=2): return "orange"
    if task.status in _READY: return "green"
    return "blue"


def enrich(task: Task) -> TaskOut:
    out = TaskOut.model_validate(task)
    out.color = compute_color(task)
    out.checklist_total = len(task.checklist)
    out.checklist_done = sum(1 for c in task.checklist if c.done)
    return out


# ── Checklist ───────────────────────────────────────────────────────────────────

def _sync_checklist(db: Session, task: Task, items: list) -> None:
    """Replace the task's checklist with `items` (list of {id?, text, done}),
    in the given order. Existing items (matched by id) are updated in place so
    their completion status is preserved; missing ones are deleted; new ones
    (no id) are inserted. Position follows list order. Blank rows are dropped."""
    existing = {ci.id: ci for ci in task.checklist}
    seen = set()
    pos = 0
    for it in items:
        text = (it.get("text") or "").strip()
        if not text:
            continue
        item_id = it.get("id")
        done = bool(it.get("done", False))
        if item_id and item_id in existing:
            ci = existing[item_id]
            ci.text = text
            ci.done = done
            ci.position = pos
            seen.add(item_id)
        else:
            db.add(TaskChecklistItem(task_id=task.id, text=text, done=done, position=pos))
        pos += 1
    for item_id, ci in existing.items():
        if item_id not in seen:
            db.delete(ci)
    db.flush()


# ── Priority management ────────────────────────────────────────────────────────
#
# The queue for each (assignee) is always a clean 1..N sequence.
# All operations go through _apply_priority() which:
#   1. Loads all tasks for the member (sorted by current priority)
#   2. Removes the target task from its current slot (if it already has one)
#   3. Inserts it at the desired position (clamped to 1..N)
#   4. Writes back sequential priorities 1..N to all tasks in one go
#
# This is O(N) but N is always small (tasks per member), and it is
# 100% correct with no SQLAlchemy session-sync issues.

def _apply_priority(db: Session, assignee_id: int, task_id: int, new_priority: int):
    """Place task_id at new_priority in the assignee's queue, keeping the
    queue as a clean 1..N sequence. Handles insert, move, and re-prioritising
    a task whose current priority is NULL (e.g. newly assigned / unprioritised).

    Sets task.priority directly on the Task object — caller must NOT set it again.
    """

    # The existing queue for this member (clean 1..N), excluding the task
    # being placed so it is never counted twice or ordered by a stale value.
    others = (
        db.query(Task)
        .filter(
            Task.assignee_id == assignee_id,
            Task.priority.isnot(None),
            Task.id != task_id,
        )
        .order_by(Task.priority)
        .all()
    )

    # Fetch the task being placed directly by id, so it is found even when its
    # current priority is NULL (it would be excluded from the queue query above).
    target = db.query(Task).filter(Task.id == task_id).first()

    # Clamp new_priority to [1, len(others)+1]
    clamped = max(1, min(new_priority, len(others) + 1))

    # Build the final ordered list: insert target at clamped position,
    # then assign sequential priorities 1..N to every task.
    ordered = others[:]
    if target is not None:
        ordered.insert(clamped - 1, target)   # 0-indexed insert

    for i, t in enumerate(ordered):
        t.priority = i + 1

    db.flush()
    return clamped


# ── Routes ────────────────────────────────────────────────────────────────────

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
    active: Optional[bool] = Query(None),
    sort_by: str = Query("priority"),
    sort_order: str = Query("asc"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Task).options(joinedload(Task.assignee), joinedload(Task.labels), joinedload(Task.checklist))
    if assignee_id is not None: q = q.filter(Task.assignee_id == assignee_id)
    if status:          q = q.filter(Task.status == status)
    if active:          q = q.filter(Task.status.notin_(_TERMINAL))
    if task_type:       q = q.filter(Task.task_type == task_type)
    if start_date_from: q = q.filter(Task.start_date >= start_date_from)
    if start_date_to:   q = q.filter(Task.start_date <= start_date_to)
    if end_date_from:   q = q.filter(Task.end_date >= end_date_from)
    if end_date_to:     q = q.filter(Task.end_date <= end_date_to)
    if search:
        kw = f"%{search.strip()}%"
        q = q.filter(
            Task.title.ilike(kw) | Task.portal_task_id.ilike(kw)
        )
    if label_ids:
        ids = [int(i) for i in label_ids.split(",") if i.strip().isdigit()]
        if ids:
            q = q.filter(Task.labels.any(Label.id.in_(ids)))
    col_map = {
        "priority": Task.priority, "title": Task.title,
        "start_date": Task.start_date, "end_date": Task.end_date,
        "created_at": Task.created_at,
    }
    col = col_map.get(sort_by, Task.priority)
    q = q.order_by(col.asc() if sort_order == "asc" else col.desc())
    return [enrich(t) for t in q.all()]


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    label_ids = payload.label_ids or []
    checklist = payload.checklist
    task_data = payload.model_dump(exclude={"label_ids", "checklist"})

    if task_data.get("status") in _TERMINAL:
        task_data.setdefault("closed_at", date.today())

    task = Task(**task_data)
    if label_ids:
        task.labels = db.query(Label).filter(Label.id.in_(label_ids)).all()
    db.add(task)
    db.flush()   # get task.id before priority assignment

    if checklist:
        _sync_checklist(db, task, [c.model_dump() for c in checklist])

    # Assign priority AFTER the task exists so _apply_priority can find it
    if task.assignee_id and task.priority is not None:
        _apply_priority(db, task.assignee_id, task.id, task.priority)
        # _apply_priority already set task.priority to the clamped value
    elif task.assignee_id:
        # No explicit priority — append to the end of the member's queue,
        # leaving all existing task priorities unchanged.
        count = db.query(Task).filter(
            Task.assignee_id == task.assignee_id,
            Task.priority.isnot(None),
            Task.id != task.id,
        ).count()
        task.priority = count + 1

    db.commit()
    db.refresh(task)
    return enrich(task)


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.labels),
        joinedload(Task.comments), joinedload(Task.attachments),
        joinedload(Task.checklist),
    ).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    out = TaskDetail.model_validate(task)
    out.color = compute_color(task)
    out.checklist_total = len(task.checklist)
    out.checklist_done = sum(1 for c in task.checklist if c.done)
    return out


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    data = payload.model_dump(exclude_unset=True)
    label_ids = data.pop("label_ids", None)
    data.pop("checklist", None)   # handled separately below

    new_priority = data.pop("priority", None)
    new_assignee = data.get("assignee_id", task.assignee_id)

    # Apply all non-priority field changes first
    new_status = data.get("status")
    if new_status:
        if new_status in _TERMINAL and task.status not in _TERMINAL:
            data["closed_at"] = date.today()
        elif new_status not in _TERMINAL and task.status in _TERMINAL:
            data["closed_at"] = None

    for field, value in data.items():
        setattr(task, field, value)

    if label_ids is not None:
        task.labels = db.query(Label).filter(Label.id.in_(label_ids)).all()

    # Now handle priority change
    if new_priority is not None:
        effective_assignee = new_assignee  # may have just been updated above

        if effective_assignee:
            if effective_assignee != task.assignee_id:
                # Reassigned to different member — remove from old queue first
                # (old queue compact: handled by _apply_priority excluding this task)
                pass  # _apply_priority already excludes task_id from query

            _apply_priority(db, effective_assignee, task.id, new_priority)
            # _apply_priority already set task.priority directly
        else:
            task.priority = new_priority
    elif new_assignee and new_assignee != task.assignee_id:
        # Assignee changed but no explicit priority — append to end of new queue
        count = db.query(Task).filter(
            Task.assignee_id == new_assignee,
            Task.priority.isnot(None),
            Task.id != task.id,
        ).count()
        task.priority = count + 1

    # Sync checklist only when the field was explicitly provided (an empty
    # list clears it; omitting the field leaves the checklist untouched).
    if "checklist" in payload.model_fields_set:
        _sync_checklist(db, task, [c.model_dump() for c in (payload.checklist or [])])

    db.commit()
    db.refresh(task)
    return enrich(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    # Remove this task's slot and compact the queue
    if task.assignee_id and task.priority is not None:
        db.query(Task).filter(
            Task.assignee_id == task.assignee_id,
            Task.priority > task.priority,
        ).all()
        others = db.query(Task).filter(
            Task.assignee_id == task.assignee_id,
            Task.priority > task.priority,
            Task.id != task_id,
        ).all()
        for t in others:
            t.priority -= 1
        db.flush()

    db.delete(task)
    db.commit()


@router.post("/{task_id}/assign", response_model=TaskOut)
def assign_task(task_id: int, payload: AssignRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    if not db.query(TeamMember).filter(TeamMember.id == payload.assignee_id).first():
        raise HTTPException(status_code=404, detail="Member not found.")

    task.assignee_id = payload.assignee_id
    db.flush()
    _apply_priority(db, payload.assignee_id, task.id, payload.priority)

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
