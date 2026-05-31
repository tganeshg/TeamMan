import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Attachment, Task
from schemas import AttachmentOut

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(tags=["attachments"])


@router.get("/tasks/{task_id}/attachments", response_model=List[AttachmentOut])
def list_attachments(task_id: int, db: Session = Depends(get_db)):
    if not db.query(Task).filter(Task.id == task_id).first():
        raise HTTPException(status_code=404, detail="Task not found.")
    return db.query(Attachment).filter(Attachment.task_id == task_id).all()


@router.post("/tasks/{task_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not db.query(Task).filter(Task.id == task_id).first():
        raise HTTPException(status_code=404, detail="Task not found.")

    ext = os.path.splitext(file.filename or "")[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, stored_name)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    attachment = Attachment(
        task_id=task_id,
        filename=file.filename or stored_name,
        filepath=stored_name,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: int, db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    filepath = os.path.join(UPLOAD_DIR, att.filepath)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File missing from disk.")
    return FileResponse(filepath, filename=att.filename)


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    filepath = os.path.join(UPLOAD_DIR, att.filepath)
    if os.path.exists(filepath):
        os.remove(filepath)
    db.delete(att)
    db.commit()
