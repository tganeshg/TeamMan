from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

from database import engine, Base
import models  # ensure all models are registered

from routers import members, tasks, labels, comments, attachments, portal, dashboard, config, todos, relations, releases, reports, auth
from auth_utils import decode_token

Base.metadata.create_all(bind=engine)


def _ensure_schema():
    """Lightweight, idempotent migrations for columns added after a table
    already exists (create_all only creates missing tables, not columns)."""
    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns("todo_threads")}
    if "position" not in cols:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE todo_threads ADD COLUMN position INTEGER NOT NULL DEFAULT 0"
            ))
            # Seed positions from the previous display order (newest first).
            rows = conn.execute(text(
                "SELECT id FROM todo_threads ORDER BY created_at DESC"
            )).fetchall()
            for pos, (thread_id,) in enumerate(rows):
                conn.execute(
                    text("UPDATE todo_threads SET position = :p WHERE id = :id"),
                    {"p": pos, "id": thread_id},
                )

    todo_cols = {c["name"] for c in insp.get_columns("todo_threads")}
    if "member_id" not in todo_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE todo_threads ADD COLUMN member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE"))

    portal_cols = {c["name"] for c in insp.get_columns("portal_credentials")}
    if "member_id" not in portal_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE portal_credentials ADD COLUMN member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE"))

    task_cols = {c["name"] for c in insp.get_columns("tasks")}
    if "progress" not in task_cols:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0"
            ))

    member_cols = {c["name"] for c in insp.get_columns("team_members")}
    if "password_hash" not in member_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE team_members ADD COLUMN password_hash TEXT"))
            conn.execute(text("ALTER TABLE team_members ADD COLUMN password_set INTEGER NOT NULL DEFAULT 0"))

    # ── Seed lead member ──────────────────────────────────────────────────
    # Ensure a TeamMember row for lead@teamman.local always exists.
    # This is safe to run on any existing database — it only adds the lead
    # member if not present, never deletes or modifies existing data.
    from auth_utils import LEAD_EMAIL
    with engine.begin() as conn:
        seeded = conn.execute(text("SELECT value FROM app_config WHERE key='lead_seeded_v1'")).fetchone()
        if not seeded:
            existing = conn.execute(text(f"SELECT id FROM team_members WHERE email='{LEAD_EMAIL}'")).fetchone()
            if not existing:
                conn.execute(text(
                    f"INSERT INTO team_members (name, email, role, password_set, created_at) VALUES ('Project Lead', '{LEAD_EMAIL}', 'Lead', 1, datetime('now'))"
                ))
            else:
                # Fix NULL created_at if present from old seed
                conn.execute(text(f"UPDATE team_members SET created_at = datetime('now') WHERE email='{LEAD_EMAIL}' AND created_at IS NULL"))
            conn.execute(text("INSERT OR REPLACE INTO app_config (key, value) VALUES ('lead_seeded_v1', '1')"))


_ensure_schema()

app = FastAPI(title="TeamMan API", version="1.0.0")

# CORS must be added before the auth middleware so preflight OPTIONS pass through
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_AUTH_SKIP_PREFIXES = ("/auth/", "/health", "/docs", "/openapi.json", "/redoc")


@app.middleware("http")
async def jwt_middleware(request: Request, call_next):
    """Enforce JWT on all routes except the public ones listed above."""
    path = request.url.path
    if any(path.startswith(prefix) for prefix in _AUTH_SKIP_PREFIXES):
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):]
        payload = decode_token(token)
        if payload is not None:
            request.state.user = {
                "id": payload.get("id"),
                "email": payload.get("email"),
                "name": payload.get("name"),
                "role": payload.get("role"),
            }
            return await call_next(request)

    return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(members.router)
app.include_router(tasks.router)
app.include_router(labels.router)
app.include_router(comments.router)
app.include_router(attachments.router)
app.include_router(portal.router)
app.include_router(config.router)
app.include_router(todos.router)
app.include_router(relations.router)
app.include_router(releases.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "ok"}
