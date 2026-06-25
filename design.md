# PrimeDesk — Design & Architecture Document

**Application Name:** PrimeDesk
**Team:** Prime Team
**Version:** 1.10 (Phase 1 Complete)
**Last Updated:** 2026-06-25

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

### Theme — ArchitectUI (over Bootstrap 5)

The base UI was migrated from SB Admin 2 to the **ArchitectUI Dashboard** look (dashboardpack.com). The legacy `pd-*` component tokens in `index.css` are retained for cards/tables/sidebar; ArchitectUI styling is layered on top (notably the `arch-stat-card` dashboard cards). Status/label/timing semantic colors are unchanged from SB Admin 2.

**Semantic palette (status, labels, timing):**

| Name | Hex | Used For |
|---|---|---|
| Primary Blue | `#4e73df` | Sidebar, buttons, active nav |
| Success Green | `#1cc88a` | Closed tasks, early/on-time timing |
| Info Cyan | `#36b9cc` | Info / POC / dev-testing status |
| Warning Yellow | `#f6c23e` | Near-deadline, waiting/on-hold |
| Danger Red | `#e74a3b` | Overdue, rework/reopened |
| Secondary Gray | `#858796` | Not started, closed, muted |
| Body BG | `#f8f9fc` | Page background (light mode) |

### Dark Mode

- Topbar toggle (sun/moon icon) flips `document.body[data-theme]` between `light` and `dark`
- Preference persisted in `localStorage` under key `pd-theme`; restored on load
- All colors driven by CSS variables (`--text-dark`, `--text-muted`, `--card-border`, `--card-shadow`, `--bs-body-bg`, etc.) so both themes share one component layer

### Layout

- **Fixed sidebar** (240px) — dark blue gradient, scrollable nav; Main + Account sections
- **Sticky topbar** — live search (left), active-release badges + dark-mode toggle + user pill (right)
- **Page content** — card-based layout; page header exposes a `#page-header-actions` portal target (e.g. Tasks injects its "New Task" button there)

### Stat Cards (Dashboard) — ArchitectUI style, clickable

Rendered as `arch-stat-card arch-stat-card--clickable`. Each card shows a "View tasks →" link and, on click, navigates to `/tasks` carrying a router-state **preset filter** + label.

| # | Card | Card BG | Click filter |
|---|---|---|---|
| 1 | Total Tasks | `#033C73` | All tasks |
| 2 | Closed | `#73A839` | `status = SID12` |
| 3 | Overdue | `#C71C22` | `end_date_to = yesterday` |
| 4 | Due Today | `#DD5600` | `end_date_from = end_date_to = today` |
| 5 | Due This Week | `#2FA4E7` | `end_date_from = today`, `end_date_to = +7d` |

In addition to the cards, the two panels below them are click-through to the same preset-filtered task list:
- **Tasks by Status** — clicking a status count navigates with `preset = { status: <SIDxx> }` (matches the displayed count exactly).
- **Team Workload** — clicking a member's active-tasks count navigates with `preset = { assignee_id: <id>, active: true }`. The `active` filter (status not in SID12/SID13) makes the list match the displayed active count even when the member has closed tasks.

### Pages

#### Tasks
- Columns: P# · ID · Title · Type · Assignee · Status · Due Date · Labels · **Release** · actions. The Release column shows the task's release name (or — if none).
- Filter bar + sortable table; **include** filters: Member, Status, Type, Label, **Release**, Due-date, plus sort field/direction (`release_id` filter is backed by the task-list endpoint). Filters are fully controlled — a dashboard preset or a cleared filter resets them to the `priority / asc` default.
- **Exclude (NOT) filters**: a builder row (field + value + Add) lets the user exclude values for Status, Assignee, Type, Labels, Release, and Priority. Active excludes show as removable `≠ Field: Value` chips. Multiple values per field are supported, and exclude works together with include filters (AND). Sent to the API as comma-separated arrays (`exclude_status`, `exclude_assignee_id`, `exclude_task_type`, `exclude_label_ids`, `exclude_release_id`, `exclude_priority`); the backend applies them as SQL `NOT IN` / `NOT EXISTS`, keeping NULL assignee/release/priority rows visible.
- **Preset filter banner**: when arriving from a dashboard stat card, a blue banner shows `Showing: <label>` with a **Clear filter** button that resets filters and dismisses the banner.
- **Inline editing in the list view** — click a cell to edit in place:
  - **Priority** (only when assigned), **Due Date**, **Labels** (checkbox popover), **Title** (feature tasks only): edit in a popover; **Enter** saves, **Escape** cancels, clicking outside auto-saves.
  - **Assignee**, **Status**: dropdown that saves immediately on change.
  - All inline saves go through `quickUpdate()`, which re-sends the full task payload with the single changed field patched, then reloads.
- **ID column**: portal task IDs render as a link to `{portalUrl}/view.php?id={id}` (opens in new tab) when portal credentials are configured.
- Edit modal: all fields including Release dropdown, **Checklist** section, and Relations section
- Detail offcanvas: meta, labels, description, **checklist**, comments, attachments; Portal ID also links out to Mantis
- **Checklist** (per task): add / edit (type in place) / delete / toggle done / **drag-and-drop reorder** (grip handle, native HTML5). Edited in the task modal and **persisted when the task is saved**; the detail offcanvas shows the checklist in order with toggleable checkboxes (saved immediately). The task list shows a `done/total` progress badge for tasks that have a checklist. Completion status is preserved across edit/reorder.

#### Reports
- Left panel: release list with edit (✏) button per release
- Right panel: summary cards + per-member table + task detail table (filterable by member)
- Header buttons: PDF download, Word download, Mark Complete / Reopen, Delete

#### Topbar
- Live search bar: debounced (300ms), searches by task title or portal bug ID (`ilike`), shows up to 8 results in dropdown, clicking a result navigates to Tasks page and opens that task's detail panel
- Release badges: all active releases rendered as countdown badges (overdue = red, ≤7 days = yellow, healthy = green)

#### Todo
- Threads are stacked **vertically, full-width** (one per row) in each of the Open and Completed sections.
- **Collapsible threads**: each thread is collapsed by default, showing only the heading (chevron ▶). Clicking the heading expands it (▼) to reveal description, progress, and checklist items; clicking again collapses. Expand state is per-thread and independent.
- Checklist items support inline editing: click pencil icon → input field with current text; save on Enter/blur/✓, cancel on Escape/✗
- **Drag-and-drop reordering** (native HTML5 DnD, no extra deps):
  - Drag a thread card (grip handle ⋮⋮ in the header) onto another to reorder the thread list.
  - Drag a checklist item (grip handle) within a thread to reorder its items.
  - Reorders are optimistic and auto-saved on drop (`PUT /todos/reorder`, `PUT /todo-items/reorder`); they revert on error. Order persists across refresh/restart via a `position` column. Checked/unchecked state is untouched by reordering.
  - Visual feedback: the dragged element dims to 40%; the drop target is highlighted (card outline / item top-border). Thread and item DnD are guarded by separate state so they never interfere.

#### Settings
- Portal credentials (Mantis URL + API token)
- Labels management
- Releases section removed (managed in Reports page)

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

### `task_checklist_items`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| task_id | INTEGER FK | → tasks.id (CASCADE DELETE) |
| text | TEXT | Not null |
| done | BOOLEAN | Default false |
| position | INTEGER | Drag-and-drop order within the task |
| created_at | DATETIME | Auto |

— created automatically by `create_all` (new table, so no migration needed).

### `team_members`, `labels`, `task_labels`, `comments`, `attachments`, `portal_credentials`, `app_config`, `todo_threads`, `todo_items`
— largely unchanged from v1.2 (see previous version for full schema).

`todo_threads` and `todo_items` each carry an integer `position` column for manual drag-and-drop ordering (threads sorted by `position` asc; items by `position` within a thread). The `position` column on `todo_threads` is added at startup by an idempotent migration (`_ensure_schema` in `main.py`), since `create_all` does not alter existing tables.

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
| Priority is optional on create; blank assigned tasks append to end of queue | Avoids forcing a position the user hasn't decided; never pushes a new task to the top by leaving priority NULL |
| `closed_at` auto-set by backend on SID12/SID13 | Needed for accurate on-time/early/late report classification |
| Color computed at read time, not stored | Stays accurate as dates change without scheduled jobs |
| SQLite (not PostgreSQL) | Single-user local app, zero-config requirement |
| Notification / mail icons hidden in topbar | Reserved for future use |
| Dashboard stat order: Total → Closed → Overdue → Due Today → Due This Week | Closed surfaced for quick progress visibility alongside urgency |
| Report titled "Prime Team Report" | Project lead preference |
| PDF generated server-side via reportlab | Browser print captured entire UI; server PDF matches Word layout |
| Relations stored as directed pairs | Simple to query; both directions fetched and merged at API layer |
| No login screen in v1 | Deferred to v2 |
| Dashboard uses `Task.status.notin_(["SID12","SID13"])` | Old `!= "completed"` string never matched SID codes; caused empty Tasks by Status and Team Workload sections |
| Topbar search uses backend `ilike` with 300ms debounce | Avoids per-keystroke API calls; search covers both `title` and `portal_task_id` columns |
| Migrated theme SB Admin 2 → ArchitectUI | Richer dashboard card look; semantic status colors kept for continuity |
| Dark mode via `data-theme` + CSS variables (persisted in `localStorage`) | One component layer serves both themes; no per-component conditionals |
| Dashboard stat cards clickable, pass router-state preset filter to Tasks | Lets the user drill from a metric straight into the matching task list |
| Inline list editing re-sends full task payload via `quickUpdate` | Reuses the existing `PUT /tasks/{id}` contract; no new partial-update endpoint needed |
| Inline title editing limited to feature tasks | Bug titles come from Mantis and should stay authoritative |
| Tasks filter bar made fully controlled | Preset filters from the dashboard and "Clear filter" need to reset reliably |
| Todo threads collapsed by default | Keeps the board scannable; matches the "show heading only, expand on click" requirement |
| Native HTML5 drag-and-drop for Todo reordering (no library) | Avoids adding a DnD dependency incompatible with the pinned Node 16 / Vite 4 toolchain |
| Todo order persisted via `position` column + reorder endpoints | Order must survive refresh/restart; reorder endpoints declared before `/{id}` routes so "reorder" is not captured as an id |
| Todo schema change applied via idempotent startup migration | No Alembic in the project; `create_all` cannot add a column to an existing table |
| Todo threads stacked full-width (one per row) | Avoids the side-by-side height mismatch when one card is expanded; simpler vertical drag-reorder |
| Task checklist managed in the modal, persisted on task Save | Matches "persist the checklist order when the task is saved"; works for new (unsaved) tasks too, unlike relations |
| Checklist synced (matched by id) rather than replaced wholesale | Preserves item ids and completion status across edits and reordering |
| Checklist carried in the task create/update payload (no dedicated CRUD endpoints) | One round-trip per save; reuses the existing task endpoints; detail-panel toggles reuse the same update path |
| `task_checklist_items` created by `create_all` | Brand-new table needs no migration, unlike the `todo_threads.position` column |
| Dashboard status/workload counts click through to the filtered task list | Reuses the stat-card preset mechanism; lets the user jump from a metric to the exact rows behind it |
| Added an `active` task-list filter (excludes SID12/SID13) | The workload count is non-terminal only; a plain assignee filter would include closed tasks and not match the number |
| Exclude filters as comma-separated array params, applied as SQL NOT IN / NOT EXISTS | Pushes filtering to the DB (fast for large lists); multiple values per field; works alongside include filters as AND |
| Exclude keeps NULL assignee/release/priority rows visible (`OR is NULL`) | A plain `NOT IN` drops NULL rows in SQL; excluding "Vipul" or "release X" shouldn't hide unassigned / unreleased tasks |
