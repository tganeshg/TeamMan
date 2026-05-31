# PrimeDesk

**Prime Team Task & Project Management Application**

PrimeDesk is a local web application built for the Prime Team project lead. It manages team members, tasks (sourced from MantisHub or entered manually), meeting-driven todo threads, and tracks the next ship release date — all running on your local machine with no cloud or internet required (except for Mantis portal fetch).

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Stat cards, task-by-status breakdown, team workload view |
| **Task Management** | Full CRUD, priority auto-reorder per member, SID status codes, labels, comments, attachments |
| **Mantis Integration** | Fetch task details from MantisHub portal via REST API using a stored API token |
| **Team Management** | Add/edit/delete members with role hierarchy (Lead / Senior / Junior / Intern) |
| **Todo Threads** | Meeting action items — heading, description, meeting reference, checklist items with progress |
| **Release Countdown** | Next ship release date badge in topbar on every page, color-coded countdown |
| **Labels** | User-defined color labels, attachable to tasks, filterable |
| **Settings** | Portal credentials, label management, release date configuration |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10 + FastAPI + SQLAlchemy + SQLite |
| Frontend | React 18 + TypeScript + Vite |
| UI Theme | SB Admin 2 (Bootstrap 5) |
| Font | Nunito (Google Fonts) |
| Icons | Bootstrap Icons |

---

## Prerequisites

### Ubuntu / Linux
- Python 3.10 (`/usr/bin/python3.10`)
- Node.js 18+ and npm

### Windows
- Python 3.x with pip on PATH
- Node.js 18+ and npm on PATH

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
1. Create a Python virtual environment (Ubuntu) / install deps (Windows)
2. Install backend Python dependencies
3. Start the FastAPI backend on `http://localhost:8000`
4. Install frontend npm dependencies
5. Start the Vite dev server on `http://localhost:3000`
6. Open the browser automatically

---

## Manual Start (Development)

### Backend

```bash
cd backend
python3.10 -m venv .venv          # first time only
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000
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
    │       └── Settings.tsx
    ├── vite.config.ts        ← Proxy: /api → localhost:8000
    └── package.json
```

---

## First-Time Setup — Mantis Portal

1. Open **Settings** in the sidebar
2. Enter your MantisHub portal URL (e.g. `https://yourteam.mantishub.io`)
3. Paste your API token from `your-portal/account_api_token_page.php`
4. Click **Save**, then **Test Connection**

Once configured, you can fetch task details on the Tasks page by entering a Mantis issue ID.

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

## Ports

| Service | URL |
|---|---|
| Frontend (UI) | http://localhost:3000 |
| Backend (API) | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Version

**Phase 1 — Complete**
- Full task management with SID status workflow
- Mantis portal integration
- Team member hierarchy
- Todo threads with meeting references
- SB Admin 2 theme
- Release date countdown

> Authentication (login screen) is planned for Phase 2.
