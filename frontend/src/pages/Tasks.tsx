import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import {
  Table, Button, Badge, Modal, Form, Row, Col,
  Offcanvas, Spinner, Alert, InputGroup,
} from 'react-bootstrap'
import dayjs from 'dayjs'
import {
  getTasks, getTask, createTask, updateTask, deleteTask,
  getMembers, getLabels, addComment, uploadAttachment,
  deleteAttachment, downloadUrl, fetchMantisIssue, assignTask,
  getRelations, addRelation, deleteRelation, getReleases,
  getPortalStatus,
} from '../api/client'
import type { Task, TaskDetail, Member, Label, TaskFilters, TaskRelation, RelationType, Release } from '../types'

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
  const routeLocation = useLocation()
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({ sort_by: 'priority', sort_order: 'asc' })
  const [presetLabel, setPresetLabel] = useState<string | null>(null)

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

  // Relations state (for modal)
  const [relations, setRelations] = useState<TaskRelation[]>([])
  const [relType, setRelType] = useState<RelationType>('related_to')
  const [relTaskId, setRelTaskId] = useState<string>('')
  const [relError, setRelError] = useState('')
  const [relSaving, setRelSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getTasks(filters).then(setTasks).finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    getMembers().then(setMembers)
    getLabels().then(setLabels)
    getReleases().then(setReleases)
    getPortalStatus().then(c => { if (c.portal_url) setPortalUrl(c.portal_url) }).catch(() => {})
  }, [])

  // Handle navigation state: search result open OR dashboard preset filter
  useEffect(() => {
    const state = routeLocation.state as { openTaskId?: number; preset?: TaskFilters; presetLabel?: string } | null
    if (state?.openTaskId) {
      openDetail({ id: state.openTaskId } as Task)
      window.history.replaceState({}, '')
    }
    if (state?.preset !== undefined) {
      setFilters({ sort_by: 'priority', sort_order: 'asc', ...state.preset })
      setPresetLabel(state.presetLabel ?? null)
      window.history.replaceState({}, '')
    }
  }, [routeLocation.state])

  const openDetail = async (task: Task) => {
    setShowDetail(true)
    setDetailLoading(true)
    setSelectedTask(null)
    setCommentText('')
    const d = await getTask(task.id)
    setSelectedTask(d)
    setDetailLoading(false)
  }

  const openCreate = () => {
    setEditingTask(null)
    setForm({ task_type: 'feature', status: 'SID00', label_ids: [] })
    setMantisError('')
    setRelations([])
    setRelType('related_to')
    setRelTaskId('')
    setRelError('')
    setShowModal(true)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setForm({
      ...task,
      label_ids: task.labels.map(l => l.id),
      start_date: task.start_date ?? '',
      end_date: task.end_date ?? '',
      release_id: task.release_id ?? null,
    })
    setMantisError('')
    setRelType('related_to')
    setRelTaskId('')
    setRelError('')
    getRelations(task.id).then(setRelations).catch(() => setRelations([]))
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
    if (form.assignee_id && !form.priority) {
      setMantisError('Priority is required when a member is assigned.')
      return
    }
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
        assignee_id: form.assignee_id ? Number(form.assignee_id) : undefined,
        priority: form.priority ? Number(form.priority) : undefined,
        label_ids: form.label_ids ?? [],
        release_id: form.release_id ? Number(form.release_id) : null,
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

  const toggleLabel = (id: number) => {
    const ids: number[] = form.label_ids ?? []
    setField('label_ids', ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }

  const headerEl = document.getElementById('page-header-actions')

  return (
    <>
      {headerEl && createPortal(
        <Button variant="primary" size="sm" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" />New Task
        </Button>,
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
            onClick={() => { setPresetLabel(null); setFilters({ sort_by: 'priority', sort_order: 'asc' }) }}
          >
            <i className="bi bi-x me-1" />Clear filter
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card filter-card mb-3">
        <div className="card-body py-2">
          <Row className="g-2 align-items-center">
            <Col xs={12} sm={6} md={3} lg={2}>
              <Form.Select size="sm" onChange={e => setFilters(f => ({ ...f, assignee_id: e.target.value ? Number(e.target.value) : undefined }))}>
                <option value="">All Members</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Form.Select>
            </Col>
            <Col xs={12} sm={6} md={3} lg={2}>
              <Form.Select size="sm" onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}>
                <option value="">All Status</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{k} – {v}</option>)}
              </Form.Select>
            </Col>
            <Col xs={12} sm={6} md={2} lg={2}>
              <Form.Select size="sm" onChange={e => setFilters(f => ({ ...f, task_type: e.target.value || undefined }))}>
                <option value="">All Types</option>
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
              </Form.Select>
            </Col>
            <Col xs={12} sm={6} md={2} lg={2}>
              <Form.Select size="sm" onChange={e => setFilters(f => ({ ...f, label_ids: e.target.value ? [Number(e.target.value)] : undefined }))}>
                <option value="">All Labels</option>
                {labels.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} sm={6} md={2} lg={2}>
              <Form.Control size="sm" type="date" placeholder="Due by"
                onChange={e => setFilters(f => ({ ...f, end_date_to: e.target.value || undefined }))} />
            </Col>
            <Col xs="auto">
              <Form.Select size="sm" value={filters.sort_by} onChange={e => setFilters(f => ({ ...f, sort_by: e.target.value }))}>
                <option value="priority">Priority</option>
                <option value="title">Title</option>
                <option value="end_date">Due Date</option>
              </Form.Select>
            </Col>
            <Col xs="auto">
              <Button
                variant={filters.sort_order === 'asc' ? 'outline-primary' : 'primary'}
                size="sm"
                onClick={() => setFilters(f => ({ ...f, sort_order: f.sort_order === 'asc' ? 'desc' : 'asc' }))}
              >
                <i className={`bi bi-sort-${filters.sort_order === 'asc' ? 'up' : 'down'}`} />
              </Button>
            </Col>
          </Row>
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
                  <th className="ps-3" style={{ width: 50 }}>P#</th>
                  <th style={{ width: 12 }}></th>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Title</th>
                  <th style={{ width: 90 }}>Type</th>
                  <th style={{ width: 150 }}>Assignee</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 110 }}>Due Date</th>
                  <th>Labels</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr
                    key={task.id}
                    className={task.color === 'red' ? 'row-overdue' : ''}
                    onClick={() => openDetail(task)}
                  >
                    <td className="ps-3"><PriorityDot p={task.priority} /></td>
                    <td>
                      <span
                        className="color-dot"
                        style={{ background: COLOR_HEX[task.color] ?? '#adb5bd' }}
                        title={STATUS_LABEL[task.status]}
                      />
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
                    <td className="fw-medium text-primary" style={{ cursor: 'pointer' }}>{task.title}</td>
                    <td>
                      <Badge bg={task.task_type === 'bug' ? 'danger' : 'info'} className="fw-normal">
                        {task.task_type === 'bug' ? '🐛 Bug' : '✨ Feature'}
                      </Badge>
                    </td>
                    <td>
                      {task.assignee
                        ? <span>{task.assignee.name} <Badge bg={ROLE_VARIANT[task.assignee.role] ?? 'secondary'} className="fw-normal" style={{ fontSize: '0.65rem' }}>{task.assignee.role}</Badge></span>
                        : <span className="text-muted fst-italic">Unassigned</span>}
                    </td>
                    <td>
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
                    </td>
                    <td>
                      {task.end_date
                        ? <span style={{ color: task.color === 'red' ? '#dc3545' : undefined }}>
                            {dayjs(task.end_date).format('DD MMM YYYY')}
                          </span>
                        : '—'}
                    </td>
                    <td>
                      {task.labels.map(l => (
                        <span
                          key={l.id}
                          className="badge me-1"
                          style={{ background: l.color, fontSize: '0.7rem', fontWeight: 500 }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <Button variant="outline-secondary" size="sm" className="me-1 py-0"
                        onClick={() => openEdit(task)}>
                        <i className="bi bi-pencil" />
                      </Button>
                      <Button variant="outline-danger" size="sm" className="py-0"
                        onClick={() => setDeleteConfirmId(task.id)}>
                        <i className="bi bi-trash" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-muted py-5">
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
                Priority {form.assignee_id && <span className="text-danger">*</span>}
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
                      placeholder={form.assignee_id ? `1 – ${maxP}` : '1 = highest'}
                      value={form.priority ?? ''}
                      onChange={e => setField('priority', e.target.value)}
                      isInvalid={!!form.assignee_id && form.priority !== '' && form.priority !== undefined && (Number(form.priority) < 1 || Number(form.priority) > maxP)}
                    />
                    {form.assignee_id && (
                      <Form.Text className="text-muted">
                        Valid range: 1 – {maxP}. Will be auto-clamped if out of range.
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
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{k} – {v}</option>)}
              </Form.Select>
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
                    {tasks
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
              <div className="d-flex gap-2 mb-3">
                <Button variant="outline-primary" size="sm" onClick={() => { setShowDetail(false); openEdit(selectedTask) }}>
                  <i className="bi bi-pencil me-1" />Edit
                </Button>
                <Button variant="outline-danger" size="sm" onClick={() => setDeleteConfirmId(selectedTask.id)}>
                  <i className="bi bi-trash me-1" />Delete
                </Button>
              </div>

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
                      <Button variant="outline-danger" size="sm" className="py-0"
                        onClick={() => handleDeleteAttachment(att.id)}>
                        <i className="bi bi-x" />
                      </Button>
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
