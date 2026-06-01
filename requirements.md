# PrimeDesk — Requirements Document

**Application Name:** PrimeDesk
**Team:** Prime Team
**Version:** 1.2 (Phase 1 Complete)
**Last Updated:** 2026-06-01

---

## Overview

PrimeDesk is a local team and task management application built for the Prime Team project lead. It manages team members, tasks, task relations, and meeting-driven todo threads. Tasks are sourced either from the MantisHub bug portal (via REST API) or entered manually as feature requests. The application runs entirely on the local machine and opens in the browser — no cloud or internet required except for portal fetch.

---

## 1. Bug Portal Integration

- **Portal**: MantisHub at `https://hornerautomation.mantishub.io`
- **Fetch method**: Mantis REST API — `GET /api/rest/issues/{id}` with API token header
- User enters a Task ID → application auto-fetches: title, description, reporter, severity, portal status
- API token stored securely using AES encryption (Fernet) in the local SQLite database
- Manual task entry available for new feature tasks not originating from the portal
- API token generated from: `your-portal/account_api_token_page.php`
- Settings page includes a **Test Connection** button to verify the token

---

## 2. Team Member Management

- Add, edit, and delete team members
- Each member has:
  - Full Name
  - Email (unique)
  - Hierarchy level: `Lead` | `Senior` | `Junior` | `Intern`
- Members are stored in the local SQLite database
- Dashboard shows active task count per member (workload view)

---

## 3. Task Properties

Each task has the following fields:

| Field | Description |
|---|---|
| Task ID | Portal ID (from Mantis) or blank for manual feature tasks |
| Title | Auto-filled from portal fetch or manually entered |
| Description | Full task description |
| Type | `Bug` (from portal) or `Feature` (manual) |
| Assignee | Team member assigned to the task |
| Priority | Integer (1 = highest). Auto-reorders per member on insert |
| Status | Custom SID00–SID14 status codes (see below) |
| Start Date | Task start date |
| End Date | Task due date |
| Labels | Dynamic user-defined labels (multi-select, filterable) |
| Color | Auto-computed on every read based on status and date |
| Comments | Append-only daily progress notes (timestamped, author tagged) |
| Attachments | One or more files per task (stored locally, downloadable) |
| Relations | Typed links to other tasks (see Section 16) |

### Task Status Codes

| Code | Label | Code | Label |
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

## 4. Priority Auto-Reordering

- Priority is **per team member** — each member has their own independent priority queue
- When a new task is assigned priority `N` to a member:
  - All existing tasks for that member with priority `>= N` are incremented by 1
  - New task is inserted at priority `N`
- When a task is deleted: all tasks with priority above the deleted task's priority are decremented
- When a task is reassigned to a different member: old member's queue is compacted, new member's queue is reordered

---

## 5. Color Coding

Color is computed server-side on every task fetch and is never stored statically:

| Condition | Color | Hex |
|---|---|---|
| Status = Closed / Released (SID12, SID13) | Green | `#1cc88a` |
| Status = Rework / Reopened (SID07, SID11) | Red | `#e74a3b` |
| Status = Waiting / On Hold (SID10, SID14) | Orange | `#f6c23e` |
| Status = Ready to Merge / Release (SID08, SID09) | Green | `#1cc88a` |
| Past end date (not terminal) | Red | `#e74a3b` |
| Due within 2 days (not terminal) | Orange | `#f6c23e` |
| Default (active, in-progress) | Blue | `#4e73df` |
| Unclassified | Gray | `#858796` |

---

## 6. Labels

- Labels are fully user-defined (name + hex color)
- Created and managed from the Settings page
- Multiple labels can be attached to a single task (toggle selection during task create/edit)
- Labels are reusable across tasks
- Tasks can be filtered by label

---

## 7. Filtering

Filter tasks by any combination of:
- Assignee (team member)
- Status
- Task type (Bug / Feature)
- End date range (from / to)
- Labels (multi-select)

---

## 8. Sorting / Ordering

Sort task list by:
- Priority (default, ascending) — shows per-member priority queue order
- Task name (A–Z or Z–A)
- Start date
- End date

Sort direction toggleable (ascending / descending) via button in filter bar.

---

## 9. Comments / Progress Notes

- Each task has an append-only comment thread
- Each comment records: content, author (default "Project Lead"), timestamp
- Comments are not deletable — preserved as audit trail
- Displayed in chronological order in the task detail panel (offcanvas)
- Maximum visible area scrollable (220px height cap)

---

## 10. File Attachments

- Multiple files can be attached per task
- Files stored in `backend/uploads/` folder with UUID-based filenames
- Original filename preserved in the database
- Download link available per attachment
- Individual attachments can be deleted (removes from disk and DB)

---

## 11. Next Ship Release Date

- A release date can be configured from the **Settings** page
- Displayed as a live countdown badge in the **topbar** on all pages
- Color-coded:
  - Green: more than 7 days away
  - Orange: 7 days or fewer remaining
  - Red: past due date
- Shows formatted date + pill label: "5d to go", "Today!", "Overdue by 2d"

---

## 12. Todo Threads (Meeting Action Items)

Each thread represents a group of action items tied to a meeting or event:

| Field | Description |
|---|---|
| Heading | Thread title (required) |
| Description | Notes, context, or agenda summary |
| Meeting | Free-text meeting/event reference (e.g. "Weekly Sync 2025-06-02") |
| Status | `open` or `done` |
| Items | Checklist of action items (add, check off, delete) |

- Threads are grouped: **Open** on top, **Completed** below
- Each thread card shows a progress bar (items done / total)
- Action items added inline via text input + Enter key or `+` button
- Marking a thread **Done** moves it to the completed section
- Thread can be **reopened** from the completed section

---

## 13. Cross-Platform

- Runs on **Ubuntu** and **Windows** with identical behavior
- `start.sh` for Ubuntu — uses Python 3.10 virtualenv
- `start.bat` for Windows — uses Python venv inside `backend/.venv` to bypass system pip issues
- Both scripts: create venv → install deps → start backend → start frontend → open browser
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

---

## 14. Dashboard

- Stat cards in order: Total Tasks, **Overdue**, Due Today, Due This Week
- Tasks by Status: progress bar breakdown with SID code + label + percentage
- Team Workload table: member name, role, active task count, capacity bar, load label (Low / Medium / High)

---

## 15. Authentication (Future — v2)

- Login screen to be added in a later phase
- Current phase: no authentication, local access only

---

## 16. Task Relations

- Tasks can be linked to other tasks with a typed relation
- Relations are managed in the **Edit Task** modal under the Relations section
- Relation types:

| Type | Meaning |
|---|---|
| Duplicate of | This task is a duplicate of another |
| Parent of | This task is the parent (the other is a sub-task) |
| Child of | This task is a sub-task of another |
| Blocks | This task must be resolved before the other can proceed |
| Blocked by | This task is waiting on another task |
| Related to | General loose connection between tasks |

- Each relation shown as a color-coded pill with the related task title and portal ID
- Individual relations can be removed with the × button
- Duplicate relations between the same task pair are prevented
- A task cannot be related to itself
- For new tasks: save first, then edit to add relations

---

## Out of Scope (v1)

- Multi-user / concurrent access
- Cloud deployment
- Email / Slack / push notifications
- Gantt chart or Kanban board view
- Time tracking
