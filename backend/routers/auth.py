import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import TeamMember, AppConfig
from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_lead,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_lead_email(db: Session) -> str:
    row = db.query(AppConfig).filter(AppConfig.key == "lead_email").first()
    if row and row.value:
        return row.value
    return os.environ.get("LEAD_EMAIL", "lead@teamman.local")


def _get_lead_password_hash(db: Session) -> Optional[str]:
    row = db.query(AppConfig).filter(AppConfig.key == "lead_password_hash").first()
    return row.value if row else None


def _set_config(db: Session, key: str, value: str) -> None:
    row = db.query(AppConfig).filter(AppConfig.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppConfig(key=key, value=value))
    db.commit()


def _build_token_response(role: str, name: str, email: str, member_id: Optional[int]):
    token = create_access_token(
        {"id": member_id, "email": email, "name": name, "role": role}
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": role,
        "name": name,
        "id": member_id,
    }


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LoginBody(BaseModel):
    email: str
    password: str


class SetPasswordBody(BaseModel):
    email: str
    new_password: str


class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str


class LeadEmailBody(BaseModel):
    email: str


class LeadSetPasswordBody(BaseModel):
    new_password: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    lead_email = _get_lead_email(db)

    if body.email.lower() == lead_email.lower():
        # Lead login
        lead_hash = _get_lead_password_hash(db)
        if not lead_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Lead password not configured. Use /auth/lead-set-password to set it.",
            )
        if not verify_password(body.password, lead_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return _build_token_response("lead", "Project Lead", lead_email, None)

    # Member login
    member = db.query(TeamMember).filter(TeamMember.email == body.email).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not member.password_set:
        # First login — frontend should redirect to set-password
        return {"first_login": True, "email": body.email}

    if not verify_password(body.password, member.password_hash or ""):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return _build_token_response("member", member.name, member.email, member.id)


@router.post("/set-password")
def set_password(body: SetPasswordBody, db: Session = Depends(get_db)):
    member = (
        db.query(TeamMember)
        .filter(TeamMember.email == body.email, TeamMember.password_set == False)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found or password already set")

    member.password_hash = hash_password(body.new_password)
    member.password_set = True
    db.commit()
    db.refresh(member)

    return _build_token_response("member", member.name, member.email, member.id)


@router.post("/change-password")
def change_password(
    body: ChangePasswordBody,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if user["role"] == "lead":
        lead_hash = _get_lead_password_hash(db)
        if not lead_hash or not verify_password(body.old_password, lead_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong current password")
        _set_config(db, "lead_password_hash", hash_password(body.new_password))
    else:
        member = db.query(TeamMember).filter(TeamMember.id == user["id"]).first()
        if not member or not verify_password(body.old_password, member.password_hash or ""):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong current password")
        member.password_hash = hash_password(body.new_password)
        db.commit()

    return {"ok": True}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    }


@router.put("/lead-email")
def update_lead_email(
    body: LeadEmailBody,
    db: Session = Depends(get_db),
    user: dict = Depends(require_lead),
):
    _set_config(db, "lead_email", body.email)
    return {"ok": True}


@router.post("/lead-set-password")
def lead_set_password(
    body: LeadSetPasswordBody,
    db: Session = Depends(get_db),
    user: dict = Depends(require_lead),
):
    _set_config(db, "lead_password_hash", hash_password(body.new_password))
    return {"ok": True}


@router.post("/lead-init-password")
def lead_init_password(body: LeadSetPasswordBody, db: Session = Depends(get_db)):
    """One-time endpoint to set lead password when not yet configured."""
    existing = _get_lead_password_hash(db)
    if existing:
        raise HTTPException(status_code=403, detail="Lead password already set. Use change-password.")
    _set_config(db, "lead_password_hash", hash_password(body.new_password))
    return {"ok": True}
