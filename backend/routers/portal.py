from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import PortalCredential, TeamMember
from schemas import PortalCredentialIn, PortalCredentialStatus, MantisIssue
from services.crypto import encrypt, decrypt
from services.portal_fetcher import fetch_mantis_issue
from auth_utils import get_current_user

router = APIRouter(prefix="/portal", tags=["portal"])


def _resolve_member_id(user: dict, db: Session) -> int | None:
    """Resolve the real DB member id by email, handling stale JWT tokens."""
    member = db.query(TeamMember).filter(TeamMember.email == user["email"]).first()
    if member:
        if member.email == "lead@teamman.local":
            real_lead = (
                db.query(TeamMember)
                .filter(TeamMember.role == "Lead", TeamMember.email != "lead@teamman.local")
                .order_by(TeamMember.id.asc())
                .first()
            )
            return real_lead.id if real_lead else member.id
        return member.id
    return user["id"]


def _get_cred(db: Session, member_id: int) -> PortalCredential | None:
    """Return this member's credential, or fall back to any configured credential (for portal URL)."""
    cred = db.query(PortalCredential).filter(PortalCredential.member_id == member_id).first()
    if not cred:
        cred = db.query(PortalCredential).first()
    return cred


@router.get("/credentials", response_model=PortalCredentialStatus)
def get_credential_status(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cred = _get_cred(db, _resolve_member_id(user, db))
    if not cred:
        return PortalCredentialStatus(configured=False)
    return PortalCredentialStatus(configured=True, portal_url=cred.portal_url)


@router.post("/credentials", response_model=PortalCredentialStatus)
def save_credentials(payload: PortalCredentialIn, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    member_id = _resolve_member_id(user, db)
    cred = _get_cred(db, member_id)
    enc_token = encrypt(payload.api_token)
    if cred:
        cred.portal_url = payload.portal_url
        cred.api_token_enc = enc_token
    else:
        cred = PortalCredential(member_id=member_id, portal_url=payload.portal_url, api_token_enc=enc_token)
        db.add(cred)
    db.commit()
    return PortalCredentialStatus(configured=True, portal_url=payload.portal_url)


@router.get("/fetch/{issue_id}", response_model=MantisIssue)
async def fetch_issue(issue_id: str, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cred = _get_cred(db, _resolve_member_id(user, db))
    if not cred:
        raise HTTPException(status_code=400, detail="Portal credentials not configured. Go to Settings first.")
    try:
        token = decrypt(cred.api_token_enc)
        issue = await fetch_mantis_issue(cred.portal_url, token, issue_id)
        return issue
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/test", response_model=dict)
async def test_connection(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cred = _get_cred(db, _resolve_member_id(user, db))
    if not cred:
        raise HTTPException(status_code=400, detail="Portal credentials not configured.")
    try:
        token = decrypt(cred.api_token_enc)
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{cred.portal_url.rstrip('/')}/api/rest/",
                headers={"Authorization": token},
            )
        if r.status_code in (200, 401):
            return {"ok": r.status_code == 200, "status": r.status_code}
        return {"ok": False, "status": r.status_code}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
