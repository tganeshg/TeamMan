import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Row, Col, Button, Modal, Form, Badge, Spinner } from 'react-bootstrap'
import { getMembers, createMember, updateMember, deleteMember } from '../api/client'
import { useAuth } from '../AuthContext'
import type { Member } from '../types'

const ROLE_COLORS: Record<string, string> = {
  Lead: '#f6c23e', Senior: '#4e73df', Junior: '#1cc88a', Intern: '#36b9cc',
}
const ROLE_VARIANT: Record<string, string> = {
  Lead: 'warning', Senior: 'primary', Junior: 'success', Intern: 'secondary',
}
const ROLE_ICON: Record<string, string> = {
  Lead: 'bi-star-fill', Senior: 'bi-person-badge', Junior: 'bi-person', Intern: 'bi-mortarboard',
}

export default function Team() {
  const { user } = useAuth()
  const isLead = user?.role === 'lead'
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState<{ name: string; email: string; role: 'Lead' | 'Senior' | 'Junior' | 'Intern' }>({ name: '', email: '', role: 'Junior' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    getMembers().then(setMembers).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', email: '', role: 'Junior' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (m: Member) => {
    setEditing(m)
    setForm({ name: m.name, email: m.email, role: m.role })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateMember(editing.id, form)
      } else {
        await createMember(form)
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteMember(deleteId)
    setDeleteId(null)
    load()
  }

  if (loading) return (
    <div className="d-flex justify-content-center py-5">
      <Spinner animation="border" variant="primary" />
    </div>
  )

  const headerEl = document.getElementById('page-header-actions')

  return (
    <>
      {isLead && headerEl && createPortal(
        <Button variant="primary" size="sm" onClick={openAdd}>
          <i className="bi bi-person-plus me-1" />Add Member
        </Button>,
        headerEl
      )}

      <Row className="g-3" style={{ rowGap: '12px' }}>
        {members.map(m => (
          <Col key={m.id} xs={12} sm={6} lg={4} xl={3}>
            <div className="card member-card h-100">
              <div className="card-body">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="member-avatar" style={{ background: `${ROLE_COLORS[m.role]}22`, color: ROLE_COLORS[m.role], width: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                    <i className={`bi ${ROLE_ICON[m.role] ?? 'bi-person'}`} />
                  </div>
                  <div className="overflow-hidden">
                    <div className="fw-bold text-truncate">{m.name}</div>
                    <div className="text-muted small text-truncate">{m.email}</div>
                  </div>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <Badge bg={ROLE_VARIANT[m.role] ?? 'secondary'} className="fw-normal">
                    <i className={`bi ${ROLE_ICON[m.role]} me-1`} style={{ fontSize: '0.7rem' }} />
                    {m.role}
                  </Badge>
                  <span className="badge bg-primary bg-opacity-10 text-primary">
                    {m.task_count} task{m.task_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              {isLead && (
                <div className="card-footer bg-transparent border-top py-2 d-flex justify-content-end gap-2">
                  <Button variant="outline-secondary" size="sm" className="py-0" onClick={() => openEdit(m)}>
                    <i className="bi bi-pencil" />
                  </Button>
                  {m.role !== 'Lead' && (
                    <Button variant="outline-danger" size="sm" className="py-0" onClick={() => setDeleteId(m.id)}>
                      <i className="bi bi-trash" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Col>
        ))}
        {members.length === 0 && (
          <Col xs={12}>
            <div className="card border-dashed text-center py-5 text-muted border-0 bg-white shadow-sm rounded-3">
              <i className="bi bi-people fs-1 mb-2 d-block" />
              No team members yet. Click <strong>Add Member</strong> to get started.
            </div>
          </Col>
        )}
      </Row>

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title className="fs-6 fw-bold">
            <i className={`bi ${editing ? 'bi-pencil-square' : 'bi-person-plus'} me-2 text-primary`} />
            {editing ? 'Edit Member' : 'Add Member'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">Full Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                size="sm"
                placeholder="e.g. Ravi Kumar"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">Email <span className="text-danger">*</span></Form.Label>
              <Form.Control
                size="sm"
                type="email"
                placeholder="ravi@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label className="small fw-semibold">Hierarchy Level</Form.Label>
              <Form.Select
                size="sm"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as 'Lead' | 'Senior' | 'Junior' | 'Intern' }))}
              >
                {['Senior', 'Junior', 'Intern'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="light" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner animation="border" size="sm" className="me-1" /> : null}
            {editing ? 'Save Changes' : 'Add Member'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirm */}
      <Modal show={deleteId !== null} onHide={() => setDeleteId(null)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">Remove Member?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-0">Their assigned tasks will become unassigned.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <i className="bi bi-person-dash me-1" />Remove
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
