from __future__ import annotations
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


# ── Team Members ──────────────────────────────────────────────────────────────

class MemberBase(BaseModel):
    name: str
    email: str
    role: str  # Lead | Senior | Junior | Intern


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class MemberOut(MemberBase):
    id: int
    created_at: datetime
    task_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ── Labels ────────────────────────────────────────────────────────────────────

class LabelBase(BaseModel):
    name: str
    color: str = "#1890ff"


class LabelCreate(LabelBase):
    pass


class LabelOut(LabelBase):
    id: int

    class Config:
        from_attributes = True


# ── Tasks ─────────────────────────────────────────────────────────────────────

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: str = "feature"  # bug | feature
    portal_task_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = "SID00"


class TaskCreate(TaskBase):
    assignee_id: Optional[int] = None
    priority: Optional[int] = None
    label_ids: Optional[List[int]] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[str] = None
    portal_task_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    assignee_id: Optional[int] = None
    priority: Optional[int] = None
    label_ids: Optional[List[int]] = None


class AssignRequest(BaseModel):
    assignee_id: int
    priority: int


class TaskOut(TaskBase):
    id: int
    assignee_id: Optional[int] = None
    assignee: Optional[MemberOut] = None
    priority: Optional[int] = None
    color: str = "gray"
    labels: List[LabelOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskDetail(TaskOut):
    comments: List[CommentOut] = []
    attachments: List[AttachmentOut] = []


# ── Comments ──────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str
    author: str = "Project Lead"


class CommentOut(BaseModel):
    id: int
    task_id: int
    content: str
    author: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Attachments ───────────────────────────────────────────────────────────────

class AttachmentOut(BaseModel):
    id: int
    task_id: int
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Task Relations ────────────────────────────────────────────────────────────

RELATION_TYPES = {"duplicate", "parent", "child", "blocks", "blocked_by", "related_to"}


class TaskRelationCreate(BaseModel):
    to_task_id: int
    relation_type: str  # duplicate|parent|child|blocks|blocked_by|related_to


class TaskRelationOut(BaseModel):
    id: int
    from_task_id: int
    to_task_id: int
    relation_type: str
    related_task_id: int          # convenience: the "other" task id
    related_task_title: str
    related_task_portal_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Portal ────────────────────────────────────────────────────────────────────

class PortalCredentialIn(BaseModel):
    portal_url: str
    api_token: str


class PortalCredentialStatus(BaseModel):
    configured: bool
    portal_url: Optional[str] = None


class MantisIssue(BaseModel):
    portal_task_id: str
    title: str
    description: Optional[str] = None
    reporter: Optional[str] = None
    severity: Optional[str] = None
    portal_status: Optional[str] = None


# ── Filters ───────────────────────────────────────────────────────────────────

class TaskFilter(BaseModel):
    assignee_id: Optional[int] = None
    status: Optional[str] = None
    task_type: Optional[str] = None
    label_ids: Optional[List[int]] = None
    start_date_from: Optional[date] = None
    start_date_to: Optional[date] = None
    end_date_from: Optional[date] = None
    end_date_to: Optional[date] = None
    sort_by: Optional[str] = "priority"   # priority | title | start_date | end_date
    sort_order: Optional[str] = "asc"     # asc | desc


# ── Todo ──────────────────────────────────────────────────────────────────────

class TodoItemCreate(BaseModel):
    text: str
    done: bool = False
    position: int = 0


class TodoItemUpdate(BaseModel):
    text: Optional[str] = None
    done: Optional[bool] = None
    position: Optional[int] = None


class TodoItemOut(BaseModel):
    id: int
    thread_id: int
    text: str
    done: bool
    position: int
    created_at: datetime

    class Config:
        from_attributes = True


class TodoThreadCreate(BaseModel):
    heading: str
    description: Optional[str] = None
    meeting: Optional[str] = None


class TodoThreadUpdate(BaseModel):
    heading: Optional[str] = None
    description: Optional[str] = None
    meeting: Optional[str] = None
    status: Optional[str] = None


class TodoThreadOut(BaseModel):
    id: int
    heading: str
    description: Optional[str] = None
    meeting: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    items: List[TodoItemOut] = []

    class Config:
        from_attributes = True


# forward refs
TaskDetail.model_rebuild()
