from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth_utils import get_current_user
import models, schemas

router = APIRouter(tags=["todos"])


def _resolve_member_id(user: dict, db: Session) -> int | None:
    """Always return the DB member id for the current user, even if the JWT is stale.
    For the system lead@teamman.local account, resolves to the first Lead-role member."""
    member = db.query(models.TeamMember).filter(models.TeamMember.email == user["email"]).first()
    if member:
        # If this is the system account with no real member row equivalent, fall back to first Lead
        if member.email == "lead@teamman.local":
            real_lead = (
                db.query(models.TeamMember)
                .filter(models.TeamMember.role == "Lead", models.TeamMember.email != "lead@teamman.local")
                .order_by(models.TeamMember.id.asc())
                .first()
            )
            return real_lead.id if real_lead else member.id
        return member.id
    return user["id"]


# ── Threads ───────────────────────────────────────────────────────────────────

@router.get("/todos", response_model=list[schemas.TodoThreadOut])
def list_threads(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    member_id = _resolve_member_id(user, db)
    return (
        db.query(models.TodoThread)
        .filter(models.TodoThread.member_id == member_id)
        .order_by(models.TodoThread.position.asc(), models.TodoThread.created_at.desc())
        .all()
    )


@router.post("/todos", response_model=schemas.TodoThreadOut)
def create_thread(data: schemas.TodoThreadCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    member_id = _resolve_member_id(user, db)
    # New threads appear on top: shift this user's threads down, insert at position 0.
    db.query(models.TodoThread).filter(models.TodoThread.member_id == member_id).update(
        {models.TodoThread.position: models.TodoThread.position + 1}
    )
    thread = models.TodoThread(**data.model_dump(), position=0, member_id=member_id)
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


# Reorder must be declared BEFORE "/todos/{thread_id}" so "reorder" is not
# captured as a thread_id path parameter.
@router.put("/todos/reorder")
def reorder_threads(data: schemas.ReorderRequest, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    member_id = _resolve_member_id(user, db)
    for pos, thread_id in enumerate(data.ordered_ids):
        db.query(models.TodoThread).filter(
            models.TodoThread.id == thread_id,
            models.TodoThread.member_id == member_id
        ).update({models.TodoThread.position: pos})
    db.commit()
    return {"ok": True}


@router.put("/todos/{thread_id}", response_model=schemas.TodoThreadOut)
def update_thread(thread_id: int, data: schemas.TodoThreadUpdate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    member_id = _resolve_member_id(user, db)
    thread = db.query(models.TodoThread).filter(
        models.TodoThread.id == thread_id,
        models.TodoThread.member_id == member_id
    ).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(thread, k, v)
    db.commit()
    db.refresh(thread)
    return thread


@router.delete("/todos/{thread_id}")
def delete_thread(thread_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    member_id = _resolve_member_id(user, db)
    thread = db.query(models.TodoThread).filter(
        models.TodoThread.id == thread_id,
        models.TodoThread.member_id == member_id
    ).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    db.delete(thread)
    db.commit()
    return {"ok": True}


# ── Items — separate prefix to avoid route conflict ───────────────────────────

def _get_thread_for_user(thread_id: int, user: dict, db: Session) -> models.TodoThread:
    """Fetch a thread that belongs to the current user, or raise 404."""
    member_id = _resolve_member_id(user, db)
    thread = db.query(models.TodoThread).filter(
        models.TodoThread.id == thread_id,
        models.TodoThread.member_id == member_id
    ).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


@router.post("/todos/{thread_id}/items", response_model=schemas.TodoItemOut)
def add_item(thread_id: int, data: schemas.TodoItemCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    thread = _get_thread_for_user(thread_id, user, db)
    count = len(thread.items)
    item = models.TodoItem(thread_id=thread_id, text=data.text, done=data.done, position=count)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/todos/{thread_id}/items/bulk", response_model=list[schemas.TodoItemOut])
def add_items_bulk(thread_id: int, data: schemas.TodoItemsBulkCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Append many checklist items at once (e.g. each line of an uploaded text
    file). Blank entries are skipped; new items go to the end in order."""
    thread = _get_thread_for_user(thread_id, user, db)
    texts = [t.strip() for t in data.items if t.strip()]
    count = len(thread.items)
    created = []
    for i, text in enumerate(texts):
        item = models.TodoItem(thread_id=thread_id, text=text, done=False, position=count + i)
        db.add(item)
        created.append(item)
    db.commit()
    for item in created:
        db.refresh(item)
    return created


# Reorder must be declared BEFORE "/todo-items/{item_id}".
@router.put("/todo-items/reorder")
def reorder_items(data: schemas.ReorderRequest, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    member_id = _resolve_member_id(user, db)
    for pos, item_id in enumerate(data.ordered_ids):
        item = db.query(models.TodoItem).filter(models.TodoItem.id == item_id).first()
        if item:
            thread = db.query(models.TodoThread).filter(
                models.TodoThread.id == item.thread_id,
                models.TodoThread.member_id == member_id
            ).first()
            if thread:
                item.position = pos
    db.commit()
    return {"ok": True}


@router.put("/todo-items/{item_id}", response_model=schemas.TodoItemOut)
def update_item(item_id: int, data: schemas.TodoItemUpdate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    member_id = _resolve_member_id(user, db)
    item = db.query(models.TodoItem).filter(models.TodoItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    parent_thread = db.query(models.TodoThread).filter(
        models.TodoThread.id == item.thread_id,
        models.TodoThread.member_id == member_id
    ).first()
    if not parent_thread:
        raise HTTPException(status_code=404, detail="Item not found")
    if data.thread_id is not None and data.thread_id != item.thread_id:
        _get_thread_for_user(data.thread_id, user, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/todo-items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    member_id = _resolve_member_id(user, db)
    item = db.query(models.TodoItem).filter(models.TodoItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    thread = db.query(models.TodoThread).filter(
        models.TodoThread.id == item.thread_id,
        models.TodoThread.member_id == member_id
    ).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
