import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import {
  Table, Button, Badge, Modal, Form, Row, Col,
  Offcanvas, Spinner, Alert, InputGroup, Dropdown,
} from 'react-bootstrap'
import dayjs from 'dayjs'
import {
  getTasks, getTask, createTask, updateTask, deleteTask,
  getMembers, getLabels, addComment, uploadAttachment,
  deleteAttachment, downloadUrl, fetchMantisIssue, assignTask,
  getRelations, addRelation, deleteRelation, getReleases,
  getPortalStatus, taskExportXlsxUrl, bulkUpdateTasks,
} from '../api/client'
import type { Task, TaskDetail, Member, Label, TaskFilters, TaskRelation, RelationType, Release, ChecklistItem } from '../types'

// Checklist row as held in the task modal's form state (key = stable client id)
interface ChecklistRow { id?: number; text: string; done: boolean; key: string }

const COLOR_HEX: Record<string, string> = {
  gray: '#858796', blue: '#4e73df', orange: '#f6c23e', red: '#e74a3b', green: '#1cc88a',
}
const STATUS_LABEL: Record<string, string> = {
  SID00: 'Not Started',
  SID01: 'Study',
  SID02: 'Requirement',
  SID03: 'POC',
  SID04: 'Core Impl',
  SID05: 'Dev Testing',
  SID06: 'Review',
  SID07: 'Rework',
  SID08: 'Ready to Merge',
  SID09: 'Ready to Release',
  SID10: 'Waiting',
  SID11: 'Reopened',
  SID12: 'Closed',
  SID13: 'Released',
  SID14: 'On Hold',
  SID15: 'Debug',
  SID16: 'Moved to Software',
}
const STATUS_COLOR_HEX: Record<string, string> = {
  SID00: '#858796',
  SID01: '#858796',
  SID02: '#4e73df',
  SID03: '#36b9cc',
  SID04: '#4e73df',
  SID05: '#36b9cc',
  SID06: '#f6c23e',
  SID07: '#e74a3b',
  SID08: '#1cc88a',
  SID09: '#1cc88a',
  SID10: '#f6c23e',
  SID11: '#e74a3b',
  SID12: '#858796',
  SID13: '#1cc88a',
  SID14: '#f6c23e',
  SID15: '#4e73df',
  SID16: '#f6c23e',
}
const STATUS_VARIANT: Record<string, string> = {
  SID00: 'secondary',
  SID01: 'secondary',
  SID02: 'primary',
  SID03: 'info',
  SID04: 'primary',
  SID05: 'info',
  SID06: 'warning',
  SID07: 'danger',
  SID08: 'success',
  SID09: 'success',
  SID10: 'warning',
  SID11: 'danger',
  SID12: 'secondary',
  SID13: 'success',
  SID14: 'warning',
  SID15: 'primary',
  SID16: 'warning',
}
const ROLE_VARIANT: Record<string, string> = {
  Lead: 'warning', Senior: 'primary', Junior: 'success', Intern: 'secondary',
}

const RELATION_LABEL: Record<RelationType, string> = {
  duplicate:   'Duplicate of',
  parent:      'Parent of',
  child:       'Child of',
  blocks:      'Blocks',
  blocked_by:  'Blocked by',
  related_to:  'Related to',
}
const RELATION_COLOR: Record<RelationType, string> = {
  duplicate:  '#858796',
  parent:     '#4e73df',
  child:      '#36b9cc',
  blocks:     '#e74a3b',
  blocked_by: '#f6c23e',
  related_to: '#1cc88a',
}

function PriorityDot({ p }: { p: number | null }) {
  if (p == null) return <span className="text-muted">—</span>
  const bg = p === 1 ? '#dc3545' : p === 2 ? '#fd7e14' : '#0d6efd'
  return <span className="priority-badge" style={{ background: bg }}>{p}</span>
}

export default function Tasks() {
  const { user } = useAuth()
  const isLead = user?.role === 'lead'
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])   // unfiltered, for the relation picker
  const [members, setMembers] = useState<Member[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>(() => {
    const s = routeLocation.state as { preset?: TaskFilters } | null
    // From a dashboard preset → use it as-is (may intentionally include done tasks)
    if (s?.preset) return { sort_by: 'priority', sort_order: 'asc', ...s.preset }
    // Default Tasks view hides done tasks — Closed (SID12) + Released (SID13); chips are removable
    return { sort_by: 'priority', sort_order: 'asc', exclude_status: ['SID12', 'SID13'] }
  })
  const [presetLabel, setPresetLabel] = useState<string | null>(() => {
    const s = routeLocation.state as { presetLabel?: string } | null
    return s?.presetLabel ?? null
  })

  const [showDetail, setShowDetail] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskSaving, setTaskSaving] = useState(false)
  const [mantisLoading, setMantisLoading] = useState(false)
  const [mantisError, setMantisError] = useState('')

  const [form, setForm] = useState<Record<string, any>>({})
  const [commentText, setCommentText] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkAssignee, setBulkAssignee] = useState('')
  const [bulkApplying, setBulkApplying] = useState(false)

  // Confirm close (feature 10): track which inline status editor is pending a close confirmation
  const [confirmCloseTaskId, setConfirmCloseTaskId] = useState<number | null>(null)
  const [confirmCloseStatus, setConfirmCloseStatus] = useState<string>('')

  // Relations state (for modal)
  const [relations, setRelations] = useState<TaskRelation[]>([])
  const [relType, setRelType] = useState<RelationType>('related_to')
  const [relTaskId, setRelTaskId] = useState<string>('')
  const [relError, setRelError] = useState('')
  const [relSaving, setRelSaving] = useState(false)

  // Checklist state (for modal) — managed in form.checklist; saved with the task
  const [clText, setClText] = useState('')
  const [clDragKey, setClDragKey] = useState<string | null>(null)
  const [clOverKey, setClOverKey] = useState<string | null>(null)

  const updateChecklist = (fn: (cl: ChecklistRow[]) => ChecklistRow[]) =>
    setForm(f => ({ ...f, checklist: fn((f.checklist ?? []) as ChecklistRow[]) }))

  const addChecklistItem = () => {
    const t = clText.trim()
    if (!t) return
    updateChecklist(cl => [...cl, { key: `tmp-${Date.now()}-${cl.length}`, text: t, done: false }])
    setClText('')
  }
  // Import checklist items from a .txt file — one non-empty line each (saved with the task)
  const importChecklistFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length) {
        updateChecklist(cl => [
          ...cl,
          ...lines.map((text, i) => ({ key: `tmp-${Date.now()}-${cl.length + i}`, text, done: false })),
        ])
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  const editChecklistText = (key: string, text: string) =>
    updateChecklist(cl => cl.map(i => (i.key === key ? { ...i, text } : i)))
  const toggleChecklistDone = (key: string) =>
    updateChecklist(cl => cl.map(i => (i.key === key ? { ...i, done: !i.done } : i)))
  const deleteChecklistItem = (key: string) =>
    updateChecklist(cl => cl.filter(i => i.key !== key))
  const reorderChecklist = (dragKey: string, targetKey: string) => {
    if (dragKey === targetKey) return
    updateChecklist(cl => {
      const arr = [...cl]
      const from = arr.findIndex(i => i.key === dragKey)
      if (from < 0) return cl
      const [moved] = arr.splice(from, 1)
      const to = arr.findIndex(i => i.key === targetKey)
      if (to < 0) return cl
      arr.splice(to, 0, moved)
      return arr
    })
  }

  // Toggle a checklist item's done state from the detail panel (saves immediately)
  const toggleDetailChecklist = async (item: ChecklistItem) => {
    if (!selectedTask) return
    const updated = selectedTask.checklist.map(c => ({
      id: c.id, text: c.text, done: c.id === item.id ? !c.done : c.done,
    }))
    await updateTask(selectedTask.id, { checklist: updated })
    const d = await getTask(selectedTask.id)
    setSelectedTask(d)
    load()
  }

  const [detailClText, setDetailClText] = useState('')

  const addDetailChecklistItem = async () => {
    if (!selectedTask || !detailClText.trim()) return
    const updated = [
      ...selectedTask.checklist.map(c => ({ id: c.id, text: c.text, done: c.done })),
      { text: detailClText.trim(), done: false },
    ]
    await updateTask(selectedTask.id, { checklist: updated })
    setDetailClText('')
    const d = await getTask(selectedTask.id)
    setSelectedTask(d)
    load()
  }

  // ── Include / Exclude filter builder (multi-value) ─────────────────────────
  const [fbMode, setFbMode] = useState<'include' | 'exclude'>('include')
  const [fbBase, setFbBase] = useState<string>('status')
  const [fbValue, setFbValue] = useState<string>('')

  const FILTER_FIELDS: { base: string; label: string; numeric: boolean }[] = [
    { base: 'status', label: 'Status', numeric: false },
    { base: 'assignee_id', label: 'Assignee', numeric: true },
    { base: 'task_type', label: 'Type', numeric: false },
    { base: 'label_ids', label: 'Labels', numeric: true },
    { base: 'release_id', label: 'Release', numeric: true },
    { base: 'priority', label: 'Priority', numeric: true },
    { base: 'progress', label: 'Progress', numeric: true },
  ]

  const fbValueOptions = (): { value: string; label: string }[] => {
    switch (fbBase) {
      case 'status':      return Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: `${k} – ${v}` }))
      case 'assignee_id': return members.map(m => ({ value: String(m.id), label: m.name }))
      case 'task_type':   return [{ value: 'bug', label: 'Bug' }, { value: 'feature', label: 'Feature' }]
      case 'label_ids':   return labels.map(l => ({ value: String(l.id), label: l.name }))
      case 'release_id':  return releases.map(r => ({ value: String(r.id), label: r.name }))
      case 'priority':    return [...new Set(tasks.map(t => t.priority).filter((p): p is number => p != null))].sort((a, b) => a - b).map(p => ({ value: String(p), label: `P${p}` }))
      case 'progress':    return [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => ({ value: String(p), label: `${p}%` }))
      default: return []
    }
  }

  const addFilter = () => {
    if (!fbValue) return
    const def = FILTER_FIELDS.find(d => d.base === fbBase)!
    const parsed: any = def.numeric ? Number(fbValue) : fbValue
    const key = `${fbMode === 'include' ? 'in' : 'exclude'}_${fbBase}`
    setFilters(f => {
      const cur = ((f as any)[key] ?? []) as any[]
      if (cur.includes(parsed)) return f
      return { ...f, [key]: [...cur, parsed] }
    })
    setFbValue('')
  }

  const removeFilter = (key: string, val: any) => {
    setFilters(f => {
      const cur = ((f as any)[key] ?? []) as any[]
      const next = cur.filter(x => x !== val)
      return { ...f, [key]: next.length ? next : undefined }
    })
  }

  const fbValueLabel = (base: string, val: any): string => {
    switch (base) {
      case 'status':      return `${val} – ${STATUS_LABEL[val] ?? val}`
      case 'assignee_id': return members.find(m => m.id === val)?.name ?? `#${val}`
      case 'task_type':   return val === 'bug' ? 'Bug' : 'Feature'
      case 'label_ids':   return labels.find(l => l.id === val)?.name ?? `#${val}`
      case 'release_id':  return releases.find(r => r.id === val)?.name ?? `#${val}`
      case 'priority':    return `P${val}`
      case 'progress':    return `${val}%`
      default: return String(val)
    }
  }
  const fbFieldLabel = (base: string) => FILTER_FIELDS.find(d => d.base === base)?.label ?? base
  const activeBuilderChips = FILTER_FIELDS.flatMap(d => ([
    ...(((filters as any)[`in_${d.base}`] ?? []) as any[]).map(val => ({ mode: 'include' as const, base: d.base, key: `in_${d.base}`, val })),
    ...(((filters as any)[`exclude_${d.base}`] ?? []) as any[]).map(val => ({ mode: 'exclude' as const, base: d.base, key: `exclude_${d.base}`, val })),
  ]))

  // Inline editing state
  const [inlineEdit, setInlineEdit] = useState<{ taskId: number; field: 'assignee' | 'status' | 'due_date' | 'labels' | 'priority' | 'title' | 'progress' | 'release' } | null>(null)
  const [inlineValue, setInlineValue] = useState<any>(null)
  const inlineRef = useRef<HTMLDivElement>(null)
  const inlineEditRef = useRef<typeof inlineEdit>(null)
  const inlineValueRef = useRef<any>(null)

  const load = useCallback(() => {
    setLoading(true)
    getTasks(filters).then(setTasks).finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])

  const tasksRef = useRef<Task[]>([])
  useEffect(() => { tasksRef.current = tasks }, [tasks])

  const quickUpdate = async (taskId: number, patch: Record<string, any>) => {
    const task = tasksRef.current.find(t => t.id === taskId)!
    await updateTask(taskId, {
      title: task.title,
      task_type: task.task_type,
      status: task.status,
      label_ids: task.labels.map(l => l.id),
      assignee_id: task.assignee?.id ?? undefined,
      priority: task.priority ?? undefined,
      end_date: task.end_date ?? undefined,
      start_date: task.start_date ?? undefined,
      release_id: task.release_id ?? null,
      ...patch,
    })
    load()
  }

  const openInline = (taskId: number, field: 'assignee' | 'status' | 'due_date' | 'labels' | 'priority' | 'title' | 'progress' | 'release', currentValue: any) => {
    if (!isLead) return
    inlineEditRef.current = { taskId, field }
    inlineValueRef.current = currentValue
    setInlineEdit({ taskId, field })
    setInlineValue(currentValue)
  }

  const closeInline = () => {
    inlineEditRef.current = null
    inlineValueRef.current = null
    setInlineEdit(null)
    setInlineValue(null)
  }

  // Close inline editor on outside click; auto-save due_date
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (inlineRef.current && !inlineRef.current.contains(e.target as Node)) {
        const edit = inlineEditRef.current
        const val = inlineValueRef.current
        closeInline()
        if (edit?.field === 'title') {
          const trimmed = (val as string)?.trim()
          if (trimmed) quickUpdate(edit.taskId, { title: trimmed })
        } else if (edit?.field === 'due_date') {
          quickUpdate(edit.taskId, { end_date: val || undefined })
        } else if (edit?.field === 'labels') {
          quickUpdate(edit.taskId, { label_ids: val as number[] ?? [] })
        } else if (edit?.field === 'priority') {
          const task = tasksRef.current.find(t => t.id === edit.taskId)
          if (task?.assignee) quickUpdate(edit.taskId, { priority: Number(val), assignee_id: task.assignee.id })
        }
      }
    }
    if (inlineEdit) {
      document.addEventListener('mousedown', handleMouseDown)
    }
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [inlineEdit])

  useEffect(() => {
    getMembers().then(setMembers)
    getLabels().then(setLabels)
    getReleases().then(setReleases)
    getPortalStatus().then(c => { if (c.portal_url) setPortalUrl(c.portal_url) }).catch(() => {})
  }, [])

  // Handle navigation state: search result open OR dashboard preset filter
  useEffect(() => {
    const state = routeLocation.state as { openTaskId?: number; preset?: TaskFilters; presetLabel?: string } | null
    if (!state) return
    if (state.openTaskId) {
      openDetail({ id: state.openTaskId } as Task)
    }
    if (state.preset !== undefined) {
      setFilters({ sort_by: 'priority', sort_order: 'asc', ...state.preset })
      setPresetLabel(state.presetLabel ?? null)
    }
    // Clear state immediately so re-renders don't re-apply
    window.history.replaceState({}, '')
  }, [routeLocation.state])

  const openDetail = async (task: Task) => {
    setShowDetail(true)
    setDetailLoading(true)
    setSelectedTask(null)
    setCommentText('')
    try {
      const d = await getTask(task.id)
      setSelectedTask(d)
    } catch {
      // ignore — offcanvas will show loading state
    } finally {
      setDetailLoading(false)
    }
  }

  const openCreate = () => {
    setEditingTask(null)
    setForm({ task_type: 'feature', status: 'SID00', progress: 0, label_ids: [], checklist: [] })
    setMantisError('')
    setRelations([])
    setRelType('related_to')
    setRelTaskId('')
    setRelError('')
    setClText('')
    setShowModal(true)
  }

  const openEdit = async (task: Task) => {
    setEditingTask(task)
    setMantisError('')
    setRelType('related_to')
    setRelTaskId('')
    setRelError('')
    setClText('')
    // Fetch full detail to load the checklist before the modal opens, so a
    // quick Save can't clear an unloaded checklist.
    const detail = await getTask(task.id).catch(() => null)
    const src = detail ?? task
    setForm({
      ...src,
      label_ids: src.labels.map(l => l.id),
      start_date: src.start_date ?? '',
      end_date: src.end_date ?? '',
      release_id: src.release_id ?? null,
      checklist: (detail?.checklist ?? []).map(c => ({ id: c.id, text: c.text, done: c.done, key: `db-${c.id}` })),
    })
    getRelations(task.id).then(setRelations).catch(() => setRelations([]))
    getTasks().then(setAllTasks).catch(() => setAllTasks([]))   // full list for relation picker
    setShowModal(true)
  }

  const setField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleMantisLookup = async () => {
    if (!form.portal_task_id) return
    setMantisLoading(true)
    setMantisError('')
    try {
      const issue = await fetchMantisIssue(String(form.portal_task_id))
      setForm(f => ({
        ...f,
        title: issue.title,
        description: issue.description ?? '',
        task_type: 'bug',
      }))
    } catch (e: any) {
      setMantisError(e?.response?.data?.detail ?? 'Failed to fetch from portal.')
    } finally {
      setMantisLoading(false)
    }
  }

  const handleTaskSubmit = async () => {
    if (!form.title?.trim()) return
    setTaskSaving(true)
    try {
      const payload = {
        title: form.title,
        description: form.description,
        task_type: form.task_type,
        portal_task_id: form.portal_task_id || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        status: form.status,
        progress: form.progress != null ? Number(form.progress) : 0,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : undefined,
        priority: form.priority ? Number(form.priority) : undefined,
        label_ids: form.label_ids ?? [],
        release_id: form.release_id ? Number(form.release_id) : null,
        checklist: ((form.checklist ?? []) as ChecklistRow[]).map(i => ({ id: i.id, text: i.text, done: i.done })),
      }
      if (editingTask) {
        await updateTask(editingTask.id, payload)
        if (selectedTask?.id === editingTask.id) {
          const d = await getTask(editingTask.id)
          setSelectedTask(d)
        }
      } else {
        await createTask(payload)
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      setMantisError(e?.response?.data?.detail ?? 'Save failed.')
    } finally {
      setTaskSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    await deleteTask(id)
    setDeleteConfirmId(null)
    if (selectedTask?.id === id) setShowDetail(false)
    load()
  }

  const handleAddComment = async () => {
    if (!selectedTask || !commentText.trim()) return
    setCommentSaving(true)
    try {
      await addComment(selectedTask.id, commentText.trim())
      setCommentText('')
      const d = await getTask(selectedTask.id)
      setSelectedTask(d)
    } finally {
      setCommentSaving(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTask || !e.target.files?.length) return
    for (const file of Array.from(e.target.files)) {
      await uploadAttachment(selectedTask.id, file)
    }
    const d = await getTask(selectedTask.id)
    setSelectedTask(d)
    e.target.value = ''
  }

  const handleDeleteAttachment = async (attId: number) => {
    await deleteAttachment(attId)
    if (selectedTask) {
      const d = await getTask(selectedTask.id)
      setSelectedTask(d)
    }
  }

  // Feature 9: keyboard shortcut N → open create modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return
      if (showModal || showDetail) return
      if ((e.key === 'n' || e.key === 'N') && isLead) openCreate()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showModal, showDetail])

  // Feature 6: bulk apply
  const handleBulkApply = async () => {
    if (selectedIds.size === 0) return
    const patch: Record<string, any> = {}
    if (bulkStatus) patch.status = bulkStatus
    if (bulkAssignee) patch.assignee_id = Number(bulkAssignee)
    if (!Object.keys(patch).length) return
    setBulkApplying(true)
    try {
      await bulkUpdateTasks(Array.from(selectedIds), patch)
      setSelectedIds(new Set())
      setBulkStatus('')
      setBulkAssignee('')
      load()
    } finally {
      setBulkApplying(false)
    }
  }

  const toggleLabel = (id: number) => {
    const ids: number[] = form.label_ids ?? []
    setField('label_ids', ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }

  const headerEl = document.getElementById('page-header-actions')

  const downloadExport = (f?: TaskFilters) => {
    const a = document.createElement('a')
    a.href = taskExportXlsxUrl(f)
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <>
      {headerEl && createPortal(
        <div className="d-flex gap-2">
          <Dropdown>
            <Dropdown.Toggle size="sm" variant="outline-success">
              <i className="bi bi-file-earmark-excel me-1" />Export
            </Dropdown.Toggle>
            <Dropdown.Menu align="end">
              <Dropdown.Item onClick={() => downloadExport(filters)}>
                <i className="bi bi-funnel me-2" />Current view (with filters)
              </Dropdown.Item>
              <Dropdown.Item onClick={() => downloadExport(undefined)}>
                <i className="bi bi-list-ul me-2" />All tasks (no filters)
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          {isLead && (
            <Button variant="primary" size="sm" onClick={openCreate}>
              <i className="bi bi-plus-lg me-1" />New Task
            </Button>
          )}
        </div>,
        headerEl
      )}

      {/* Preset filter banner */}
      {presetLabel && (
        <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2"
          style={{ background: 'rgba(78,115,223,0.08)', border: '1px solid var(--primary)', borderRadius: 8 }}>
          <i className="bi bi-funnel-fill" style={{ color: 'var(--primary)', fontSize: '0.85rem' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--primary)' }}>
            Showing: {presetLabel}
          </span>
          <button
            className="btn btn-sm ms-auto"
            style={{ padding: '2px 10px', fontSize: '0.8rem', color: 'var(--primary)', border: '1px solid var(--primary)', background: 'transparent', borderRadius: 6 }}
            onClick={() => { setPresetLabel(null); setFilters({ sort_by: 'priority', sort_order: 'asc', exclude_status: ['SID12', 'SID13'] }) }}
          >
            <i className="bi bi-x me-1" />Clear filter
          </button>
        </div>
      )}

      {/* Feature 7: Quick filter chips */}
      {(() => {
        const todayStr = new Date().toISOString().split('T')[0]
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
        type Chip = { label: string; icon: string; match: () => boolean; apply: () => void }
        const chips: Chip[] = [
          {
            label: 'All',
            icon: 'bi-list-ul',
            match: () => !filters.end_date_to && !filters.end_date_from && !filters.status && !(filters.exclude_status?.length),
            apply: () => setFilters({ sort_by: filters.sort_by, sort_order: filters.sort_order }),
          },
          {
            label: 'Overdue',
            icon: 'bi-exclamation-triangle',
            match: () => filters.end_date_to === yesterdayStr && !filters.end_date_from && (filters.exclude_status ?? []).includes('SID12'),
            apply: () => setFilters(f => ({ sort_by: f.sort_by, sort_order: f.sort_order, end_date_to: yesterdayStr, exclude_status: ['SID12', 'SID13'] })),
          },
          {
            label: 'Due Today',
            icon: 'bi-clock',
            match: () => filters.end_date_from === todayStr && filters.end_date_to === todayStr,
            apply: () => setFilters(f => ({ sort_by: f.sort_by, sort_order: f.sort_order, end_date_from: todayStr, end_date_to: todayStr })),
          },
          {
            label: 'Due This Week',
            icon: 'bi-calendar-week',
            match: () => filters.end_date_from === todayStr && filters.end_date_to === nextWeekStr,
            apply: () => setFilters(f => ({ sort_by: f.sort_by, sort_order: f.sort_order, end_date_from: todayStr, end_date_to: nextWeekStr })),
          },
          {
            label: 'Not Started',
            icon: 'bi-circle',
            match: () => filters.status === 'SID00',
            apply: () => setFilters(f => ({ sort_by: f.sort_by, sort_order: f.sort_order, status: 'SID00' })),
          },
        ]
        return (
          <div className="quick-filter-chips">
            {chips.map(c => (
              <button key={c.label} className={`quick-chip${c.match() ? ' active' : ''}`} onClick={c.apply}>
                <i className={`bi ${c.icon}`} />{c.label}
              </button>
            ))}
          </div>
        )
      })()}

      {/* Feature 6: Bulk action bar */}
      {isLead && selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-count"><i className="bi bi-check2-square me-1" />{selectedIds.size} selected</span>
          <Form.Select size="sm" style={{ width: 160 }} value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
            <option value="">Set Status…</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Form.Select>
          <Form.Select size="sm" style={{ width: 160 }} value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)}>
            <option value="">Set Assignee…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Form.Select>
          <Button size="sm" variant="primary" onClick={handleBulkApply} disabled={bulkApplying || (!bulkStatus && !bulkAssignee)}>
            {bulkApplying ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="bi bi-check-lg me-1" />}Apply
          </Button>
          <Button size="sm" variant="outline-secondary" className="ms-auto" onClick={() => setSelectedIds(new Set())}>
            <i className="bi bi-x" /> Clear
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card filter-card mb-3">
        <div className="card-body py-2">
          {/* Include filters — kept on a single line (scrolls horizontally if needed) */}
          <div className="d-flex align-items-center gap-2 flex-nowrap" style={{ overflowX: 'auto' }}>
            <Form.Select size="sm" style={{ flex: '1 1 0', minWidth: 120 }} value={filters.assignee_id ?? ''} onChange={e => setFilters(f => ({ ...f, assignee_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">All Members</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Form.Select>
            <Form.Select size="sm" style={{ flex: '1 1 0', minWidth: 120 }} value={filters.status ?? ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}>
              <option value="">All Status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Form.Select>
            <Form.Select size="sm" style={{ flex: '1 1 0', minWidth: 110 }} value={filters.task_type ?? ''} onChange={e => setFilters(f => ({ ...f, task_type: e.target.value || undefined }))}>
              <option value="">All Types</option>
              <option value="bug">Bug</option>
              <option value="feature">Feature</option>
            </Form.Select>
            <Form.Select size="sm" style={{ flex: '1 1 0', minWidth: 110 }} value={filters.label_ids?.[0] ?? ''} onChange={e => setFilters(f => ({ ...f, label_ids: e.target.value ? [Number(e.target.value)] : undefined }))}>
              <option value="">All Labels</option>
              {labels.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Form.Select>
            <Form.Select size="sm" style={{ flex: '1 1 0', minWidth: 110 }} value={filters.release_id ?? ''} onChange={e => setFilters(f => ({ ...f, release_id: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">All Releases</option>
              {releases.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Form.Select>
            <Form.Control size="sm" style={{ flex: '1 1 0', minWidth: 130 }} type="date" value={filters.end_date_to ?? ''}
              onChange={e => setFilters(f => ({ ...f, end_date_to: e.target.value || undefined }))} />
            <Form.Select size="sm" style={{ flex: '0 1 120px', minWidth: 110 }} value={filters.sort_by} onChange={e => setFilters(f => ({ ...f, sort_by: e.target.value }))}>
              <option value="priority">Priority</option>
              <option value="title">Title</option>
              <option value="end_date">Due Date</option>
            </Form.Select>
            <Button
              variant={filters.sort_order === 'asc' ? 'outline-primary' : 'primary'}
              size="sm"
              className="flex-shrink-0"
              onClick={() => setFilters(f => ({ ...f, sort_order: f.sort_order === 'asc' ? 'desc' : 'asc' }))}
            >
              <i className={`bi bi-sort-${filters.sort_order === 'asc' ? 'up' : 'down'}`} />
            </Button>
          </div>

          {/* Include / Exclude filter builder (multi-value) */}
          <Row className="g-2 align-items-center mt-1">
            <Col xs="auto">
              <span className="badge" style={{ background: '#eef2ff', color: '#4e73df', fontWeight: 700, fontSize: '0.72rem' }}>
                <i className="bi bi-funnel me-1" />Filter
              </span>
            </Col>
            <Col xs="auto">
              <Form.Select size="sm" style={{ width: 110 }} value={fbMode} onChange={e => setFbMode(e.target.value as 'include' | 'exclude')}>
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
              </Form.Select>
            </Col>
            <Col xs={12} sm={4} md={3} lg={2}>
              <Form.Select size="sm" value={fbBase} onChange={e => { setFbBase(e.target.value); setFbValue('') }}>
                {FILTER_FIELDS.map(d => <option key={d.base} value={d.base}>{d.label}</option>)}
              </Form.Select>
            </Col>
            <Col xs={12} sm={5} md={3} lg={3}>
              <Form.Select size="sm" value={fbValue} onChange={e => setFbValue(e.target.value)}>
                <option value="">— select value —</option>
                {fbValueOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Form.Select>
            </Col>
            <Col xs="auto">
              <Button size="sm" variant={fbMode === 'include' ? 'outline-primary' : 'outline-danger'} onClick={addFilter} disabled={!fbValue}>
                <i className="bi bi-plus me-1" />Add
              </Button>
            </Col>
            <Col xs="auto" className="ms-auto">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <i className="bi bi-list-task me-1" />{tasks.length} task{tasks.length !== 1 ? 's' : ''} listed
              </span>
            </Col>
          </Row>

          {/* Active include/exclude chips */}
          {activeBuilderChips.length > 0 && (
            <div className="d-flex flex-wrap gap-1 mt-2">
              {activeBuilderChips.map(c => (
                <span
                  key={`${c.key}-${c.val}`}
                  className="badge d-inline-flex align-items-center gap-1"
                  style={c.mode === 'include'
                    ? { background: '#fff', color: '#1a7f4b', border: '1px solid #a8d8bf', fontWeight: 600, fontSize: '0.72rem' }
                    : { background: '#fff', color: '#c0392b', border: '1px solid #f1b0b0', fontWeight: 600, fontSize: '0.72rem' }}
                >
                  {c.mode === 'include' ? '=' : '≠'} {fbFieldLabel(c.base)}: {fbValueLabel(c.base, c.val)}
                  <i className="bi bi-x" style={{ cursor: 'pointer' }} onClick={() => removeFilter(c.key, c.val)} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {loading
        ? <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
        : (
          <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
            <Table className="pd-table mb-0" hover responsive>
              <thead>
                <tr>
                  {isLead && (
                    <th style={{ width: 36 }} className="ps-2" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                        checked={tasks.length > 0 && tasks.every(t => selectedIds.has(t.id))}
                        onChange={e => {
                          if (e.target.checked) setSelectedIds(new Set(tasks.map(t => t.id)))
                          else setSelectedIds(new Set())
                        }}
                      />
                    </th>
                  )}
                  <th className="ps-2" style={{ width: 50 }}>P#</th>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Title</th>
                  <th style={{ width: 90 }}>Type</th>
                  <th style={{ width: 150 }}>Assignee</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 120 }}>Progress</th>
                  <th style={{ width: 145 }}>Due Date</th>
                  <th>Labels</th>
                  <th style={{ width: 120 }}>Release</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr
                    key={task.id}
                    className={task.color === 'red' ? 'row-overdue' : task.color === 'orange' ? 'row-due-soon' : ''}
                    onClick={() => openDetail(task)}
                  >
                    {/* Checkbox — feature 6 */}
                    {isLead && (
                      <td className="ps-2" style={{ width: 36 }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                          checked={selectedIds.has(task.id)}
                          onChange={e => {
                            const next = new Set(selectedIds)
                            if (e.target.checked) next.add(task.id)
                            else next.delete(task.id)
                            setSelectedIds(next)
                          }}
                        />
                      </td>
                    )}
                    {/* Priority — inline editable */}
                    <td className="ps-2" style={{ position: 'relative' }}
                      onClick={e => { if (isLead) { e.stopPropagation(); openInline(task.id, 'priority', task.priority ?? 1) } }}
                    >
                      {inlineEdit?.taskId === task.id && inlineEdit?.field === ('priority') ? (
                        <div ref={inlineRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', zIndex: 100, background: 'var(--bs-body-bg, #fff)', border: '1px solid var(--card-border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 6px', top: 0, left: 0, width: 70 }}>
                          <Form.Control
                            type="number"
                            size="sm"
                            autoFocus
                            min={1}
                            value={inlineValue ?? task.priority ?? 1}
                            onChange={e => { setInlineValue(Number(e.target.value)); inlineValueRef.current = Number(e.target.value) }}
                            onKeyDown={async e => {
                              if (e.key === 'Escape') { closeInline(); return }
                              if (e.key === 'Enter') {
                                const val = inlineValue ?? task.priority
                                closeInline()
                                await quickUpdate(task.id, { priority: Number(val), assignee_id: task.assignee?.id })
                              }
                            }}
                            style={{ width: 58, textAlign: 'center', padding: '2px 4px' }}
                          />
                        </div>
                      ) : (
                        <PriorityDot p={task.priority} />
                      )}
                    </td>
                    <td>
                      {task.portal_task_id
                        ? (portalUrl
                            ? <a href={`${portalUrl}/view.php?id=${task.portal_task_id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                <Badge bg="secondary" className="fw-normal" style={{ cursor: 'pointer' }}>#{task.portal_task_id}</Badge>
                              </a>
                            : <Badge bg="secondary" className="fw-normal">#{task.portal_task_id}</Badge>)
                        : <span className="text-muted">—</span>}
                    </td>
                    {/* Title — inline editable for feature tasks only */}
                    <td className="fw-medium text-primary" style={{ position: 'relative', cursor: 'pointer' }}
                      onClick={e => {
                        if (task.task_type === 'feature') {
                          e.stopPropagation()
                          openInline(task.id, 'title', task.title)
                        }
                      }}
                    >
                      {inlineEdit?.taskId === task.id && inlineEdit?.field === ('title') ? (
                        <div ref={inlineRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', zIndex: 100, top: 0, left: 0, right: 0 }}>
                          <Form.Control
                            size="sm"
                            autoFocus
                            value={inlineValue ?? task.title}
                            onChange={e => { setInlineValue(e.target.value); inlineValueRef.current = e.target.value }}
                            onKeyDown={async e => {
                              if (e.key === 'Escape') { closeInline(); return }
                              if (e.key === 'Enter') {
                                const val = inlineValue?.trim() || task.title
                                closeInline()
                                await quickUpdate(task.id, { title: val })
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            {task.title}
                            {task.checklist_total > 0 && (
                              <span
                                className="badge ms-2"
                                style={{ background: '#eef0f8', color: '#6b6f8a', fontWeight: 600, fontSize: '0.68rem' }}
                                title="Checklist progress"
                              >
                                <i className="bi bi-check2-square me-1" />{task.checklist_done}/{task.checklist_total}
                              </span>
                            )}
                          </div>
                          {/* Feature 2: task age */}
                          {(task.status as string) !== 'SID12' && (task.status as string) !== 'SID13' && task.created_at && (() => {
                            const ageDays = Math.floor((Date.now() - new Date(task.created_at).getTime()) / 86400000)
                            return ageDays > 0 ? (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                {ageDays}d old
                              </div>
                            ) : null
                          })()}
                        </>
                      )}
                    </td>
                    <td>
                      <Badge bg={task.task_type === 'bug' ? 'danger' : 'info'} className="fw-normal">
                        {task.task_type === 'bug' ? '🐛 Bug' : '✨ Feature'}
                      </Badge>
                    </td>
                    {/* Assignee — inline editable */}
                    <td
                      style={{ position: 'relative' }}
                      onClick={e => { if (isLead) { e.stopPropagation(); openInline(task.id, 'assignee', task.assignee?.id ?? '') } }}
                    >
                      {inlineEdit?.taskId === task.id && inlineEdit?.field === 'assignee' ? (
                        <div ref={inlineRef} style={{ position: 'absolute', zIndex: 100, background: 'var(--bs-body-bg, #fff)', border: '1px solid var(--card-border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 8, minWidth: 160, top: 0, left: 0 }}>
                          <Form.Select
                            size="sm"
                            autoFocus
                            className="inline-edit-select"
                            defaultValue={task.assignee?.id ?? ''}
                            onChange={async e => {
                              const val = e.target.value
                              closeInline()
                              await quickUpdate(task.id, { assignee_id: val ? Number(val) : undefined })
                            }}
                            onBlur={() => setTimeout(closeInline, 150)}
                            onKeyDown={e => { if (e.key === 'Escape') closeInline() }}
                          >
                            <option value="">Unassigned</option>
                            {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                          </Form.Select>
                        </div>
                      ) : (
                        <span className="inline-editable-cell">
                          <span>
                            {task.assignee
                              ? <>{task.assignee.name} <Badge bg={ROLE_VARIANT[task.assignee.role] ?? 'secondary'} className="fw-normal" style={{ fontSize: '0.65rem' }}>{task.assignee.role}</Badge></>
                              : <span className="text-muted fst-italic">Unassigned</span>}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Status — inline editable */}
                    <td
                      style={{ position: 'relative' }}
                      onClick={e => { if (isLead) { e.stopPropagation(); openInline(task.id, 'status', task.status) } }}
                    >
                      {inlineEdit?.taskId === task.id && inlineEdit?.field === 'status' ? (
                        <div ref={inlineRef} style={{ position: 'absolute', zIndex: 100, background: 'var(--bs-body-bg, #fff)', border: '1px solid var(--card-border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 8, minWidth: 180, top: 0, left: 0 }}>
                          {confirmCloseTaskId === task.id ? (
                            <div style={{ padding: '4px 2px' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
                                <i className="bi bi-lock me-1 text-warning" />Close this task?
                              </div>
                              <div className="d-flex gap-2">
                                <Button size="sm" variant="warning" style={{ fontSize: '0.75rem', padding: '2px 10px' }}
                                  onClick={async () => {
                                    const st = confirmCloseStatus
                                    setConfirmCloseTaskId(null)
                                    setConfirmCloseStatus('')
                                    closeInline()
                                    await quickUpdate(task.id, { status: st })
                                  }}>
                                  Yes
                                </Button>
                                <Button size="sm" variant="outline-secondary" style={{ fontSize: '0.75rem', padding: '2px 10px' }}
                                  onClick={() => { setConfirmCloseTaskId(null); setConfirmCloseStatus(''); closeInline() }}>
                                  No
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Form.Select
                              size="sm"
                              autoFocus
                              className="inline-edit-select"
                              defaultValue={task.status}
                              onChange={async e => {
                                const val = e.target.value
                                if (val === 'SID12' || val === 'SID13') {
                                  setConfirmCloseTaskId(task.id)
                                  setConfirmCloseStatus(val)
                                } else {
                                  closeInline()
                                  await quickUpdate(task.id, { status: val })
                                }
                              }}
                              onBlur={() => setTimeout(() => { if (confirmCloseTaskId !== task.id) closeInline() }, 150)}
                              onKeyDown={e => { if (e.key === 'Escape') { setConfirmCloseTaskId(null); setConfirmCloseStatus(''); closeInline() } }}
                            >
                              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </Form.Select>
                          )}
                        </div>
                      ) : (
                        <span className="inline-editable-cell">
                          <span
                            className="badge"
                            style={{
                              background: `${STATUS_COLOR_HEX[task.status] ?? '#adb5bd'}22`,
                              color: STATUS_COLOR_HEX[task.status] ?? '#adb5bd',
                              border: `1px solid ${STATUS_COLOR_HEX[task.status] ?? '#adb5bd'}44`,
                            }}
                          >
                            {STATUS_LABEL[task.status]}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Progress — inline editable */}
                    <td
                      style={{ position: 'relative' }}
                      onClick={e => { if (isLead) { e.stopPropagation(); openInline(task.id, 'progress', task.progress) } }}
                    >
                      {inlineEdit?.taskId === task.id && inlineEdit?.field === 'progress' ? (
                        <div ref={inlineRef} style={{ position: 'absolute', zIndex: 100, background: 'var(--bs-body-bg, #fff)', border: '1px solid var(--card-border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 8, minWidth: 110, top: 0, left: 0 }}>
                          <Form.Select
                            size="sm"
                            autoFocus
                            className="inline-edit-select"
                            defaultValue={task.progress}
                            onChange={async e => { const val = Number(e.target.value); closeInline(); await quickUpdate(task.id, { progress: val }) }}
                            onBlur={() => setTimeout(closeInline, 150)}
                            onKeyDown={e => { if (e.key === 'Escape') closeInline() }}
                          >
                            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => <option key={p} value={p}>{p}%</option>)}
                          </Form.Select>
                        </div>
                      ) : (
                        <span className="inline-editable-cell">
                          <span className="d-flex align-items-center gap-2" style={{ minWidth: 90 }}>
                            <span className="progress flex-grow-1" style={{ height: 6 }}>
                              <span className="progress-bar d-block" style={{ height: '100%', width: `${task.progress}%`, background: task.progress === 100 ? '#1cc88a' : '#4e73df' }} />
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{task.progress}%</span>
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Due Date — inline editable */}
                    <td
                      style={{ position: 'relative' }}
                      onClick={e => { if (isLead) { e.stopPropagation(); openInline(task.id, 'due_date', task.end_date ?? '') } }}
                    >
                      {inlineEdit?.taskId === task.id && inlineEdit?.field === 'due_date' ? (
                        <div ref={inlineRef} style={{ position: 'absolute', zIndex: 100, background: 'var(--bs-body-bg, #fff)', border: '1px solid var(--card-border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 8, minWidth: 160, top: 0, left: 0 }}>
                          <Form.Control
                            type="date"
                            size="sm"
                            autoFocus
                            value={inlineValue ?? task.end_date ?? ''}
                            onChange={e => { setInlineValue(e.target.value); inlineValueRef.current = e.target.value }}
                            onKeyDown={async e => {
                              if (e.key === 'Escape') { closeInline(); return }
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value
                                closeInline()
                                await quickUpdate(task.id, { end_date: val || undefined })
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <span className="inline-editable-cell">
                          <span style={{ color: task.color === 'red' && task.end_date ? '#dc3545' : undefined, whiteSpace: 'nowrap' }}>
                            {task.end_date ? dayjs(task.end_date).format('DD MMM YYYY') : '—'}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Labels — inline editable */}
                    <td
                      style={{ position: 'relative' }}
                      onClick={e => { if (isLead) { e.stopPropagation(); openInline(task.id, 'labels', task.labels.map(l => l.id)) } }}
                    >
                      {inlineEdit?.taskId === task.id && inlineEdit?.field === 'labels' ? (
                        <div ref={inlineRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', display: 'inline-block', zIndex: 100, background: 'var(--bs-body-bg, #fff)', border: '1px solid var(--card-border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '6px 8px', top: 0, left: 0 }}>
                          <div style={{ maxHeight: 180, overflowY: 'auto', whiteSpace: 'nowrap' }}>
                            {labels.map(l => {
                              const checked = (inlineValue as number[] ?? []).includes(l.id)
                              return (
                                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => {
                                    const current: number[] = inlineValue ?? []
                                    const next = checked ? current.filter(x => x !== l.id) : [...current, l.id]
                                    setInlineValue(next)
                                    inlineValueRef.current = next
                                  }}
                                >
                                  <input type="checkbox" readOnly checked={checked} style={{ accentColor: l.color }} />
                                  <span className="badge" style={{ background: l.color, fontSize: '0.7rem' }}>{l.name}</span>
                                </div>
                              )
                            })}
                            {labels.length === 0 && <small className="text-muted">No labels.</small>}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-editable-cell">
                          <span>
                            {task.labels.map(l => (
                              <span
                                key={l.id}
                                className="badge me-1"
                                style={{ background: l.color, fontSize: '0.7rem', fontWeight: 500 }}
                              >
                                {l.name}
                              </span>
                            ))}
                            {task.labels.length === 0 && <span className="text-muted fst-italic" style={{ fontSize: '0.8rem' }}>—</span>}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Release — inline editable */}
                    <td
                      style={{ position: 'relative' }}
                      onClick={e => { if (isLead) { e.stopPropagation(); openInline(task.id, 'release', task.release_id ?? '') } }}
                    >
                      {inlineEdit?.taskId === task.id && inlineEdit?.field === 'release' ? (
                        <div ref={inlineRef} style={{ position: 'absolute', zIndex: 100, background: 'var(--bs-body-bg, #fff)', border: '1px solid var(--card-border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 8, minWidth: 160, top: 0, left: 0 }}>
                          <Form.Select
                            size="sm"
                            autoFocus
                            className="inline-edit-select"
                            defaultValue={task.release_id ?? ''}
                            onChange={async e => { const val = e.target.value; closeInline(); await quickUpdate(task.id, { release_id: val ? Number(val) : null }) }}
                            onBlur={() => setTimeout(closeInline, 150)}
                            onKeyDown={e => { if (e.key === 'Escape') closeInline() }}
                          >
                            <option value="">— No Release —</option>
                            {releases.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </Form.Select>
                        </div>
                      ) : (
                        <span className="inline-editable-cell">
                          {(() => {
                            const rel = releases.find(r => r.id === task.release_id)
                            return rel
                              ? <span className="badge" style={{ background: '#eef0f8', color: '#4e73df', fontWeight: 600, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{rel.name}</span>
                              : <span className="text-muted fst-italic" style={{ fontSize: '0.8rem' }}>—</span>
                          })()}
                        </span>
                      )}
                    </td>

                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      {isLead && (
                        <>
                          <Button variant="outline-secondary" size="sm" className="me-1"
                            style={{ padding: '1px 6px', lineHeight: 1 }}
                            onClick={() => openEdit(task)}>
                            <i className="bi bi-pencil" style={{ fontSize: '0.75rem' }} />
                          </Button>
                          <Button variant="outline-danger" size="sm"
                            style={{ padding: '1px 6px', lineHeight: 1 }}
                            onClick={() => setDeleteConfirmId(task.id)}>
                            <i className="bi bi-trash" style={{ fontSize: '0.75rem' }} />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center text-muted py-5">
                      <i className="bi bi-inbox fs-2 d-block mb-2" />
                      No tasks found. Click <strong>New Task</strong> to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        )}

      {/* ── Task Create / Edit Modal ──────────────────────────────────── */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title className="fs-6 fw-bold">
            <i className={`bi ${editingTask ? 'bi-pencil-square' : 'bi-plus-circle'} me-2 text-primary`} />
            {editingTask ? 'Edit Task' : 'New Task'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={5}>
              <Form.Label className="small fw-semibold">Task Type</Form.Label>
              <Form.Select size="sm" value={form.task_type ?? 'feature'} onChange={e => setField('task_type', e.target.value)}>
                <option value="bug">🐛 Bug (from portal)</option>
                <option value="feature">✨ Feature (manual)</option>
              </Form.Select>
            </Col>
            <Col md={7}>
              <Form.Label className="small fw-semibold">Portal Task ID</Form.Label>
              <InputGroup size="sm">
                <Form.Control
                  placeholder="e.g. 1042"
                  value={form.portal_task_id ?? ''}
                  onChange={e => setField('portal_task_id', e.target.value)}
                />
                <Button variant="outline-primary" onClick={handleMantisLookup} disabled={mantisLoading}>
                  {mantisLoading
                    ? <Spinner animation="border" size="sm" />
                    : <><i className="bi bi-link-45deg me-1" />Fetch from Portal</>}
                </Button>
              </InputGroup>
              {mantisError && <div className="text-danger small mt-1">{mantisError}</div>}
            </Col>

            <Col xs={12}>
              <Form.Label className="small fw-semibold">Title <span className="text-danger">*</span></Form.Label>
              <Form.Control size="sm" placeholder="Task title" value={form.title ?? ''} onChange={e => setField('title', e.target.value)} />
            </Col>

            <Col xs={12}>
              <Form.Label className="small fw-semibold">Description</Form.Label>
              <Form.Control as="textarea" rows={3} size="sm" placeholder="Task description" value={form.description ?? ''} onChange={e => setField('description', e.target.value)} />
            </Col>

            <Col md={6}>
              <Form.Label className="small fw-semibold">Assign To</Form.Label>
              <Form.Select size="sm" value={form.assignee_id ?? ''} onChange={e => setField('assignee_id', e.target.value)}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label className="small fw-semibold">
                Priority <span className="text-muted fw-normal">(optional)</span>
              </Form.Label>
              {(() => {
                const memberTasks = tasks.filter(t =>
                  t.assignee_id === Number(form.assignee_id) &&
                  t.id !== editingTask?.id &&
                  t.priority != null
                )
                const maxP = memberTasks.length + 1
                return (
                  <>
                    <Form.Control
                      size="sm" type="number" min={1} max={maxP}
                      placeholder={form.assignee_id ? `1 – ${maxP} (blank = last)` : '1 = highest'}
                      value={form.priority ?? ''}
                      onChange={e => setField('priority', e.target.value)}
                      isInvalid={!!form.assignee_id && form.priority !== '' && form.priority !== undefined && (Number(form.priority) < 1 || Number(form.priority) > maxP)}
                    />
                    {form.assignee_id && (
                      <Form.Text className="text-muted">
                        Valid range: 1 – {maxP}. Leave blank to add at the end (position {maxP}); out-of-range values are auto-clamped.
                      </Form.Text>
                    )}
                  </>
                )
              })()}
            </Col>

            <Col md={6}>
              <Form.Label className="small fw-semibold">Start Date</Form.Label>
              <Form.Control size="sm" type="date" value={form.start_date ?? ''} onChange={e => setField('start_date', e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label className="small fw-semibold">End Date</Form.Label>
              <Form.Control size="sm" type="date" value={form.end_date ?? ''} onChange={e => setField('end_date', e.target.value)} />
            </Col>

            <Col md={6}>
              <Form.Label className="small fw-semibold">Status</Form.Label>
              <Form.Select size="sm" value={form.status ?? 'SID00'} onChange={e => setField('status', e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label className="small fw-semibold">Progress</Form.Label>
              <Form.Select
                size="sm"
                value={form.progress ?? 0}
                onChange={e => {
                  const p = Number(e.target.value)
                  setForm(f => ({ ...f, progress: p, ...(p === 100 ? { status: 'SID12' } : {}) }))
                }}
              >
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => <option key={p} value={p}>{p}%</option>)}
              </Form.Select>
              {Number(form.progress) === 100 && (
                <Form.Text className="text-muted">100% auto-sets status to Closed.</Form.Text>
              )}
            </Col>

            <Col md={6}>
              <Form.Label className="small fw-semibold">Release</Form.Label>
              <Form.Select size="sm" value={form.release_id ?? ''} onChange={e => setField('release_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">— No Release —</option>
                {releases.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.release_date}){r.status === 'active' ? ' ★' : ''}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label className="small fw-semibold">Labels</Form.Label>
              <div className="d-flex flex-wrap gap-1 mt-1">
                {labels.map(l => {
                  const selected = (form.label_ids ?? []).includes(l.id)
                  return (
                    <span
                      key={l.id}
                      onClick={() => toggleLabel(l.id)}
                      className="badge"
                      style={{
                        background: selected ? l.color : '#e9ecef',
                        color: selected ? '#fff' : '#495057',
                        cursor: 'pointer',
                        padding: '5px 10px',
                        fontSize: '0.78rem',
                        border: `1px solid ${l.color}`,
                      }}
                    >
                      {l.name}
                    </span>
                  )
                })}
                {labels.length === 0 && <small className="text-muted">Create labels in Settings first.</small>}
              </div>
            </Col>

            {/* ── Checklist ── */}
            <Col xs={12}>
              <hr className="my-1" />
              <Form.Label className="small fw-semibold d-flex align-items-center gap-2">
                <i className="bi bi-check2-square text-primary" />
                Checklist
                {((form.checklist ?? []) as ChecklistRow[]).length > 0 && (
                  <span className="text-muted fw-normal">
                    ({((form.checklist ?? []) as ChecklistRow[]).filter(i => i.done).length}/{((form.checklist ?? []) as ChecklistRow[]).length})
                  </span>
                )}
              </Form.Label>

              {((form.checklist ?? []) as ChecklistRow[]).map(item => (
                <div
                  key={item.key}
                  className="d-flex align-items-center gap-2 mb-1"
                  onDragOver={e => { if (clDragKey) { e.preventDefault(); setClOverKey(item.key) } }}
                  onDragLeave={() => setClOverKey(k => (k === item.key ? null : k))}
                  onDrop={e => { e.preventDefault(); if (clDragKey) reorderChecklist(clDragKey, item.key); setClDragKey(null); setClOverKey(null) }}
                  style={{
                    borderTop: clOverKey === item.key && clDragKey !== item.key ? '2px solid var(--primary)' : '2px solid transparent',
                    opacity: clDragKey === item.key ? 0.4 : 1,
                  }}
                >
                  <i
                    className="bi bi-grip-vertical"
                    draggable
                    onDragStart={e => { setClDragKey(item.key); e.dataTransfer.effectAllowed = 'move' }}
                    onDragEnd={() => { setClDragKey(null); setClOverKey(null) }}
                    title="Drag to reorder"
                    style={{ cursor: 'grab', color: '#c8cbd8', flexShrink: 0 }}
                  />
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleChecklistDone(item.key)}
                    style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0, accentColor: '#1cc88a' }}
                  />
                  <Form.Control
                    size="sm"
                    value={item.text}
                    onChange={e => editChecklistText(item.key, e.target.value)}
                    placeholder="Checklist item"
                    style={{ textDecoration: item.done ? 'line-through' : 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ padding: '1px 6px', color: '#dee2e6', lineHeight: 1 }}
                    onClick={() => deleteChecklistItem(item.key)}
                  >
                    <i className="bi bi-x" />
                  </button>
                </div>
              ))}

              <div className="d-flex gap-2 mt-1">
                <Form.Control
                  size="sm"
                  placeholder="Add checklist item..."
                  value={clText}
                  onChange={e => setClText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                />
                <Button size="sm" variant="outline-primary" onClick={addChecklistItem} style={{ flexShrink: 0 }}>
                  <i className="bi bi-plus" />
                </Button>
              </div>
              <div className="d-flex align-items-center justify-content-between mt-1">
                <Form.Text className="text-muted mt-0">
                  Drag <i className="bi bi-grip-vertical" /> to reorder. Saved with the task.
                </Form.Text>
                <label className="btn btn-sm btn-link p-0" style={{ fontSize: '0.75rem', textDecoration: 'none' }} title="Each non-empty line becomes a checklist item">
                  <i className="bi bi-upload me-1" />Import from .txt file
                  <input type="file" accept=".txt,text/plain" hidden onChange={importChecklistFile} />
                </label>
              </div>
            </Col>

            {/* ── Relations ── */}
            <Col xs={12}>
              <hr className="my-1" />
              <Form.Label className="small fw-semibold d-flex align-items-center gap-2">
                <i className="bi bi-diagram-2 text-primary" />
                Task Relations
              </Form.Label>

              {/* Existing relations */}
              {relations.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {relations.map(r => (
                    <div
                      key={r.id}
                      className="d-flex align-items-center gap-1 rounded-pill px-2 py-1"
                      style={{
                        background: `${RELATION_COLOR[r.relation_type as RelationType]}18`,
                        border: `1px solid ${RELATION_COLOR[r.relation_type as RelationType]}55`,
                        fontSize: '0.78rem',
                      }}
                    >
                      <span style={{ color: RELATION_COLOR[r.relation_type as RelationType], fontWeight: 700 }}>
                        {RELATION_LABEL[r.relation_type as RelationType]}
                      </span>
                      <span className="text-dark fw-semibold">
                        {r.related_task_portal_id ? `#${r.related_task_portal_id} ` : ''}
                        {r.related_task_title}
                      </span>
                      {editingTask && (
                        <button
                          type="button"
                          className="btn-close ms-1"
                          style={{ fontSize: '0.5rem' }}
                          onClick={async () => {
                            await deleteRelation(editingTask.id, r.id)
                            setRelations(prev => prev.filter(x => x.id !== r.id))
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add relation row — only for existing tasks */}
              {editingTask ? (
                <div className="d-flex gap-2 align-items-start flex-wrap">
                  <Form.Select
                    size="sm"
                    style={{ width: 160 }}
                    value={relType}
                    onChange={e => { setRelType(e.target.value as RelationType); setRelError('') }}
                  >
                    {(Object.keys(RELATION_LABEL) as RelationType[]).map(k => (
                      <option key={k} value={k}>{RELATION_LABEL[k]}</option>
                    ))}
                  </Form.Select>
                  <Form.Select
                    size="sm"
                    style={{ width: 240 }}
                    value={relTaskId}
                    onChange={e => { setRelTaskId(e.target.value); setRelError('') }}
                  >
                    <option value="">— select task —</option>
                    {allTasks
                      .filter(t => t.id !== editingTask.id)
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.portal_task_id ? `#${t.portal_task_id} ` : ''}{t.title}
                        </option>
                      ))}
                  </Form.Select>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    disabled={!relTaskId || relSaving}
                    onClick={async () => {
                      if (!relTaskId) return
                      setRelSaving(true)
                      setRelError('')
                      try {
                        const newRel = await addRelation(editingTask.id, Number(relTaskId), relType)
                        setRelations(prev => [...prev, newRel])
                        setRelTaskId('')
                      } catch (e: any) {
                        setRelError(e?.response?.data?.detail ?? 'Failed to add relation.')
                      } finally {
                        setRelSaving(false)
                      }
                    }}
                  >
                    {relSaving ? <Spinner animation="border" size="sm" /> : <><i className="bi bi-plus me-1" />Add</>}
                  </Button>
                  {relError && <div className="text-danger small w-100 mt-1">{relError}</div>}
                </div>
              ) : (
                <small className="text-muted">Save the task first, then add relations by editing it.</small>
              )}
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="light" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleTaskSubmit} disabled={taskSaving || !form.title?.trim()}>
            {taskSaving ? <Spinner animation="border" size="sm" className="me-1" /> : null}
            {editingTask ? 'Save Changes' : 'Create Task'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Delete Confirm Modal ──────────────────────────────────────── */}
      <Modal show={deleteConfirmId !== null} onHide={() => setDeleteConfirmId(null)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">Delete Task?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-0">This will permanently remove the task and all its comments and attachments.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
            <i className="bi bi-trash me-1" />Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Task Detail Offcanvas ─────────────────────────────────────── */}
      <Offcanvas show={showDetail} onHide={() => setShowDetail(false)} placement="end" style={{ width: 560 }}>
        <Offcanvas.Header closeButton className="border-bottom">
          <Offcanvas.Title className="fs-6 fw-bold">
            {selectedTask && (
              <span className="d-flex align-items-center gap-2">
                <span
                  className="color-dot"
                  style={{ background: COLOR_HEX[selectedTask.color], width: 12, height: 12 }}
                />
                {selectedTask.title}
              </span>
            )}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {detailLoading && (
            <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
          )}
          {selectedTask && !detailLoading && (
            <>
              {/* Action buttons */}
              {isLead && (
                <div className="d-flex gap-2 mb-3">
                  <Button variant="outline-primary" size="sm" onClick={() => { setShowDetail(false); openEdit(selectedTask) }}>
                    <i className="bi bi-pencil me-1" />Edit
                  </Button>
                  <Button variant="outline-danger" size="sm" onClick={() => setDeleteConfirmId(selectedTask.id)}>
                    <i className="bi bi-trash me-1" />Delete
                  </Button>
                </div>
              )}

              {/* Meta */}
              <div className="card border-0 bg-light rounded-3 p-3 mb-3">
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Type</span>
                  <Badge bg={selectedTask.task_type === 'bug' ? 'danger' : 'info'} className="fw-normal">
                    {selectedTask.task_type === 'bug' ? '🐛 Bug' : '✨ Feature'}
                  </Badge>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Status</span>
                  <span
                    className="badge"
                    style={{
                      background: `${STATUS_COLOR_HEX[selectedTask.status] ?? '#adb5bd'}22`,
                      color: STATUS_COLOR_HEX[selectedTask.status] ?? '#adb5bd',
                      border: `1px solid ${STATUS_COLOR_HEX[selectedTask.status] ?? '#adb5bd'}44`,
                    }}
                  >
                    {selectedTask.status} – {STATUS_LABEL[selectedTask.status]}
                  </span>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Progress</span>
                  <span className="d-flex align-items-center gap-2">
                    <span className="progress" style={{ height: 6, width: 90 }}>
                      <span className="progress-bar d-block" style={{ height: '100%', width: `${selectedTask.progress}%`, background: selectedTask.progress === 100 ? '#1cc88a' : '#4e73df' }} />
                    </span>
                    <span style={{ fontWeight: 600 }}>{selectedTask.progress}%</span>
                  </span>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Priority</span>
                  <PriorityDot p={selectedTask.priority} />
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Assignee</span>
                  <span>{selectedTask.assignee?.name ?? <em className="text-muted">Unassigned</em>}</span>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Start Date</span>
                  <span>{selectedTask.start_date ? dayjs(selectedTask.start_date).format('DD MMM YYYY') : '—'}</span>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">End Date</span>
                  <span style={{ color: selectedTask.color === 'red' ? '#dc3545' : undefined }}>
                    {selectedTask.end_date ? dayjs(selectedTask.end_date).format('DD MMM YYYY') : '—'}
                  </span>
                </div>
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Release</span>
                  <span>{releases.find(r => r.id === selectedTask.release_id)?.name ?? <em className="text-muted">—</em>}</span>
                </div>
                {selectedTask.portal_task_id && (
                  <div className="detail-meta-row">
                    <span className="detail-meta-label">Portal ID</span>
                    {portalUrl
                      ? <a href={`${portalUrl}/view.php?id=${selectedTask.portal_task_id}`} target="_blank" rel="noreferrer">
                          <Badge bg="secondary" className="fw-normal" style={{ cursor: 'pointer' }}>
                            #{selectedTask.portal_task_id} <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: '0.7rem' }} />
                          </Badge>
                        </a>
                      : <Badge bg="secondary" className="fw-normal">#{selectedTask.portal_task_id}</Badge>}
                  </div>
                )}
              </div>

              {/* Labels */}
              {selectedTask.labels.length > 0 && (
                <div className="mb-3">
                  {selectedTask.labels.map(l => (
                    <span key={l.id} className="badge me-1" style={{ background: l.color }}>{l.name}</span>
                  ))}
                </div>
              )}

              {/* Description */}
              {selectedTask.description && (
                <div className="card border-0 bg-light rounded-3 p-3 mb-3">
                  <small className="text-muted fw-semibold mb-1 d-block">DESCRIPTION</small>
                  <p className="mb-0 small">{selectedTask.description}</p>
                </div>
              )}

              {/* Checklist */}
              <div className="mb-3">
                  <div className="mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-check2-square text-primary" />
                    <span className="fw-semibold small">Checklist</span>
                    {selectedTask.checklist.length > 0 && (
                      <span className="text-muted small">
                        ({selectedTask.checklist.filter(c => c.done).length}/{selectedTask.checklist.length})
                      </span>
                    )}
                  </div>
                  {selectedTask.checklist.map(item => (
                    <div key={item.id} className="d-flex align-items-center gap-2 py-1" style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleDetailChecklist(item)}
                        style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0, accentColor: '#1cc88a' }}
                      />
                      <span style={{ flex: 1, fontSize: '0.875rem', color: item.done ? 'var(--text-muted)' : 'var(--text-dark)', textDecoration: item.done ? 'line-through' : 'none' }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                  <div className="d-flex gap-2 mt-2">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Add checklist item..."
                      value={detailClText}
                      onChange={e => setDetailClText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDetailChecklistItem() } }}
                    />
                    <button className="btn btn-sm btn-outline-primary" onClick={addDetailChecklistItem} disabled={!detailClText.trim()}>
                      <i className="bi bi-plus-lg" />
                    </button>
                    <label className="btn btn-sm btn-outline-secondary" title="Import items from .txt file (one per line)">
                      <i className="bi bi-file-earmark-text" />
                      <input type="file" accept=".txt" hidden onChange={async e => {
                        if (!selectedTask) return
                        const file = e.target.files?.[0]; if (!file) return
                        const text = await file.text()
                        const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
                        if (!lines.length) return
                        const updated = [
                          ...selectedTask.checklist.map(c => ({ id: c.id, text: c.text, done: c.done })),
                          ...lines.map(l => ({ text: l, done: false })),
                        ]
                        await updateTask(selectedTask.id, { checklist: updated })
                        const d = await getTask(selectedTask.id)
                        setSelectedTask(d); load()
                        e.target.value = ''
                      }} />
                    </label>
                  </div>
                </div>

              {/* Comments */}
              <div className="mb-1 d-flex align-items-center gap-2">
                <i className="bi bi-chat-left-text text-primary" />
                <span className="fw-semibold small">Progress / Comments</span>
              </div>
              <div className="comment-list mb-2">
                {selectedTask.comments.length === 0
                  ? <p className="text-muted small fst-italic">No comments yet.</p>
                  : selectedTask.comments.map(c => (
                    <div key={c.id} className="comment-item">
                      <div className="comment-header">
                        <span className="fw-semibold small">{c.author}</span>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {dayjs(c.created_at).format('DD MMM YYYY HH:mm')}
                        </span>
                      </div>
                      <p className="mb-0 small">{c.content}</p>
                    </div>
                  ))}
              </div>
              <Form.Control
                as="textarea"
                rows={2}
                size="sm"
                placeholder="Add a progress note..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                className="mb-2"
              />
              <Button
                variant="primary" size="sm"
                onClick={handleAddComment}
                disabled={!commentText.trim() || commentSaving}
              >
                {commentSaving ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="bi bi-send me-1" />}
                Add Note
              </Button>

              <hr className="my-3" />

              {/* Attachments */}
              <div className="mb-2 d-flex align-items-center gap-2">
                <i className="bi bi-paperclip text-primary" />
                <span className="fw-semibold small">Attachments</span>
              </div>
              {selectedTask.attachments.length === 0
                ? <p className="text-muted small fst-italic">No attachments.</p>
                : selectedTask.attachments.map(att => (
                  <div key={att.id} className="d-flex align-items-center justify-content-between mb-2 p-2 bg-light rounded">
                    <span className="small"><i className="bi bi-file-earmark me-1 text-muted" />{att.filename}</span>
                    <div className="d-flex gap-2">
                      <a href={downloadUrl(att.id)} download={att.filename} className="btn btn-sm btn-outline-secondary py-0">
                        <i className="bi bi-download" />
                      </a>
                      {isLead && (
                        <Button variant="outline-danger" size="sm" className="py-0"
                          onClick={() => handleDeleteAttachment(att.id)}>
                          <i className="bi bi-x" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

              <label className="btn btn-sm btn-outline-secondary mt-1">
                <i className="bi bi-upload me-1" />Attach File
                <input type="file" multiple hidden onChange={handleUpload} />
              </label>
            </>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  )
}
