from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Comment, Task, TeamMember
from schemas import CommentCreate, CommentOut
from auth_utils import get_current_user

router = APIRouter(prefix="/tasks", tags=["comments"])


@router.get("/{task_id}/comments", response_model=List[CommentOut])
def list_comments(task_id: int, db: Session = Depends(get_db)):
    if not db.query(Task).filter(Task.id == task_id).first():
        raise HTTPException(status_code=404, detail="Task not found.")
    return db.query(Comment).filter(Comment.task_id == task_id).order_by(Comment.created_at).all()


@router.post("/{task_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(task_id: int, payload: CommentCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    if not db.query(Task).filter(Task.id == task_id).first():
        raise HTTPException(status_code=404, detail="Task not found.")
    # Always resolve author name from DB so it reflects the actual logged-in user
    member = db.query(TeamMember).filter(TeamMember.email == user["email"]).first()
    author = member.name if member else user.get("name", "Unknown")
    comment = Comment(task_id=task_id, content=payload.content, author=author)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
