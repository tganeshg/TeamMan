from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(tags=["todos"])


# ── Threads ───────────────────────────────────────────────────────────────────

@router.get("/todos", response_model=list[schemas.TodoThreadOut])
def list_threads(db: Session = Depends(get_db)):
    return (
        db.query(models.TodoThread)
        .order_by(models.TodoThread.position.asc(), models.TodoThread.created_at.desc())
        .all()
    )


@router.post("/todos", response_model=schemas.TodoThreadOut)
def create_thread(data: schemas.TodoThreadCreate, db: Session = Depends(get_db)):
    # New threads appear on top: shift everyone down, insert at position 0.
    db.query(models.TodoThread).update(
        {models.TodoThread.position: models.TodoThread.position + 1}
    )
    thread = models.TodoThread(**data.model_dump(), position=0)
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


# Reorder must be declared BEFORE "/todos/{thread_id}" so "reorder" is not
# captured as a thread_id path parameter.
@router.put("/todos/reorder")
def reorder_threads(data: schemas.ReorderRequest, db: Session = Depends(get_db)):
    for pos, thread_id in enumerate(data.ordered_ids):
        db.query(models.TodoThread).filter(models.TodoThread.id == thread_id).update(
            {models.TodoThread.position: pos}
        )
    db.commit()
    return {"ok": True}


@router.put("/todos/{thread_id}", response_model=schemas.TodoThreadOut)
def update_thread(thread_id: int, data: schemas.TodoThreadUpdate, db: Session = Depends(get_db)):
    thread = db.get(models.TodoThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(thread, k, v)
    db.commit()
    db.refresh(thread)
    return thread


@router.delete("/todos/{thread_id}")
def delete_thread(thread_id: int, db: Session = Depends(get_db)):
    thread = db.get(models.TodoThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    db.delete(thread)
    db.commit()
    return {"ok": True}


# ── Items — separate prefix to avoid route conflict ───────────────────────────

@router.post("/todos/{thread_id}/items", response_model=schemas.TodoItemOut)
def add_item(thread_id: int, data: schemas.TodoItemCreate, db: Session = Depends(get_db)):
    thread = db.get(models.TodoThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    count = len(thread.items)
    item = models.TodoItem(thread_id=thread_id, text=data.text, done=data.done, position=count)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# Reorder must be declared BEFORE "/todo-items/{item_id}".
@router.put("/todo-items/reorder")
def reorder_items(data: schemas.ReorderRequest, db: Session = Depends(get_db)):
    for pos, item_id in enumerate(data.ordered_ids):
        db.query(models.TodoItem).filter(models.TodoItem.id == item_id).update(
            {models.TodoItem.position: pos}
        )
    db.commit()
    return {"ok": True}


@router.put("/todo-items/{item_id}", response_model=schemas.TodoItemOut)
def update_item(item_id: int, data: schemas.TodoItemUpdate, db: Session = Depends(get_db)):
    item = db.get(models.TodoItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/todo-items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.TodoItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
