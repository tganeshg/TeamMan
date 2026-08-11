import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Row, Col, Button, Modal, Form, Badge, Spinner } from 'react-bootstrap'
import dayjs from 'dayjs'
import {
  getTodoThreads, createTodoThread, updateTodoThread, deleteTodoThread,
  addTodoItem, updateTodoItem, deleteTodoItem,
  reorderTodoThreads, reorderTodoItems, bulkAddTodoItems,
} from '../api/client'
import type { TodoThread, TodoItem } from '../api/client'

const STATUS_COLOR: Record<string, string> = { open: '#4e73df', done: '#1cc88a' }

export default function Todo() {
  const [threads, setThreads] = useState<TodoThread[]>([])
  const [loading, setLoading] = useState(true)

  // Thread modal
  const [threadModal, setThreadModal] = useState(false)
  const [editing, setEditing] = useState<TodoThread | null>(null)
  const [form, setForm] = useState({ heading: '', description: '', meeting: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Item input per thread
  const [itemText, setItemText] = useState<Record<number, string>>({})

  // Thread drag-and-drop state
  const [dragThreadId, setDragThreadId] = useState<number | null>(null)
  const [overThreadId, setOverThreadId] = useState<number | null>(null)

  // Checklist-item drag-and-drop state (lifted to parent for cross-thread moves)
  const [dragItem, setDragItem] = useState<{ id: number; threadId: number } | null>(null)
  const [overItem, setOverItem] = useState<{ threadId: number; itemId: number } | null>(null)

  const load = () =>
    getTodoThreads().then(setThreads).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ heading: '', description: '', meeting: '' })
    setSaveError('')
    setThreadModal(true)
  }

  const openEdit = (t: TodoThread) => {
    setEditing(t)
    setForm({ heading: t.heading, description: t.description ?? '', meeting: t.meeting ?? '' })
    setSaveError('')
    setThreadModal(true)
  }

  const handleSaveThread = async () => {
    if (!form.heading.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const payload = { heading: form.heading.trim(), description: form.description || undefined, meeting: form.meeting || undefined }
      if (editing) {
        await updateTodoThread(editing.id, payload)
      } else {
        await createTodoThread(payload)
      }
      setThreadModal(false)
      load()
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail ?? 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (t: TodoThread) => {
    await updateTodoThread(t.id, { status: t.status === 'open' ? 'done' : 'open' })
    load()
  }

  const handleDeleteThread = async (id: number) => {
    if (!confirm('Delete this thread and all its items?')) return
    await deleteTodoThread(id)
    load()
  }

  const handleAddItem = async (threadId: number) => {
    const text = (itemText[threadId] ?? '').trim()
    if (!text) return
    await addTodoItem(threadId, text)
    setItemText(p => ({ ...p, [threadId]: '' }))
    load()
  }

  // Bulk-add checklist items (e.g. each line of an uploaded .txt file)
  const handleBulkAddItems = async (threadId: number, lines: string[]) => {
    if (!lines.length) return
    await bulkAddTodoItems(threadId, lines)
    load()
  }

  const handleToggleItem = async (item: TodoItem) => {
    await updateTodoItem(item.id, { done: !item.done })
    load()
  }

  const handleDeleteItem = async (itemId: number) => {
    await deleteTodoItem(itemId)
    load()
  }

  const handleEditItem = async (item: TodoItem, newText: string) => {
    await updateTodoItem(item.id, { text: newText })
    load()
  }

  // Reorder threads (TODO items) — optimistic update + auto-save
  const handleReorderThread = async (draggedId: number, targetId: number) => {
    if (draggedId === targetId) return
    const arr = [...threads]
    const from = arr.findIndex(t => t.id === draggedId)
    const to = arr.findIndex(t => t.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = arr.splice(from, 1)
    arr.splice(arr.findIndex(t => t.id === targetId), 0, moved)
    setThreads(arr)
    try { await reorderTodoThreads(arr.map(t => t.id)) } catch { load() }
  }

  // Reorder checklist items within a thread — optimistic update + auto-save
  const handleReorderItems = async (threadId: number, orderedIds: number[]) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t
      const byId = new Map(t.items.map(i => [i.id, i]))
      const items = orderedIds.map(id => byId.get(id)).filter((i): i is TodoItem => !!i)
      return { ...t, items }
    }))
    try { await reorderTodoItems(orderedIds) } catch { load() }
  }

  // Drop a checklist item — reorder within a thread OR move it to another thread.
  // targetItemId === null means "drop at the end of toThreadId".
  const handleItemDrop = async (toThreadId: number, targetItemId: number | null) => {
    if (!dragItem) return
    const { id: itemId, threadId: fromThreadId } = dragItem
    setDragItem(null)
    setOverItem(null)

    // Same thread → reorder
    if (fromThreadId === toThreadId) {
      if (targetItemId == null || targetItemId === itemId) return
      const t = threads.find(x => x.id === toThreadId)
      if (!t) return
      const arr = [...t.items]
      const from = arr.findIndex(i => i.id === itemId)
      if (from < 0) return
      const [moved] = arr.splice(from, 1)
      const to = arr.findIndex(i => i.id === targetItemId)
      arr.splice(to < 0 ? arr.length : to, 0, moved)
      handleReorderItems(toThreadId, arr.map(i => i.id))
      return
    }

    // Cross-thread → move
    const source = threads.find(x => x.id === fromThreadId)
    const target = threads.find(x => x.id === toThreadId)
    if (!source || !target) return
    const moved = source.items.find(i => i.id === itemId)
    if (!moved) return

    const newSource = source.items.filter(i => i.id !== itemId)
    const newTarget = [...target.items]
    const idx = targetItemId == null
      ? newTarget.length
      : (() => { const k = newTarget.findIndex(i => i.id === targetItemId); return k < 0 ? newTarget.length : k })()
    newTarget.splice(idx, 0, { ...moved, thread_id: toThreadId })

    setThreads(prev => prev.map(t =>
      t.id === fromThreadId ? { ...t, items: newSource }
      : t.id === toThreadId ? { ...t, items: newTarget }
      : t
    ))

    try {
      await updateTodoItem(itemId, { thread_id: toThreadId })
      await reorderTodoItems(newTarget.map(i => i.id))
      if (newSource.length) await reorderTodoItems(newSource.map(i => i.id))
    } catch { load() }
  }

  const headerEl = document.getElementById('page-header-actions')

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: 300 }}>
      <Spinner animation="border" style={{ color: 'var(--primary)', width: 48, height: 48 }} />
    </div>
  )

  const open = threads.filter(t => t.status === 'open')
  const done = threads.filter(t => t.status === 'done')

  return (
    <>
      {headerEl && createPortal(
        <Button variant="primary" size="sm" onClick={openNew}>
          <i className="bi bi-plus-lg me-1" />New Thread
        </Button>,
        headerEl
      )}

      {threads.length === 0 && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-card-checklist" style={{ fontSize: '3rem', color: '#d1d3e2', display: 'block', marginBottom: 12 }} />
          <div style={{ fontWeight: 700 }}>No threads yet</div>
          <div className="small">Click <strong>New Thread</strong> to create your first todo thread.</div>
        </div>
      )}

      {/* Open threads */}
      {open.length > 0 && (
        <>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Open — {open.length}
          </div>
          <Row className="g-3 mb-4">
            {open.map(t => <Col key={t.id} xs={12}><ThreadCard thread={t} onEdit={openEdit} onDelete={handleDeleteThread} onToggleStatus={toggleStatus} onAddItem={handleAddItem} onBulkAddItems={handleBulkAddItems} onToggleItem={handleToggleItem} onDeleteItem={handleDeleteItem} onEditItem={handleEditItem} itemText={itemText} setItemText={setItemText} dragThreadId={dragThreadId} overThreadId={overThreadId} setDragThreadId={setDragThreadId} setOverThreadId={setOverThreadId} onReorderThread={handleReorderThread} dragItem={dragItem} overItem={overItem} setDragItem={setDragItem} setOverItem={setOverItem} onItemDrop={handleItemDrop} /></Col>)}
          </Row>
        </>
      )}

      {/* Done threads */}
      {done.length > 0 && (
        <>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Completed — {done.length}
          </div>
          <Row className="g-3">
            {done.map(t => <Col key={t.id} xs={12}><ThreadCard thread={t} onEdit={openEdit} onDelete={handleDeleteThread} onToggleStatus={toggleStatus} onAddItem={handleAddItem} onBulkAddItems={handleBulkAddItems} onToggleItem={handleToggleItem} onDeleteItem={handleDeleteItem} onEditItem={handleEditItem} itemText={itemText} setItemText={setItemText} dragThreadId={dragThreadId} overThreadId={overThreadId} setDragThreadId={setDragThreadId} setOverThreadId={setOverThreadId} onReorderThread={handleReorderThread} dragItem={dragItem} overItem={overItem} setDragItem={setDragItem} setOverItem={setOverItem} onItemDrop={handleItemDrop} /></Col>)}
          </Row>
        </>
      )}

      {/* Thread modal */}
      <Modal show={threadModal} onHide={() => setThreadModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Edit Thread' : 'New Thread'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {saveError && (
            <div className="alert alert-danger py-2 small mb-3">{saveError}</div>
          )}
          <Form.Group className="mb-3">
            <Form.Label>Heading <span className="text-danger">*</span></Form.Label>
            <Form.Control
              placeholder="e.g. Sprint Planning, Bug Triage..."
              value={form.heading}
              onChange={e => setForm(f => ({ ...f, heading: e.target.value }))}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Notes, context, agenda..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Meeting / Reference</Form.Label>
            <Form.Control
              placeholder="e.g. Weekly Sync 2025-06-02, Sprint 12 Retrospective..."
              value={form.meeting}
              onChange={e => setForm(f => ({ ...f, meeting: e.target.value }))}
            />
            <Form.Text className="text-muted">Which meeting or event this thread belongs to.</Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setThreadModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveThread} disabled={saving || !form.heading.trim()}>
            {saving ? <Spinner animation="border" size="sm" className="me-1" /> : null}
            {editing ? 'Save' : 'Create'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

interface CardProps {
  thread: TodoThread
  onEdit: (t: TodoThread) => void
  onDelete: (id: number) => void
  onToggleStatus: (t: TodoThread) => void
  onAddItem: (threadId: number) => void
  onBulkAddItems: (threadId: number, lines: string[]) => void
  onToggleItem: (item: TodoItem) => void
  onDeleteItem: (itemId: number) => void
  onEditItem: (item: TodoItem, newText: string) => void
  itemText: Record<number, string>
  setItemText: React.Dispatch<React.SetStateAction<Record<number, string>>>
  dragThreadId: number | null
  overThreadId: number | null
  setDragThreadId: React.Dispatch<React.SetStateAction<number | null>>
  setOverThreadId: React.Dispatch<React.SetStateAction<number | null>>
  onReorderThread: (draggedId: number, targetId: number) => void
  dragItem: { id: number; threadId: number } | null
  overItem: { threadId: number; itemId: number } | null
  setDragItem: React.Dispatch<React.SetStateAction<{ id: number; threadId: number } | null>>
  setOverItem: React.Dispatch<React.SetStateAction<{ threadId: number; itemId: number } | null>>
  onItemDrop: (toThreadId: number, targetItemId: number | null) => void
}

function ThreadCard({ thread, onEdit, onDelete, onToggleStatus, onAddItem, onBulkAddItems, onToggleItem, onDeleteItem, onEditItem, itemText, setItemText, dragThreadId, overThreadId, setDragThreadId, setOverThreadId, onReorderThread, dragItem, overItem, setDragItem, setOverItem, onItemDrop }: CardProps) {
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length) onBulkAddItems(thread.id, lines)
    }
    reader.readAsText(file)
    e.target.value = ''   // allow re-selecting the same file
  }
  const isDone = thread.status === 'done'
  const doneCount = thread.items.filter(i => i.done).length
  const total = thread.items.length
  const pct = total ? Math.round((doneCount / total) * 100) : 0

  // Collapsible state — collapsed by default, independent per thread
  const [expanded, setExpanded] = useState(false)

  // Inline item editing state
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  const isThreadDragging = dragThreadId === thread.id
  // Highlight the card as a drop target for thread reorder OR cross-thread item move
  const isThreadOver = overThreadId === thread.id && (
    (dragThreadId !== null && dragThreadId !== thread.id) ||
    (dragItem != null && dragItem.threadId !== thread.id)
  )

  const startEditItem = (item: TodoItem) => {
    setEditingItemId(item.id)
    setEditingText(item.text)
  }

  const commitEditItem = (item: TodoItem) => {
    const trimmed = editingText.trim()
    if (trimmed && trimmed !== item.text) {
      onEditItem(item, trimmed)
    }
    setEditingItemId(null)
  }

  const cancelEditItem = () => {
    setEditingItemId(null)
  }

  return (
    <div
      className="card pd-card"
      onDragOver={e => {
        if (dragThreadId !== null) { e.preventDefault(); setOverThreadId(thread.id) }
        else if (dragItem && dragItem.threadId !== thread.id) { e.preventDefault(); setOverThreadId(thread.id) }
      }}
      onDragLeave={() => setOverThreadId(o => (o === thread.id ? null : o))}
      onDrop={e => {
        e.preventDefault()
        if (dragThreadId !== null) onReorderThread(dragThreadId, thread.id)
        else if (dragItem) onItemDrop(thread.id, null)   // move item to end of this thread
        setDragThreadId(null); setOverThreadId(null)
      }}
      style={{
        borderLeft: `4px solid ${STATUS_COLOR[thread.status]}`,
        borderRadius: '0.35rem',
        opacity: isThreadDragging ? 0.4 : 1,
        boxShadow: isThreadOver ? '0 0 0 2px var(--primary)' : undefined,
        transition: 'box-shadow 0.12s, opacity 0.12s',
      }}
    >
      <div className="card-header d-flex align-items-start" style={{ background: '#f8f9fc' }}>
        <i
          className="bi bi-grip-vertical"
          draggable
          onDragStart={e => { setDragThreadId(thread.id); e.dataTransfer.effectAllowed = 'move' }}
          onDragEnd={() => { setDragThreadId(null); setOverThreadId(null) }}
          title="Drag to reorder"
          style={{ cursor: 'grab', color: '#b0b3c6', marginTop: 3, marginRight: 6, flexShrink: 0 }}
        />
        <div
          className="d-flex align-items-start gap-2 flex-grow-1"
          style={{ minWidth: 0, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <i
            className={`bi ${expanded ? 'bi-chevron-down' : 'bi-chevron-right'}`}
            style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, flexShrink: 0, transition: 'transform 0.15s' }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#3a3b45', textDecoration: isDone ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {thread.heading}
            </div>
            {thread.meeting && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                <i className="bi bi-calendar-event me-1" />{thread.meeting}
              </div>
            )}
          </div>
        </div>
        <div className="d-flex align-items-center gap-1 ms-2 flex-shrink-0">
          <Badge style={{ background: isDone ? '#1cc88a' : '#4e73df', fontSize: '0.7rem' }}>
            {isDone ? 'Done' : 'Open'}
          </Badge>
          <button className="btn btn-sm btn-light" title={isDone ? 'Reopen' : 'Mark done'} style={{ padding: '2px 6px' }} onClick={() => onToggleStatus(thread)}>
            <i className={`bi ${isDone ? 'bi-arrow-counterclockwise' : 'bi-check-lg'}`} />
          </button>
          <button className="btn btn-sm btn-light" title="Edit" style={{ padding: '2px 6px' }} onClick={() => onEdit(thread)}>
            <i className="bi bi-pencil" />
          </button>
          <button className="btn btn-sm btn-light text-danger" title="Delete" style={{ padding: '2px 6px' }} onClick={() => onDelete(thread.id)}>
            <i className="bi bi-trash" />
          </button>
        </div>
      </div>

      {expanded && (
      <div className="card-body" style={{ padding: '14px 18px' }}>
        {thread.description && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            {thread.description}
          </p>
        )}

        {/* Progress */}
        {total > 0 && (
          <div className="mb-3">
            <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <span>{doneCount}/{total} items done</span>
              <span>{pct}%</span>
            </div>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${pct}%`, background: pct === 100 ? '#1cc88a' : '#4e73df' }} />
            </div>
          </div>
        )}

        {/* Items */}
        <div
          style={{ marginBottom: 10 }}
          onDragOver={e => { if (dragItem) { e.preventDefault() } }}
          onDrop={e => { if (dragItem) { e.preventDefault(); e.stopPropagation(); onItemDrop(thread.id, null) } }}
        >
          {thread.items.map(item => (
            <div
              key={item.id}
              className="d-flex align-items-center gap-2 py-1"
              onDragOver={e => { if (dragItem) { e.preventDefault(); setOverItem({ threadId: thread.id, itemId: item.id }) } }}
              onDragLeave={() => setOverItem(o => (o && o.itemId === item.id && o.threadId === thread.id ? null : o))}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); onItemDrop(thread.id, item.id) }}
              style={{
                borderBottom: '1px solid var(--card-border)',
                borderTop: overItem?.itemId === item.id && overItem?.threadId === thread.id && dragItem?.id !== item.id ? '2px solid var(--primary)' : '2px solid transparent',
                opacity: dragItem?.id === item.id ? 0.4 : 1,
              }}
            >
              <i
                className="bi bi-grip-vertical"
                draggable
                onDragStart={e => { setDragItem({ id: item.id, threadId: thread.id }); e.dataTransfer.effectAllowed = 'move' }}
                onDragEnd={() => { setDragItem(null); setOverItem(null) }}
                title="Drag to reorder or move to another thread"
                style={{ cursor: 'grab', color: '#c8cbd8', flexShrink: 0, fontSize: '0.85rem' }}
              />
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggleItem(item)}
                style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0, accentColor: '#1cc88a' }}
              />

              {editingItemId === item.id ? (
                /* ── Inline edit mode ── */
                <>
                  <Form.Control
                    size="sm"
                    autoFocus
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEditItem(item)
                      if (e.key === 'Escape') cancelEditItem()
                    }}
                    onBlur={() => commitEditItem(item)}
                    style={{ flex: 1, fontSize: '0.875rem', padding: '2px 6px' }}
                  />
                  <button className="btn btn-sm" title="Save (Enter)" style={{ padding: '1px 5px', color: '#1cc88a', lineHeight: 1 }} onMouseDown={e => { e.preventDefault(); commitEditItem(item) }}>
                    <i className="bi bi-check-lg" />
                  </button>
                  <button className="btn btn-sm" title="Cancel (Esc)" style={{ padding: '1px 5px', color: '#dee2e6', lineHeight: 1 }} onMouseDown={e => { e.preventDefault(); cancelEditItem() }}>
                    <i className="bi bi-x" />
                  </button>
                </>
              ) : (
                /* ── Normal display mode ── */
                <>
                  <span style={{ flex: 1, fontSize: '0.875rem', color: item.done ? 'var(--text-muted)' : 'var(--text-dark)', textDecoration: item.done ? 'line-through' : 'none' }}>
                    {item.text}
                  </span>
                  {!isDone && (
                    <button className="btn btn-sm" title="Edit item" style={{ padding: '1px 5px', color: '#b0b3c6', lineHeight: 1 }} onClick={() => startEditItem(item)}>
                      <i className="bi bi-pencil" style={{ fontSize: '0.75rem' }} />
                    </button>
                  )}
                  <button className="btn btn-sm" style={{ padding: '1px 5px', color: '#dee2e6', lineHeight: 1 }} onClick={() => onDeleteItem(item.id)}>
                    <i className="bi bi-x" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add item input + bulk import from text file */}
        {!isDone && (
          <>
            <div className="d-flex gap-2 mt-2">
              <Form.Control
                size="sm"
                placeholder="Add action item..."
                value={itemText[thread.id] ?? ''}
                onChange={e => setItemText(p => ({ ...p, [thread.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') onAddItem(thread.id) }}
              />
              <Button size="sm" variant="outline-primary" onClick={() => onAddItem(thread.id)} style={{ flexShrink: 0 }}>
                <i className="bi bi-plus" />
              </Button>
            </div>
            <label className="btn btn-sm btn-link p-0 mt-1" style={{ fontSize: '0.75rem', textDecoration: 'none' }} title="Each non-empty line becomes a checklist item">
              <i className="bi bi-upload me-1" />Import checklist from .txt file
              <input type="file" accept=".txt,text/plain" hidden onChange={handleImportFile} />
            </label>
          </>
        )}

        <div style={{ fontSize: '0.72rem', color: '#c0c0c8', marginTop: 10, textAlign: 'right' }}>
          {dayjs(thread.created_at.endsWith('Z') ? thread.created_at : thread.created_at + 'Z').format('DD MMM YYYY, HH:mm')}
        </div>
      </div>
      )}
    </div>
  )
}
