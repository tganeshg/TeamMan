from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Date, DateTime,
    ForeignKey, Boolean, func
)
from sqlalchemy.orm import relationship
from database import Base


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, nullable=False)  # Lead, Senior, Junior, Intern
    created_at = Column(DateTime, default=func.now())

    tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")


task_labels = __import__("sqlalchemy", fromlist=["Table", "Column", "Integer", "ForeignKey"]).Table(
    "task_labels",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("label_id", Integer, ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
)


class Label(Base):
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, nullable=False, default="#1890ff")

    tasks = relationship("Task", secondary=task_labels, back_populates="labels")


class Release(Base):
    __tablename__ = "releases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    release_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="active")  # active | completed
    created_at = Column(DateTime, default=func.now())

    tasks = relationship("Task", back_populates="release")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    portal_task_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String, nullable=False, default="feature")  # bug or feature
    assignee_id = Column(Integer, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    priority = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="SID00")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    release_id = Column(Integer, ForeignKey("releases.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(Date, nullable=True)  # auto-set when status → SID12/SID13
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    assignee = relationship("TeamMember", back_populates="tasks", foreign_keys=[assignee_id])
    release = relationship("Release", back_populates="tasks")
    labels = relationship("Label", secondary=task_labels, back_populates="tasks")
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan", order_by="Comment.created_at")
    attachments = relationship("Attachment", back_populates="task", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String, nullable=False, default="Project Lead")
    created_at = Column(DateTime, default=func.now())

    task = relationship("Task", back_populates="comments")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())

    task = relationship("Task", back_populates="attachments")


class PortalCredential(Base):
    __tablename__ = "portal_credentials"

    id = Column(Integer, primary_key=True, index=True)
    portal_url = Column(String, nullable=False)
    api_token_enc = Column(Text, nullable=False)


class TaskRelation(Base):
    __tablename__ = "task_relations"

    id = Column(Integer, primary_key=True, index=True)
    from_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    to_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String, nullable=False)  # duplicate|parent|child|blocks|blocked_by|related_to
    created_at = Column(DateTime, default=func.now())

    from_task = relationship("Task", foreign_keys=[from_task_id])
    to_task = relationship("Task", foreign_keys=[to_task_id])


class AppConfig(Base):
    __tablename__ = "app_config"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)


class TodoThread(Base):
    __tablename__ = "todo_threads"

    id = Column(Integer, primary_key=True, index=True)
    heading = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    meeting = Column(String, nullable=True)   # free-text meeting reference
    status = Column(String, nullable=False, default="open")  # open | done
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    items = relationship("TodoItem", back_populates="thread", cascade="all, delete-orphan", order_by="TodoItem.position")


class TodoItem(Base):
    __tablename__ = "todo_items"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("todo_threads.id", ondelete="CASCADE"), nullable=False)
    text = Column(String, nullable=False)
    done = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=func.now())

    thread = relationship("TodoThread", back_populates="items")
