# PrimeDesk — Design & Architecture Document

**Application Name:** PrimeDesk
**Team:** Prime Team
**Version:** 1.2 (Phase 1 Complete)
**Last Updated:** 2026-06-01

---

## 1. Architecture Overview

PrimeDesk is a **local web application** — the backend runs on `localhost` and the UI opens in the default browser. Identical on Windows and Ubuntu with no OS-specific UI code.

```
┌──────────────────────────────────────────────────┐
│                  Browser (UI)                    │
│      React 18 + TypeScript + Bootstrap 5         │
│          http://localhost:3000                   │
└──────────────────────┬───────────────────────────┘
                       │ REST API (JSON) via Axios
                       │ Vite proxy → /api → :8000
┌──────────────────────▼───────────────────────────┐
│              Backend (API Server)                │
│          Python 3.10 + FastAPI + Uvicorn         │
│               http://localhost:8000              │
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
          │   hornerautomation      │
          │   .mantishub.io         │
          └─────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Version | Reason |
|---|---|---|---|
| Backend | Python FastAPI | 0.111.0 | Fast, async, cross-platform |
| ASGI Server | Uvicorn | 0.30.1 | Production-ready ASGI |
| ORM | SQLAlchemy | 2.0.30 | Clean DB abstraction |
| Database | SQLite | Built-in | Zero-config, file-based, portable |
| Validation | Pydantic | v2.7.1 | Schema enforcement |
| HTTP Client | httpx | 0.27.0 | Async Mantis REST calls |
| Encryption | cryptography (Fernet) | 42.0.7 | AES-encrypted API token storage |
| File I/O | aiofiles | 23.2.1 | Async file handling |
| Frontend | React + TypeScript | 18 + 5.4 | Component-based, type-safe UI |
| UI Library | Bootstrap 5 + React-Bootstrap | 5.3.3 | Responsive design system |
| Icons | Bootstrap Icons | 1.11.3 | Consistent icon set |
| Font | Nunito (Google Fonts) | — | Clean, modern dashboard font |
| API Client | Axios | 1.7.2 | HTTP requests from frontend |
| Date Handling | dayjs | 1.11.11 | Lightweight date formatting |
| Build Tool | Vite | 4.5.3 | Fast HMR dev server (v4 for Node 16 compatibility) |
| Python Runtime | Python 3.10 | — | Used via venv (system Python may be locked) |

---

## 3. Project Structure

```
TeamMan/
├── requirements.md             ← Requirements document
├── design.md                   ← This design document
├── start.sh                    ← Ubuntu launcher
├── start.bat                   ← Windows launcher (uses backend/.venv)
│
├── backend/
│   ├── main.py                 ← FastAPI app, CORS, router registration, DB init
│   ├── database.py             ← SQLAlchemy engine, SessionLocal, Base
│   ├── models.py               ← All ORM table definitions
│   ├── schemas.py              ← All Pydantic request/response schemas
│   ├── requirements.txt        ← Python dependencies
│   ├── teamman.db              ← SQLite database (auto-created on first run)
│   ├── .fernet.key             ← Auto-generated AES key for token encryption
│   ├── uploads/                ← Stored attachment files (UUID-named)
│   │
│   ├── routers/
│   │   ├── dashboard.py        ← Stats: totals, by-status, workload
│   │   ├── members.py          ← CRUD for team members
│   │   ├── tasks.py            ← CRUD + priority reorder + color compute
│   │   ├── labels.py           ← CRUD for labels
│   │   ├── comments.py         ← Append comments per task
│   │   ├── attachments.py      ← Upload / download / delete files per task
│   │   ├── relations.py        ← Task-to-task relation CRUD
│   │   ├── portal.py           ← Mantis fetch + credential save/test
│   │   ├── config.py           ← App-level config (release date)
│   │   └── todos.py            ← Todo threads + items CRUD
│   │
│   ├── services/
│   │   ├── portal_fetcher.py   ← Async Mantis REST API client
│   │   └── crypto.py           ← Fernet encrypt / decrypt for API token
│   │
│   └── .venv/                  ← Python virtual environment (auto-created by start scripts)
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts           ← Vite proxy: /api → http://localhost:8000
    ├── index.html
    └── src/
        ├── main.tsx             ← React root, Bootstrap CSS imports
        ├── App.tsx              ← Layout: sidebar + topbar + routes + ReleaseBadge
        ├── index.css            ← SB Admin 2 design tokens and component styles
        ├── api/
        │   └── client.ts        ← Axios instance + all typed API call functions
        ├── types/
        │   └── index.ts         ← TypeScript interfaces
        └── pages/
            ├── Dashboard.tsx    ← Stat cards + status breakdown + team workload
            ├── Tasks.tsx        ← Task table + filters + modal + detail offcanvas
            ├── Team.tsx         ← Member cards + add/edit/delete modal
            ├── Todo.tsx         ← Todo threads + action items + meeting reference
            └── Settings.tsx     ← Portal credentials + labels + release date
```

---

## 4. UI Design

### Theme — SB Admin 2

The UI is styled after the **SB Admin 2** Bootstrap admin template by Start Bootstrap.

### Color Palette

| Name | Hex | Used For |
|---|---|---|
| Primary Blue | `#4e73df` | Sidebar gradient top, buttons, active nav, open threads |
| Primary Dark | `#224abe` | Sidebar gradient bottom, button hover |
| Success Green | `#1cc88a` | Completed/released tasks, done threads, low load |
| Info Cyan | `#36b9cc` | Info stat card, SID03/SID05 status |
| Warning Yellow | `#f6c23e` | Due today stat, near-deadline, waiting/on-hold |
| Danger Red | `#e74a3b` | Overdue tasks, rework/reopened, overdue release badge |
| Secondary Gray | `#858796` | Not started, closed, muted text |
| Body BG | `#f8f9fc` | Page background, card headers |
| Card Border | `#e3e6f0` | Card and table borders |
| Text Dark | `#5a5c69` | Primary body text |

### Layout

- **Fixed sidebar** (240px) — dark blue gradient (`#4e73df → #224abe`), scrollable nav
- **Sticky topbar** (76px) — white, search bar (pill shape), release badge, user avatar
- **Page content** — `28px 30px` padding, card-based layout
- **Page header** — title (`h1`) + subtitle + action button slot (portal pattern)
- **Horizontal rule** — separates header from page content
- **Sidebar footer** — user avatar + role (white text)

> **Note:** Notification bell and mail icons in the topbar are hidden (commented out) — reserved for future use.

### Page Header Action Button Pattern

Pages that have a primary action button (Tasks, Team, Todo) use a **React portal** to render the button directly into a `<div id="page-header-actions">` slot inside the `pd-page-header` div in `App.tsx`. This puts the button on the same line as the page title without coupling `App.tsx` to individual pages.

### Stat Cards — SB Admin 2 Style

Stat cards use the SB Admin 2 signature **colored left-border** style:
- `border-left: 0.25rem solid <color>`
- Label in small uppercase text (color matches border)
- Large bold value number
- Icon on the right in a large muted gray

| Card | Border Color | Class | Order |
|---|---|---|---|
| Total Tasks | `#4e73df` | `sba-card-primary` | 1st |
| Overdue | `#e74a3b` | `sba-card-danger` | 2nd |
| Due Today | `#f6c23e` | `sba-card-warning` | 3rd |
| Due This Week | `#36b9cc` | `sba-card-info` | 4th |

### Pages

#### Dashboard
- 4 stat cards (border-left SB Admin 2 style): Total Tasks, Overdue, Due Today, Due This Week
- Status breakdown card: colored dot + SID code + label + count + progress bar + percentage
- Team Workload table: avatar initial, name, role badge, active task count, capacity bar, load badge

#### Tasks
- Filter bar: member, status, type, end-date range, sort field + direction toggle
- Table columns: Priority badge, Color dot, Portal ID, Title (clickable), Type, Assignee, Status badge, Due Date, Labels, Actions
- Row click → opens **Offcanvas** detail panel (right side, 560px)
- **New Task / Edit modal** (700px): type selector, portal fetch, all fields, label toggle chips, relations section
- **Task Detail Offcanvas**: meta grid, label chips, description, comment thread, attach file
- `+ New Task` button portalled into page header

#### Team
- Responsive card grid: circular avatar (role-colored), name, email, role badge, task count
- Add / Edit modal: name, email, hierarchy dropdown
- `+ Add Member` button portalled into page header

#### Todo
- `+ New Thread` button portalled into page header
- Threads grouped: **Open** (blue left-border) on top, **Completed** (green left-border) below
- Thread card header: heading, meeting reference (calendar icon), status badge, action buttons (done, edit, delete)
- Thread card body: description, progress bar (items done / total + %), inline checklist, add-item input
- Mark thread done → moves to completed section; can be reopened
- Empty state shown when no threads exist

#### Settings
- Portal card: Mantis URL + API token (masked) + Save + Test Connection
- Labels card: colored pill per label, click to edit, × to delete, New Label button
- Release Date card: date picker + Save + Clear buttons
- About card: app name + version

---

## 5. Database Schema

### `team_members`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Not null |
| email | TEXT | Unique, not null |
| role | TEXT | Lead / Senior / Junior / Intern |
| created_at | DATETIME | Auto |

### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| portal_task_id | TEXT | Mantis issue ID (nullable) |
| title | TEXT | Not null |
| description | TEXT | Nullable |
| task_type | TEXT | `bug` or `feature` |
| assignee_id | INTEGER FK | → team_members.id, SET NULL on delete |
| priority | INTEGER | Per-member queue position |
| status | TEXT | SID00–SID14 (default: SID00) |
| start_date | DATE | Nullable |
| end_date | DATE | Nullable |
| created_at | DATETIME | Auto |
| updated_at | DATETIME | Auto-update |

> **Note:** `color` is NOT stored — computed at read time by `compute_color()`.

### `task_relations`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| from_task_id | INTEGER FK | → tasks.id (CASCADE DELETE) |
| to_task_id | INTEGER FK | → tasks.id (CASCADE DELETE) |
| relation_type | TEXT | duplicate / parent / child / blocks / blocked_by / related_to |
| created_at | DATETIME | Auto |

### `labels`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | Unique |
| color | TEXT | Hex color string |

### `task_labels` (many-to-many join)
| Column | Type |
|---|---|
| task_id | INTEGER FK → tasks.id (CASCADE DELETE) |
| label_id | INTEGER FK → labels.id (CASCADE DELETE) |

### `comments`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| task_id | INTEGER FK | CASCADE DELETE |
| content | TEXT | Not null |
| author | TEXT | Default: "Project Lead" |
| created_at | DATETIME | Auto |

### `attachments`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| task_id | INTEGER FK | CASCADE DELETE |
| filename | TEXT | Original filename |
| filepath | TEXT | UUID-named file in uploads/ |
| created_at | DATETIME | Auto |

### `portal_credentials`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | One row only |
| portal_url | TEXT | e.g. `https://hornerautomation.mantishub.io` |
| api_token_enc | TEXT | Fernet AES-encrypted API token |

### `app_config`
| Column | Type | Notes |
|---|---|---|
| key | TEXT PK | Config key (e.g. `release_date`) |
| value | TEXT | Config value (nullable) |

### `todo_threads`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| heading | TEXT | Not null |
| description | TEXT | Nullable |
| meeting | TEXT | Free-text meeting/event reference (nullable) |
| status | TEXT | `open` or `done` |
| created_at | DATETIME | Auto |
| updated_at | DATETIME | Auto-update |

### `todo_items`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| thread_id | INTEGER FK | → todo_threads.id (CASCADE DELETE) |
| text | TEXT | Not null |
| done | BOOLEAN | Default false |
| position | INTEGER | Order within thread |
| created_at | DATETIME | Auto |

---

## 6. Priority Reorder Algorithm

```python
# On assign / create with priority N for member M:
UPDATE tasks
  SET priority = priority + 1
  WHERE assignee_id = M
    AND priority >= N
    AND id != task_id        # skip self when reassigning

UPDATE tasks SET priority = N WHERE id = task_id

# On delete of task with priority P for member M:
UPDATE tasks
  SET priority = priority - 1
  WHERE assignee_id = M
    AND priority > P
    AND id != task_id
```

Priority is **per-member** — two different members can both have a task at priority 1.

---

## 7. Color Computation (Server-side, on every read)

```python
_TERMINAL = {"SID12", "SID13"}   # Closed, Released
_PROBLEM  = {"SID07", "SID11"}   # Rework, Reopened
_WAITING  = {"SID10", "SID14"}   # Waiting, On Hold
_READY    = {"SID08", "SID09"}   # Ready to Merge, Ready to Release

def compute_color(task) -> str:
    today = date.today()
    if task.status in _TERMINAL: return "green"   # #1cc88a
    if task.status in _PROBLEM:  return "red"     # #e74a3b
    if task.status in _WAITING:  return "orange"  # #f6c23e
    if task.end_date:
        if task.end_date < today:                  return "red"
        if task.end_date <= today + timedelta(days=2): return "orange"
    if task.status in _READY:    return "green"
    return "blue"                                  # #4e73df
```

---

## 8. Mantis REST API Integration

```
Endpoint: GET {portal_url}/api/rest/issues/{issue_id}
Headers:  Authorization: <api_token>

Fields extracted from response:
  data.summary          → task title
  data.description      → task description
  data.reporter.name    → reporter name
  data.severity.label   → severity label
  data.status.label     → current portal status
```

- Token saved once via Settings → encrypted with Fernet → stored in `portal_credentials`
- On fetch: decrypted in memory, used for HTTP call, never logged
- Test Connection hits `GET /api/rest/` to verify token validity

---

## 9. API Endpoints

### Dashboard
| Method | Path | Action |
|---|---|---|
| GET | /dashboard | Stats: totals, by-status, workload, due dates |

### Members
| Method | Path | Action |
|---|---|---|
| GET | /members | List all (with task count) |
| POST | /members | Create member |
| PUT | /members/{id} | Update member |
| DELETE | /members/{id} | Delete (tasks become unassigned) |

### Tasks
| Method | Path | Action |
|---|---|---|
| GET | /tasks | List with filter/sort query params |
| POST | /tasks | Create task (triggers priority reorder) |
| GET | /tasks/{id} | Full detail (comments + attachments) |
| PUT | /tasks/{id} | Update task |
| DELETE | /tasks/{id} | Delete (compacts priority queue) |
| POST | /tasks/{id}/assign | Assign member + priority |
| POST | /tasks/{id}/labels/{label_id} | Add label |
| DELETE | /tasks/{id}/labels/{label_id} | Remove label |

### Relations
| Method | Path | Action |
|---|---|---|
| GET | /tasks/{id}/relations | List all relations for a task |
| POST | /tasks/{id}/relations | Add a relation (type + target task id) |
| DELETE | /tasks/{id}/relations/{rel_id} | Remove a relation |

### Labels
| Method | Path | Action |
|---|---|---|
| GET | /labels | List all |
| POST | /labels | Create |
| PUT | /labels/{id} | Update |
| DELETE | /labels/{id} | Delete |

### Comments
| Method | Path | Action |
|---|---|---|
| GET | /tasks/{id}/comments | List (chronological) |
| POST | /tasks/{id}/comments | Add comment |

### Attachments
| Method | Path | Action |
|---|---|---|
| GET | /tasks/{id}/attachments | List |
| POST | /tasks/{id}/attachments | Upload (multipart) |
| GET | /attachments/{id}/download | Download (FileResponse) |
| DELETE | /attachments/{id} | Delete (disk + DB) |

### Portal
| Method | Path | Action |
|---|---|---|
| GET | /portal/credentials | Check if configured |
| POST | /portal/credentials | Save URL + token |
| GET | /portal/fetch/{issue_id} | Fetch from Mantis |
| GET | /portal/test | Test connection |

### Config
| Method | Path | Action |
|---|---|---|
| GET | /config/release-date | Get current release date |
| POST | /config/release-date | Set / clear release date |

### Todos
| Method | Path | Action |
|---|---|---|
| GET | /todos | List all threads (newest first) |
| POST | /todos | Create thread |
| PUT | /todos/{id} | Update thread (heading, description, meeting, status) |
| DELETE | /todos/{id} | Delete thread + all items |
| POST | /todos/{id}/items | Add item to thread |
| PUT | /todo-items/{id} | Update item (text, done) |
| DELETE | /todo-items/{id} | Delete item |

---

## 10. Task Relations Design

Relations are stored as directed pairs in `task_relations`. The API returns relations from both directions for a given task (where `from_task_id = id` OR `to_task_id = id`), always presenting the "other" task as `related_task_id`.

**Validation rules:**
- `relation_type` must be one of: `duplicate`, `parent`, `child`, `blocks`, `blocked_by`, `related_to`
- A task cannot be related to itself
- Duplicate relations (same pair + same type, either direction) are rejected with HTTP 409

**UI — Edit Task modal:**
- Relations section shows existing relations as color-coded pills
- Each pill shows: relation type label + related task title (+ portal ID if set)
- × button removes the relation instantly (no confirmation needed)
- Add-relation row: type dropdown + task dropdown + Add button
- New tasks: relations section shows "save first" message; relations are added after task exists

**Relation type colors:**
| Type | Color |
|---|---|
| duplicate | Gray `#858796` |
| parent | Blue `#4e73df` |
| child | Cyan `#36b9cc` |
| blocks | Red `#e74a3b` |
| blocked_by | Yellow `#f6c23e` |
| related_to | Green `#1cc88a` |

---

## 11. Launch Scripts

### `start.sh` (Ubuntu)
```bash
# Creates Python 3.10 venv if not present
# Installs backend deps inside venv
# Starts uvicorn (backend) in background
# Installs frontend npm deps
# Starts vite dev server in background
# Opens http://localhost:3000 in browser after 4s
```

### `start.bat` (Windows)
```bat
:: Creates Python venv at backend\.venv if not present
:: Installs backend deps inside venv (bypasses system pip issues)
:: Opens backend in a new CMD window (kept open on error)
:: Installs frontend npm deps
:: Opens frontend in a new CMD window (kept open on error)
:: Opens http://localhost:3000 after 10s (allows both servers to start)
```

**Ports used:**
- Backend API: `http://localhost:8000`
- Frontend UI: `http://localhost:3000`
- Vite proxy: `/api/*` → `http://localhost:8000/*`

---

## 12. Known Constraints & Decisions

| Decision | Reason |
|---|---|
| Python venv (not system Python) | System Python may have broken pip or be PEP 668 locked (Ubuntu 3.14) |
| Vite pinned to v4.5.3 | Windows machine runs Node 16; Vite 5 requires Node 18+ |
| Color computed at read time, not stored | Stays accurate as dates change without scheduled jobs |
| SQLite (not PostgreSQL) | Single-user local app, zero-config requirement |
| No login screen in v1 | Explicitly deferred to v2 per project lead decision |
| SB Admin 2 theme | Project lead selected this theme for its clean blue gradient sidebar and border-left stat cards |
| Nunito font | Modern dashboard aesthetic matching SB Admin 2 reference |
| Notification / mail icons hidden | Commented out in App.tsx topbar — reserved for future use |
| Dashboard stat card order: Total → Overdue → Due Today → Due This Week | Most urgent items (overdue) surfaced before informational (due today/week) |
| Task status default: SID00 | Replaced old `not_started` string; existing rows migrated via one-time script |
| Todo item routes at `/todo-items/` (not `/todos/items/`) | Avoids FastAPI route conflict with `/todos/{thread_id}` integer path parameter |
| Page header action buttons via React portal | Decouples page-specific buttons from the shared App.tsx layout without prop drilling |
| Release date in `app_config` key-value table | Flexible config store without schema migration per new setting |
| Relations stored as directed pairs | Simple to query; both directions fetched and merged at API layer |
