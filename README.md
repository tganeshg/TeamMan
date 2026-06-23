# PrimeDesk

**Prime Team Task & Project Management Application**

PrimeDesk is a local web application built for the Prime Team project lead. It manages team members, tasks, task relations, releases, and generates team performance reports — all running on your local machine with no cloud or internet required (except for Mantis portal fetch).

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Stat cards (Total / Closed / Overdue / Due Today / Due This Week), task-by-status breakdown, team workload view |
| **Task Management** | Full CRUD, priority auto-reorder per member (sequential, gap-free), SID status codes, labels, comments, attachments |
| **Task Relations** | Link tasks with typed relations: Duplicate, Parent, Child, Blocks, Blocked By, Related To |
| **Mantis Integration** | Fetch task details from MantisHub portal via REST API using a stored API token |
| **Team Management** | Add/edit/delete members with role hierarchy (Lead / Senior / Junior / Intern) |
| **Todo Threads** | Meeting action items — heading, description, meeting reference, checklist items with progress; inline edit for individual checklist items |
| **Release Management** | Create and manage releases with active/completed status; topbar badge shows active release countdown |
| **Performance Reports** | Per-release team report: summary stats, per-member breakdown, task detail table; export as PDF or Word |
| **Labels** | User-defined color labels, attachable to tasks, filterable |
| **Settings** | Portal credentials, label management (release management is in Reports page) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10 + FastAPI + SQLAlchemy + SQLite |
| Frontend | React 18 + TypeScript + Vite 4 |
| UI Theme | SB Admin 2 (Bootstrap 5) |
| Font | Nunito (Google Fonts) |
| Icons | Bootstrap Icons |
| PDF Export | reportlab 4.2.2 |
| Word Export | python-docx 1.1.2 |

---

## Prerequisites

### Ubuntu / Linux
- Python 3.10 (`/usr/bin/python3.10`)
- Node.js 18+ and npm

### Windows
- Python 3.x with pip on PATH
- Node.js 16+ and npm on PATH

---

## Quick Start

### Ubuntu / Linux

```bash
chmod +x start.sh
./start.sh
```

### Windows

```bat
start.bat
```

Both scripts will:
1. Create a Python virtual environment inside `backend/.venv`
2. Install backend Python dependencies into the venv
3. Start the FastAPI backend on `http://localhost:3001`
4. Install frontend npm dependencies
5. Start the Vite dev server on `http://localhost:3000`
6. Open the browser automatically after 10 seconds

To restart the backend only (e.g. after a code change):
```bat
restart_backend.bat
```

---

## Manual Start (Development)

### Backend

```bash
cd backend
python3.10 -m venv .venv          # first time only
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 3001
```

### Frontend

```bash
cd frontend
npm install                        # first time only
npm run dev
```

Then open `http://localhost:3000` in your browser.

---

## Project Structure

```
TeamMan/
├── README.md
├── requirements.md          ← Functional requirements
├── design.md                ← Architecture & design document
├── start.sh                 ← Ubuntu one-click launcher
├── start.bat                ← Windows one-click launcher
├── restart_backend.bat      ← Windows: kill port 3001 and restart backend
│
├── backend/
│   ├── main.py              ← FastAPI app entry point
│   ├── models.py            ← SQLAlchemy ORM models
│   ├── schemas.py           ← Pydantic schemas
│   ├── database.py          ← DB engine + session
│   ├── requirements.txt     ← Python dependencies
│   ├── teamman.db           ← SQLite database (auto-created)
│   ├── uploads/             ← Task file attachments
│   ├── routers/             ← API route modules
│   └── services/            ← Mantis fetcher + crypto
│
└── frontend/
    ├── src/
    │   ├── App.tsx           ← Layout: sidebar, topbar, routes
    │   ├── index.css         ← SB Admin 2 custom styles
    │   ├── api/client.ts     ← All API call functions
    │   └── pages/
    │       ├── Dashboard.tsx
    │       ├── Tasks.tsx
    │       ├── Team.tsx
    │       ├── Todo.tsx
    │       ├── Reports.tsx
    │       └── Settings.tsx
    ├── vite.config.ts        ← Proxy: /api → localhost:3001
    └── package.json
```

---

## First-Time Setup — Mantis Portal

1. Open **Settings** in the sidebar
2. Enter your MantisHub portal URL (e.g. `https://yourteam.mantishub.io`)
3. Paste your API token from `your-portal/account_api_token_page.php`
4. Click **Save**, then **Test Connection**

---

## Task Status Codes

| Code | Status | Code | Status |
|---|---|---|---|
| SID00 | Not Started | SID08 | Ready to Merge |
| SID01 | Study | SID09 | Ready to Release |
| SID02 | Requirement | SID10 | Waiting |
| SID03 | POC | SID11 | Reopened |
| SID04 | Core Impl | SID12 | Closed |
| SID05 | Dev Testing | SID13 | Released |
| SID06 | Review | SID14 | On Hold |
| SID07 | Rework | | |

---

## Task Relation Types

| Type | Meaning |
|---|---|
| Duplicate of | This task is a duplicate of another |
| Parent of | This task is the parent (contains the other) |
| Child of | This task is a sub-task of another |
| Blocks | This task must be resolved before the other can proceed |
| Blocked by | This task is waiting on another |
| Related to | General loose connection |

---

## Priority Rules

- Priority is **per team member** — each member has an independent 1..N queue
- Priority field is **required** when an assignee is selected
- On insert at position K: tasks at K..N shift up by +1
- On move from K to L: only tasks between K and L shift (no gaps ever created)
- On delete: tasks above the deleted slot shift down by -1
- The system always maintains a clean sequential 1..N order

---

## Ports

| Service | URL |
|---|---|
| Frontend (UI) | http://localhost:3000 |
| Backend (API) | http://localhost:3001 |
| API Docs | http://localhost:3001/docs |

---

## Version

**Phase 1 — Complete**
- Full task management with SID status workflow and gap-free priority queues
- Task relations (Duplicate / Parent / Child / Blocks / Blocked By / Related To)
- Mantis portal integration
- Team member hierarchy
- Todo threads with meeting references and inline checklist item editing
- SB Admin 2 theme
- Release management with active/completed status; multiple active release badges in topbar
- Performance reports with PDF and Word export
- Live topbar search by task title or bug ID (debounced, opens task detail on click)
- Dashboard: Closed stat card added; Tasks by Status and Team Workload use SID status codes correctly
- Tasks filter bar: label-based filter replaces start-date filter
- Settings: removed stale "Release management moved" notice

> Authentication (login screen) is planned for Phase 2.
