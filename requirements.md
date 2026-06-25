# PrimeDesk — Requirements Document

**Application Name:** PrimeDesk
**Team:** Prime Team
**Version:** 1.12 (Phase 1 Complete)
**Last Updated:** 2026-06-25

---

## Overview

PrimeDesk is a local team and task management application built for the Prime Team project lead. It manages team members, tasks, task relations, meeting todo threads, releases, and generates team performance reports. Tasks are sourced either from the MantisHub bug portal (via REST API) or entered manually as feature requests. The application runs entirely on the local machine and opens in the browser — no cloud or internet required except for portal fetch.

---

## 1. Bug Portal Integration

- **Portal**: MantisHub at `https://hornerautomation.mantishub.io`
- **Fetch method**: Mantis REST API — `GET /api/rest/issues/{id}` with API token header
- User enters a Task ID → application auto-fetches: title, description, reporter, severity, portal status
- API token stored securely using AES encryption (Fernet) in the local SQLite database
- Manual task entry available for new feature tasks not originating from the portal
- Settings page includes a **Test Connection** button to verify the token

---

## 2. Team Member Management

- Add, edit, and delete team members
- Each member has: Full Name, Email (unique), Hierarchy level (`Lead` | `Senior` | `Junior` | `Intern`)
- Dashboard shows active task count per member (workload view)

---

## 3. Task Properties

| Field | Description |
|---|---|
| Task ID | Portal ID (from Mantis) or blank for manual feature tasks |
| Title | Auto-filled from portal fetch or manually entered |
| Description | Full task description |
| Type | `Bug` (from portal) or `Feature` (manual) |
| Assignee | Team member assigned to the task |
| Priority | Integer (1 = highest). Sequential per member, no gaps allowed |
| Status | Custom SID00–SID14 status codes |
| Progress | 0–100% in fixed steps of 10 (default 0); 100% auto-closes the task (see §3a) |
| Start Date | Task start date |
| End Date | Task due date |
| Release | Which release this task belongs to (optional tag) |
| Labels | Dynamic user-defined labels (multi-select, filterable) |
| Color | Auto-computed on every read based on status and date |
| Comments | Append-only daily progress notes (timestamped, author tagged) |
| Attachments | One or more files per task (stored locally, downloadable) |
| Relations | Typed links to other tasks |
| Checklist | Ordered sub-items with done state (see §10a) |

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

## 3a. Progress

- Each task has a **Progress (%)** field, selectable in fixed increments: 0, 10, 20, …, 100
- Default for a new task is **0%**
- Set in the create/edit task form; saved when the task is saved
- **100% auto-closes** the task (status → Closed/SID12)
- If a closed task is **reopened** (status changed to a non-terminal code), progress may be set back below 100%
- Progress is shown in the task list as a percentage (with a progress bar), consistent with the form value
- Backward compatible: existing tasks default to 0%

---

## 4. Priority Rules

- Priority is **per team member** — two different members can both have a task at priority 1
- Priority field is **optional** when creating a task; if left blank for an assigned task, it is auto-appended to the **end** of that member's queue (existing priorities unchanged)
- The UI shows the valid range (e.g. `1 – 6`) next to the priority field
- On insert at position K: tasks at K..N shift up by +1
- On move from K to L (same member):
  - K → L (move down): tasks in (K, L] shift down by -1
  - K → L (move up): tasks in [L, K) shift up by +1
- On delete at K: tasks with priority > K shift down by -1
- On reassign to different member: old queue is compacted, task inserted at new position
- System always maintains a clean sequential 1..N order — no gaps, no duplicates
- Priority out of range is automatically clamped to the valid maximum

---

## 5. Color Coding

Color is computed server-side on every task fetch (never stored):

| Condition | Color | Hex |
|---|---|---|
| Status = Closed / Released (SID12, SID13) | Green | `#1cc88a` |
| Status = Rework / Reopened (SID07, SID11) | Red | `#e74a3b` |
| Status = Waiting / On Hold (SID10, SID14) | Orange | `#f6c23e` |
| Status = Ready to Merge / Release (SID08, SID09) | Green | `#1cc88a` |
| Past end date (not terminal) | Red | `#e74a3b` |
| Due within 2 days (not terminal) | Orange | `#f6c23e` |
| Default (active, in-progress) | Blue | `#4e73df` |

---

## 6. Labels

- Labels are fully user-defined (name + hex color), created in Settings
- Multiple labels can be attached to a single task
- Tasks can be filtered by label

---

## 7. Filtering & Sorting

Quick filters: Assignee, Status, Type, Release, End date (due) range, Labels, Active-only (non-terminal; used by the dashboard workload drill-through)

The task list view shows columns: Type, Assignee, Status, **Progress**, Due Date, Labels, and **Release** (plus ID, Title, Priority).

Sort by: Priority (default) · Title · Due Date — direction toggleable

### Include / Exclude Filter Builder

Beyond the quick filters, a builder supports multi-value **Include** and **Exclude** filtering:

- Mode: Include or Exclude
- Supported fields: Status, Assignee, Type, Labels, Release, Priority, **Progress**
- Built via a mode + field + value + Add control; active filters appear as removable chips — green `= Field: Value` (include) / red `≠ Field: Value` (exclude)
- **Multiple values** are supported per field and across fields
- Include and exclude filters work **together** with the quick filters (combined as AND)
- Examples: show all tasks except "Not Started"; except those at 100% progress; only those at 0% or 50% progress; except a given user/release
- Excluding an assignee / release / priority still shows tasks that have none of that field (NULL stays visible)
- Existing quick-filter behavior is unchanged; filtering is performed in the database (no client-side scan)

- The filter bar is fully controlled; navigating in from a dashboard stat card applies a **preset filter** and shows a `Showing: <label>` banner with a **Clear filter** button that resets to the default `priority / ascending` view.

## 7a. Inline Editing (Task List)

Editable directly in the task list table without opening the modal:

| Field | Editor | Save behavior |
|---|---|---|
| Priority | number popover (only when assigned) | Enter saves · Esc cancels · outside-click auto-saves |
| Title | text popover (**feature tasks only**) | Enter saves · Esc cancels · outside-click auto-saves |
| Due Date | date popover | Enter saves · Esc cancels · outside-click auto-saves |
| Labels | checkbox popover | outside-click auto-saves |
| Assignee | dropdown | saves on change |
| Status | dropdown | saves on change |

- Bug titles are not inline-editable (kept authoritative from the Mantis portal).

---

## 8. Comments / Progress Notes

- Append-only comment thread per task
- Each comment records: content, author ("Project Lead"), timestamp
- Not deletable — preserved as audit trail

---

## 9. File Attachments

- Multiple files per task, stored in `backend/uploads/` with UUID-based filenames
- Download link available; individual attachments deletable

---

## 10. Task Relations

- Relations are managed in the **Edit Task** modal under the Relations section
- Types:

| Type | Meaning |
|---|---|
| Duplicate of | This task is a duplicate of another |
| Parent of | This task is the parent (the other is a sub-task) |
| Child of | This task is a sub-task of another |
| Blocks | This task must be resolved before the other can proceed |
| Blocked by | This task is waiting on another task |
| Related to | General loose connection |

- Shown as color-coded pills with × to remove
- Duplicate relations between the same pair are prevented
- A task cannot be related to itself
- For new tasks: save first, then edit to add relations

---

## 10a. Task Checklist

- Each task can have an ordered list of checklist (sub-) items, each with text and a done flag
- Managed in the **Edit / New Task** modal: add, edit (type in place), delete, toggle done, and **drag-and-drop reorder**
- The checklist (including its order) is **persisted when the task is saved**; checklists can be added on a brand-new task too
- The **task detail panel** displays the checklist in order with toggleable checkboxes (saved immediately)
- The **task list** shows a `done/total` progress badge for tasks that have a checklist
- Completion status of existing items is preserved through editing and reordering
- Deleting a task removes its checklist items (cascade)
- The drag-and-drop order is reflected wherever the checklist is displayed

---

## 11. Release Management

- Releases are created from the **Reports** page
- Each release has: Name (e.g. `17.60`), Target Ship Date, Status (`active` | `completed`)
- Only one release is typically active at a time
- Tasks are manually tagged to a release via the Release dropdown in the Task modal
- The topbar badge shows the active release name and countdown
- Releases can be edited (name/date), marked complete, or reopened
- Completed releases retain their report data permanently

---

## 12. Team Performance Reports

- Accessible from the **Reports** page in the sidebar
- Select a release from the left panel to view its report
- Report sections:
  - **Summary cards**: Total Tasks, Closed, Early, On Time, Late Closed, Open/Overdue, In Progress
  - **Per-member breakdown table**: one row per member with all counters
  - **Task detail table**: filterable by member, shows timing badge per task
- Timing classification:
  - **Early**: closed more than 2 days before end_date
  - **On Time**: closed on or before end_date
  - **Overdue (closed)**: closed after end_date
  - **Open/Overdue**: not closed, past end_date
  - **In Progress**: not closed, within deadline
- `closed_at` is auto-set by the backend when a task moves to SID12/SID13; cleared if reopened
- Export options:
  - **PDF**: generated server-side by reportlab — titled "Prime Team Report", same layout as Word
  - **Word (.docx)**: generated server-side by python-docx — titled "Prime Team Report"

---

## 13. Todo Threads (Meeting Action Items)

| Field | Description |
|---|---|
| Heading | Thread title (required) |
| Description | Notes, context, or agenda summary |
| Meeting | Free-text meeting/event reference |
| Status | `open` or `done` |
| Items | Checklist of action items |

- Open threads on top, Completed below; threads can be reopened
- Threads are listed vertically, one per row (full width)
- **Collapsible:** threads are collapsed by default and show only the heading; clicking the heading expands/collapses the checklist. Each thread expands independently.
- Checklist items support inline editing (pencil → edit; Enter/blur saves, Esc cancels)
- **Drag-and-drop reordering:**
  - Threads can be dragged (grip handle) to reorder the TODO list; the new order is saved automatically and persists across refresh/restart.
  - Checklist items can be dragged within a thread to reorder; the new order is saved automatically.
  - Checklist items can be dragged **from one thread to another** (drop on an item to position it, or on the card to append); the move is saved automatically and the item's checked/unchecked status is preserved.
  - Reordering must never change an item's checked/unchecked status.
  - Thread and checklist reordering work independently; visual feedback is shown while dragging.

---

## 14. Dashboard

- Stat cards in order: Total Tasks → **Closed** → Overdue → Due Today → Due This Week
- Stat cards are **clickable** — each navigates to the Tasks page pre-filtered to that metric (e.g. Closed → `SID12`, Overdue → past due) and shows a filter banner
- Tasks by Status: SID code + label + progress bar + percentage. **Clicking a status count** opens the Tasks page filtered to that status (count matches the list).
- Team Workload table: member name, role badge, active task count, capacity bar, load badge. **Clicking a member's active-task count** opens the Tasks page filtered to that member's active (non-terminal) tasks.

---

## 14a. User Interface & Theme

- ArchitectUI Dashboard theme over Bootstrap 5; Nunito font
- **Light / Dark mode** toggle in the topbar; the choice is persisted in the browser and restored on next launch
- **Live search** in the topbar: debounced (300ms), matches task title or portal bug ID, shows up to 8 results; selecting one opens that task's detail panel on the Tasks page
- Topbar shows a countdown badge for every active release

## 15. Cross-Platform

- `start.sh` for Ubuntu, `start.bat` for Windows
- Backend runs on port **3001**, frontend on port **3000**
- `restart_backend.bat` on Windows: kills port 3001 and restarts backend

---

## 16. Authentication (Future — v2)

- Login screen planned for a later phase
- Current phase: no authentication, local access only

---

## Out of Scope (v1)

- Multi-user / concurrent access
- Cloud deployment
- Email / Slack / push notifications
- Gantt chart or Kanban board view
- Time tracking
