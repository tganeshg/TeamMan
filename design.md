# PrimeDesk — Design & Architecture Document

**Application Name:** PrimeDesk
**Team:** Prime Team
**Version:** 1.3 (Phase 1 Complete)
**Last Updated:** 2026-06-02

---

## 1. Architecture Overview

PrimeDesk is a **local web application** — the backend runs on `localhost` and the UI opens in the default browser.

```
┌──────────────────────────────────────────────────┐
│                  Browser (UI)                    │
│      React 18 + TypeScript + Bootstrap 5         │
│          http://localhost:3000                   │
└──────────────────────┬───────────────────────────┘
                       │ REST API (JSON) via Axios
                       │ Vite proxy → /api → :3001
┌──────────────────────▼───────────────────────────┐
│              Backend (API Server)                │
│          Python 3.10 + FastAPI + Uvicorn         │
│               http://localhost:3001              │
└──────────────────────┬───────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
┌─────────▼──────┐       ┌──────────▼────────┐
│  SQLite DB     │       │  uploads/ folder  │
│  teamman.db    │       │  (attachments)    │
└────────────────┘       └───────────────────┘
                       │
          ┌────────────▼────────────┐
          │   Mantis REST API       │
          │   (external, on-demand) │
          └─────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend | Python FastAPI | 0.111.0 |
| ASGI Server | Uvicorn | 0.30.1 |
| ORM | SQLAlchemy | 2.0.30 |
| Database | SQLite | Built-in |
| Validation | Pydantic | v2.7.1 |
| HTTP Client | httpx | 0.27.0 |
| Encryption | cryptography (Fernet) | 42.0.7 |
| File I/O | aiofiles | 23.2.1 |
| PDF Export | reportlab | 4.2.2 |
| Word Export | python-docx | 1.1.2 |
| Frontend | React + TypeScript | 18 + 5.4 |
| UI Library | Bootstrap 5 + React-Bootstrap | 5.3.3 |
| Icons | Bootstrap Icons | 1.11.3 |
| Font | Nunito (Google Fonts) | — |
| API Client | Axios | 1.7.2 |
| Date Handling | dayjs | 1.11.11 |
| Build Tool | Vite | 4.5.3 (pinned for Node 16) |
| Python Runtime | Python 3.10 venv | — |

---

## 3. Project Structure

```
TeamMan/
├── requirements.md
├── design.md
├── start.sh                    ← Ubuntu launcher
├── start.bat                   ← Windows launcher (uses backend/.venv)
├── restart_backend.bat         ← Windows: kill port 3001, restart backend
│
├── backend/
│   ├── main.py                 ← FastAPI app, CORS, router registration, DB init
│   ├── database.py             ← SQLAlchemy engine, SessionLocal, Base
│   ├── models.py               ← All ORM table definitions
│   ├── schemas.py              ← All Pydantic request/response schemas
│   ├── requirements.txt        ← Python dependencies
│   ├── teamman.db              ← SQLite database (auto-created)
│   ├── .fernet.key             ← Auto-generated AES key for token encryption
│   ├── uploads/                ← Stored attachment files (UUID-named)
│   │
│   ├── routers/
│   │   ├── dashboard.py        ← Stats: totals, by-status, workload
│   │   ├── members.py          ← CRUD for team members
│   │   ├── tasks.py            ← CRUD + priority management + color compute
│   │   ├── labels.py           ← CRUD for labels
│   │   ├── comments.py         ← Append comments per task
│   │   ├── attachments.py      ← Upload / download / delete files per task
│   │   ├── relations.py        ← Task-to-task relation CRUD
│   │   ├── releases.py         ← Release CRUD
│   │   ├── reports.py          ← Report stats + PDF export + Word export
│   │   ├── portal.py           ← Mantis fetch + credential save/test
│   │   ├── config.py           ← App-level config (legacy release date)
│   │   └── todos.py            ← Todo threads + items CRUD
│   │
│   └── services/
│       ├── portal_fetcher.py   ← Async Mantis REST API client
│       └── crypto.py           ← Fernet encrypt / decrypt for API token
│
└── frontend/
    ├── vite.config.ts           ← Vite proxy: /api → http://localhost:3001
    └── src/
        ├── App.tsx              ← Layout: sidebar + topbar + routes + ReleaseBadge
        ├── index.css            ← SB Admin 2 design tokens and component styles
        ├── api/client.ts        ← Axios instance + all typed API call functions
        ├── types/index.ts       ← TypeScript interfaces
        └── pages/
            ├── Dashboard.tsx
            ├── Tasks.tsx
            ├── Team.tsx
            ├── Todo.tsx
            ├── Reports.tsx
            └── Settings.tsx
```

---

## 4. UI Design

### Theme — SB Admin 2

| Name | Hex | Used For |
|---|---|---|
| Primary Blue | `#4e73df` | Sidebar, buttons, active nav |
| Success Green | `#1cc88a` | Closed tasks, early/on-time timing |
| Info Cyan | `#36b9cc` | Info stat card |
| Warning Yellow | `#f6c23e` | Near-deadline, waiting/on-hold |
| Danger Red | `#e74a3b` | Overdue, rework/reopened |
| Secondary Gray | `#858796` | Not started, closed, muted |
| Body BG | `#f8f9fc` | Page background |

### Layout

- **Fixed sidebar** (240px) — dark blue gradient, scrollable nav
- **Sticky topbar** — white, release badge, user avatar
  - Notification bell and mail icons hidden (reserved for future)
- **Page content** — card-based layout

### Stat Card Order (Dashboard)

1. Total Tasks (blue)
2. Overdue (red)
3. Due Today (yellow)
4. Due This Week (cyan)

### Pages

#### Tasks
- Filter bar + sortable table
- Edit modal: all fields including Release dropdown and Relations section
- Detail offcanvas: meta, labels, description, comments, attachments

#### Reports
- Left panel: release list with edit (✏) button per release
- Right panel: summary cards + per-member table + task detail table (filterable by member)
- Header buttons: PDF download, Word download, Mark Complete / Reopen, Delete

#### Settings
- Portal credentials (Mantis URL + API token)
- Labels management
- Releases pointer (managed in Reports page)

---

## 5. Database Schema

### `releases`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | e.g. "17.60", "SC Beta" |
| release_date | DATE | Target ship date |
| status | TEXT | `active` or `completed` |
| created_at | DATETIME | Auto |

### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| portal_task_id | TEXT | Nullable |
| title | TEXT | Not null |
| description | TEXT | Nullable |
| task_type | TEXT | `bug` or `feature` |
| assignee_id | INTEGER FK | → team_members.id, SET NULL on delete |
| priority | INTEGER | Per-member sequential position (required if assigned) |
| status | TEXT | SID00–SID14 (default: SID00) |
| start_date | DATE | Nullable |
| end_date | DATE | Nullable |
| release_id | INTEGER FK | → releases.id, SET NULL on delete |
| closed_at | DATE | Auto-set when status → SID12/SID13; cleared on reopen |
| created_at | DATETIME | Auto |
| updated_at | DATETIME | Auto-update |

### `task_relations`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| from_task_id | INTEGER FK | → tasks.id (CASCADE DELETE) |
| to_task_id | INTEGER FK | → tasks.id (CASCADE DELETE) |
| relation_type | TEXT | duplicate / parent / child / blocks / blocked_by / related_to |
| created_at | DATETIME | Auto |

### `team_members`, `labels`, `task_labels`, `comments`, `attachments`, `portal_credentials`, `app_config`, `todo_threads`, `todo_items`
— unchanged from v1.2 (see previous version for full schema)

---

## 6. Priority Algorithm — `_apply_priority`

All priority operations go through a single function that guarantees a clean 1..N sequence:

```python
def _apply_priority(db, assignee_id, task_id, new_priority):
    # 1. Load ALL tasks for the member (including the task being moved)
    all_tasks = query ordered by current priority

    # 2. Separate target from others
    target = task with task_id
    others = all other tasks

    # 3. Clamp: new_priority = max(1, min(new_priority, len(others)+1))

    # 4. Build final ordered list:
    ordered = others[:]
    ordered.insert(clamped - 1, target)   # 0-indexed

    # 5. Assign sequential priorities 1..N to every task
    for i, t in enumerate(ordered):
        t.priority = i + 1

    db.flush()
```

This approach:
- Loads all tasks once, reorders in Python, writes back cleanly
- Handles insert, move-up, move-down, and out-of-range values
- No SQLAlchemy session sync issues (all objects managed in same session)

---

## 7. Report Timing Classification

```python
EARLY_DAYS = 2  # closed more than 2 days before end_date = "early"

def _task_timing(task):
    if closed and closed_at:
        diff = (end_date - closed_at).days
        if diff > 2:   return "early"
        if diff >= 0:  return "on_time"
        else:          return "overdue"
    elif closed:       return "on_time"   # no closed_at recorded
    else:
        if end_date < today: return "overdue_open"
        return "in_progress"
```

---

## 8. Report Exports

Both exports generate the same document structure:
1. **Title**: "Prime Team Report"
2. **Release info line**: name, target date, generated date
3. **Summary table**: 7 columns (Total, Closed, Early, On Time, Late Closed, Open/OD, In Progress)
4. **Per-member breakdown table**: 9 columns
5. **Task detail table**: 8 columns with timing badge
6. **Footer**: "Report generated by PrimeDesk | Prime Team | date"

| Format | Library | Endpoint |
|---|---|---|
| PDF | reportlab 4.2.2 | `GET /reports/{id}/export/pdf` |
| Word | python-docx 1.1.2 | `GET /reports/{id}/export/docx` |

---

## 9. API Endpoints

### Releases
| Method | Path | Action |
|---|---|---|
| GET | /releases | List all |
| POST | /releases | Create |
| PUT | /releases/{id} | Update (name, date, status) |
| DELETE | /releases/{id} | Delete |

### Reports
| Method | Path | Action |
|---|---|---|
| GET | /reports/{id} | Get report data (JSON) |
| GET | /reports/{id}/export/pdf | Download PDF |
| GET | /reports/{id}/export/docx | Download Word |

### Tasks (priority-relevant)
| Method | Path | Action |
|---|---|---|
| POST | /tasks | Create — calls `_apply_priority` if assignee+priority given |
| PUT | /tasks/{id} | Update — calls `_apply_priority` if priority changed |
| DELETE | /tasks/{id} | Delete — compacts queue above deleted slot |

---

## 10. Launch Scripts

### `start.bat` (Windows)
- Creates `backend/.venv` if not present
- Installs deps via venv pip (bypasses broken system pip)
- Starts backend on port **3001** in a new CMD window
- Starts frontend on port **3000** in a new CMD window
- Opens browser after 10s

### `restart_backend.bat` (Windows)
- Kills whatever process is on port 3001
- Starts a fresh backend window on port 3001
- Use after any backend code changes

---

## 11. Known Constraints & Decisions

| Decision | Reason |
|---|---|
| Backend port changed from 8000 → 3001 | Port 8000 was persistently occupied on Windows dev machine |
| Python venv (not system Python) | System Python may have broken pip or be PEP 668 locked |
| Vite pinned to v4.5.3 | Windows machine runs Node 16; Vite 5 requires Node 18+ |
| `_apply_priority` loads all tasks and reorders in Python | Previous bulk SQL UPDATE approach had SQLAlchemy session sync issues |
| Priority is required when assignee is set | Prevents NULL priority tasks which broke queue ordering |
| `closed_at` auto-set by backend on SID12/SID13 | Needed for accurate on-time/early/late report classification |
| Color computed at read time, not stored | Stays accurate as dates change without scheduled jobs |
| SQLite (not PostgreSQL) | Single-user local app, zero-config requirement |
| Notification / mail icons hidden in topbar | Reserved for future use |
| Dashboard stat order: Total → Overdue → Due Today → Due This Week | Most urgent items surfaced first |
| Report titled "Prime Team Report" | Project lead preference |
| PDF generated server-side via reportlab | Browser print captured entire UI; server PDF matches Word layout |
| Relations stored as directed pairs | Simple to query; both directions fetched and merged at API layer |
| No login screen in v1 | Deferred to v2 |
