import { useEffect, useState } from 'react'
import { Row, Col, Card, Button, Badge, Table, Spinner, Modal, Form, Alert } from 'react-bootstrap'
import dayjs from 'dayjs'
import {
  getReleases, createRelease, updateRelease, deleteRelease,
  getReport, exportDocxUrl, exportPdfUrl,
} from '../api/client'
import type { Release, ReleaseReport } from '../types'

const TIMING_BADGE: Record<string, { label: string; color: string }> = {
  early:        { label: 'Early ✓',     color: '#1cc88a' },
  on_time:      { label: 'On Time ✓',   color: '#4e73df' },
  overdue:      { label: 'Overdue ✗',   color: '#e74a3b' },
  in_progress:  { label: 'In Progress', color: '#f6c23e' },
  open:         { label: 'Open',        color: '#858796' },
  closed:       { label: 'Closed',      color: '#1cc88a' },
}

export default function Reports() {
  const [releases, setReleases] = useState<Release[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [report, setReport] = useState<ReleaseReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [filterMember, setFilterMember] = useState('')
  const [loadError, setLoadError] = useState('')

  // New / Edit release modal
  const [showModal, setShowModal] = useState(false)
  const [editingRelease, setEditingRelease] = useState<Release | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalDate, setModalDate] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const loadReleases = () =>
    getReleases()
      .then(r => { setReleases(r); setLoadError(''); return r })
      .catch(() => { setLoadError('Could not load releases. Is the backend running?'); return [] as Release[] })

  useEffect(() => {
    loadReleases().then(list => {
      if (list.length > 0) selectRelease(list[0].id)
    })
  }, [])

  const selectRelease = (id: number) => {
    setSelectedId(id)
    setReport(null)
    setFilterMember('')
    setReportLoading(true)
    getReport(id).then(setReport).catch(() => setReport(null)).finally(() => setReportLoading(false))
  }

  const openNewModal = () => {
    setEditingRelease(null)
    setModalName('')
    setModalDate('')
    setModalError('')
    setShowModal(true)
  }

  const openEditModal = (r: Release, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingRelease(r)
    setModalName(r.name)
    setModalDate(r.release_date)
    setModalError('')
    setShowModal(true)
  }

  const handleSaveModal = async () => {
    if (!modalName.trim() || !modalDate) { setModalError('Name and date are required.'); return }
    setModalSaving(true)
    setModalError('')
    try {
      if (editingRelease) {
        await updateRelease(editingRelease.id, { name: modalName.trim(), release_date: modalDate })
        await loadReleases()
        if (selectedId === editingRelease.id) selectRelease(editingRelease.id)
      } else {
        const r = await createRelease(modalName.trim(), modalDate)
        const list = await loadReleases()
        selectRelease(r.id)
      }
      setShowModal(false)
      setModalName(''); setModalDate('')
    } catch (e: any) {
      setModalError(e?.response?.data?.detail ?? 'Failed to save release.')
    } finally {
      setModalSaving(false)
    }
  }

  const handleMarkComplete = async (id: number) => {
    await updateRelease(id, { status: 'completed' })
    await loadReleases()
    if (selectedId === id) selectRelease(id)
  }

  const handleReopen = async (id: number) => {
    await updateRelease(id, { status: 'active' })
    await loadReleases()
    if (selectedId === id) selectRelease(id)
  }

  const handleDelete = async (id: number) => {
    await deleteRelease(id)
    const list = await loadReleases()
    if (selectedId === id) {
      if (list.length > 0) selectRelease(list[0].id)
      else { setSelectedId(null); setReport(null) }
    }
  }


  const filteredTasks = report?.tasks.filter(t =>
    !filterMember || t.assignee_name === filterMember
  ) ?? []

  const uniqueMembers = Array.from(new Set(report?.tasks.map(t => t.assignee_name).filter(Boolean) as string[]))

  return (
    <>
      <Row className="g-3">
        {/* Left — Release list */}
        <Col xs={12} lg={3}>
          <Card className="border-0 shadow-sm rounded-3">
            <Card.Header className="bg-white border-bottom fw-semibold d-flex align-items-center justify-content-between">
              <span><i className="bi bi-rocket-takeoff text-primary me-2" />Releases</span>
              <Button variant="primary" size="sm" onClick={openNewModal}>
                <i className="bi bi-plus" />
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {loadError && <p className="text-danger small p-3">{loadError}</p>}
              {!loadError && releases.length === 0 && (
                <p className="text-muted small p-3">No releases yet. Create one to get started.</p>
              )}
              {releases.map(r => (
                <div
                  key={r.id}
                  onClick={() => selectRelease(r.id)}
                  className="px-3 py-2 border-bottom"
                  style={{
                    cursor: 'pointer',
                    background: selectedId === r.id ? '#4e73df11' : undefined,
                    borderLeft: selectedId === r.id ? '3px solid #4e73df' : '3px solid transparent',
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="fw-semibold small" style={{ color: selectedId === r.id ? '#4e73df' : '#3a3f5c' }}>
                      {r.name}
                    </span>
                    <div className="d-flex align-items-center gap-1">
                      <Badge bg={r.status === 'active' ? 'success' : 'secondary'} className="fw-normal" style={{ fontSize: '0.65rem' }}>
                        {r.status === 'active' ? 'Active' : 'Done'}
                      </Badge>
                      <button
                        className="btn btn-link btn-sm p-0 ms-1"
                        style={{ fontSize: '0.75rem', color: '#9e9fb4' }}
                        title="Edit release"
                        onClick={e => openEditModal(r, e)}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                    </div>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                    {dayjs(r.release_date).format('DD MMM YYYY')}
                  </div>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>

        {/* Right — Report */}
        <Col xs={12} lg={9}>
          {!selectedId && (
            <div className="text-center text-muted py-5">
              <i className="bi bi-bar-chart-line fs-1 d-block mb-2" />
              Select a release to view its report.
            </div>
          )}

          {selectedId && reportLoading && (
            <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
          )}

          {report && !reportLoading && (
            <>
              {/* Report header */}
              <Card className="border-0 shadow-sm rounded-3 mb-3 no-print-border">
                <Card.Body>
                  <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
                    <div>
                      <h5 className="fw-bold mb-1" style={{ color: '#3a3f5c' }}>
                        {report.release_name}
                        <Badge
                          className="ms-2 fw-normal"
                          bg={report.release_status === 'active' ? 'success' : 'secondary'}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {report.release_status === 'active' ? 'Active' : 'Completed'}
                        </Badge>
                      </h5>
                      <div className="text-muted small">
                        Target: <strong>{dayjs(report.release_date).format('DD MMM YYYY')}</strong>
                        &nbsp;·&nbsp;Generated: {dayjs(report.generated_on).format('DD MMM YYYY')}
                      </div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                      <a
                        href={exportPdfUrl(report.release_id)}
                        download
                        className="btn btn-outline-secondary btn-sm"
                      >
                        <i className="bi bi-file-earmark-pdf me-1" />PDF
                      </a>
                      <a
                        href={exportDocxUrl(report.release_id)}
                        download
                        className="btn btn-outline-primary btn-sm"
                      >
                        <i className="bi bi-file-earmark-word me-1" />Word
                      </a>
                      {report.release_status === 'active' ? (
                        <Button variant="outline-success" size="sm" onClick={() => handleMarkComplete(report.release_id)}>
                          <i className="bi bi-check-circle me-1" />Mark Complete
                        </Button>
                      ) : (
                        <Button variant="outline-warning" size="sm" onClick={() => handleReopen(report.release_id)}>
                          <i className="bi bi-arrow-counterclockwise me-1" />Reopen
                        </Button>
                      )}
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(report.release_id)}>
                        <i className="bi bi-trash" />
                      </Button>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {report.total_tasks === 0 && (
                <Alert variant="info">No tasks are tagged to this release yet. Tag tasks by editing them and selecting this release.</Alert>
              )}

              {report.total_tasks > 0 && (
                <>
                  {/* Summary stat cards */}
                  <Row className="g-3 mb-3">
                    {[
                      { label: 'Total Tasks',    value: report.total_tasks,         color: '#4e73df' },
                      { label: 'Closed',         value: report.total_closed,        color: '#1cc88a' },
                      { label: 'Early',          value: report.total_early,         color: '#1cc88a' },
                      { label: 'On Time',        value: report.total_on_time,       color: '#4e73df' },
                      { label: 'Late Closed',    value: report.total_overdue_closed, color: '#e74a3b' },
                      { label: 'Open/Overdue',   value: report.total_still_open,    color: '#e74a3b' },
                      { label: 'In Progress',    value: report.total_in_progress,   color: '#f6c23e' },
                    ].map(c => (
                      <Col xs={6} sm={4} xl={3} key={c.label}>
                        <div className="card border-0 shadow-sm rounded-3 h-100" style={{ borderLeft: `4px solid ${c.color}` }}>
                          <div className="card-body py-2 px-3">
                            <div className="small text-muted fw-semibold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>{c.label}</div>
                            <div className="fw-bold" style={{ fontSize: '1.5rem', color: c.color }}>{c.value}</div>
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>

                  {/* Per-member breakdown */}
                  <Card className="border-0 shadow-sm rounded-3 mb-3">
                    <Card.Header className="bg-white border-bottom fw-semibold">
                      <i className="bi bi-people-fill text-primary me-2" />Per-Member Breakdown
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Table className="pd-table mb-0" hover responsive>
                        <thead>
                          <tr>
                            <th className="ps-3">Member</th>
                            <th>Role</th>
                            <th className="text-center">Assigned</th>
                            <th className="text-center">Closed</th>
                            <th className="text-center" style={{ color: '#1cc88a' }}>Early</th>
                            <th className="text-center" style={{ color: '#4e73df' }}>On Time</th>
                            <th className="text-center" style={{ color: '#e74a3b' }}>Late Closed</th>
                            <th className="text-center" style={{ color: '#e74a3b' }}>Open/OD</th>
                            <th className="text-center" style={{ color: '#f6c23e' }}>In Progress</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.members.map(m => (
                            <tr key={m.member_id}>
                              <td className="ps-3 fw-semibold">{m.member_name}</td>
                              <td><Badge bg="primary" className="fw-normal">{m.member_role}</Badge></td>
                              <td className="text-center fw-bold">{m.total_assigned}</td>
                              <td className="text-center">
                                <span className="badge" style={{ background: '#1cc88a22', color: '#1cc88a', fontWeight: 700 }}>{m.closed}</span>
                              </td>
                              <td className="text-center">
                                <span className="badge" style={{ background: '#1cc88a22', color: '#1cc88a', fontWeight: 700 }}>{m.early}</span>
                              </td>
                              <td className="text-center">
                                <span className="badge" style={{ background: '#4e73df22', color: '#4e73df', fontWeight: 700 }}>{m.on_time}</span>
                              </td>
                              <td className="text-center">
                                <span className="badge" style={{ background: '#e74a3b22', color: '#e74a3b', fontWeight: 700 }}>{m.overdue_closed}</span>
                              </td>
                              <td className="text-center">
                                <span className="badge" style={{ background: '#e74a3b22', color: '#e74a3b', fontWeight: 700 }}>{m.still_open}</span>
                              </td>
                              <td className="text-center">
                                <span className="badge" style={{ background: '#f6c23e22', color: '#b7860b', fontWeight: 700 }}>{m.in_progress}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>

                  {/* Task detail table */}
                  <Card className="border-0 shadow-sm rounded-3">
                    <Card.Header className="bg-white border-bottom fw-semibold d-flex align-items-center justify-content-between">
                      <span><i className="bi bi-list-check text-primary me-2" />Task Details</span>
                      <Form.Select
                        size="sm"
                        style={{ width: 180 }}
                        value={filterMember}
                        onChange={e => setFilterMember(e.target.value)}
                      >
                        <option value="">All Members</option>
                        {uniqueMembers.map(m => <option key={m} value={m}>{m}</option>)}
                      </Form.Select>
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Table className="pd-table mb-0" hover responsive>
                        <thead>
                          <tr>
                            <th className="ps-3">ID</th>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Assignee</th>
                            <th>Status</th>
                            <th>Due Date</th>
                            <th>Closed On</th>
                            <th>Timing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTasks.map(t => {
                            const tb = TIMING_BADGE[t.timing] ?? { label: t.timing, color: '#858796' }
                            return (
                              <tr key={t.task_id}>
                                <td className="ps-3 text-muted small">
                                  {t.portal_task_id ? <Badge bg="secondary" className="fw-normal">#{t.portal_task_id}</Badge> : `#${t.task_id}`}
                                </td>
                                <td className="fw-medium">{t.title}</td>
                                <td>
                                  <Badge bg={t.task_type === 'bug' ? 'danger' : 'info'} className="fw-normal">
                                    {t.task_type === 'bug' ? '🐛 Bug' : '✨ Feature'}
                                  </Badge>
                                </td>
                                <td>{t.assignee_name ?? <em className="text-muted">—</em>}</td>
                                <td><span className="small text-muted">{t.status}</span></td>
                                <td>{t.end_date ? dayjs(t.end_date).format('DD MMM YY') : '—'}</td>
                                <td>{t.closed_at ? dayjs(t.closed_at).format('DD MMM YY') : '—'}</td>
                                <td>
                                  <span
                                    className="badge"
                                    style={{ background: `${tb.color}22`, color: tb.color, border: `1px solid ${tb.color}44`, fontWeight: 700 }}
                                  >
                                    {tb.label}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                          {filteredTasks.length === 0 && (
                            <tr>
                              <td colSpan={8} className="text-center text-muted py-4">No tasks found.</td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </>
              )}
            </>
          )}
        </Col>
      </Row>

      {/* New / Edit Release Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="sm">
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title className="fs-6 fw-bold">{editingRelease ? 'Edit Release' : 'New Release'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && <Alert variant="danger" className="py-2 small">{modalError}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold">Release Name</Form.Label>
            <Form.Control
              size="sm"
              placeholder="e.g. v17.50 SC Beta"
              value={modalName}
              onChange={e => setModalName(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small fw-semibold">Target Ship Date</Form.Label>
            <Form.Control
              size="sm"
              type="date"
              value={modalDate}
              onChange={e => setModalDate(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="light" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSaveModal} disabled={modalSaving}>
            {modalSaving ? <Spinner animation="border" size="sm" className="me-1" /> : null}
            {editingRelease ? 'Save' : 'Create'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
