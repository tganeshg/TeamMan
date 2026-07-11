import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Badge, Spinner, Table, Modal, Button, Alert } from 'react-bootstrap'
import { getTasks } from '../api/client'
import { useAuth } from '../AuthContext'
import type { Task } from '../types'
import dayjs from 'dayjs'

const STATUS_LABEL: Record<string, string> = {
  SID00: 'Not Started', SID01: 'Study', SID02: 'Requirement', SID03: 'POC',
  SID04: 'Core Impl', SID05: 'Dev Testing', SID06: 'Review', SID07: 'Rework',
  SID08: 'Ready to Merge', SID09: 'Ready to Release', SID10: 'Waiting',
  SID11: 'Reopened', SID12: 'Closed', SID13: 'Released', SID14: 'On Hold',
  SID15: 'Debug', SID16: 'Moved to Software',
}

const STATUS_COLOR: Record<string, string> = {
  SID00: '#858796', SID01: '#858796', SID02: '#4e73df', SID03: '#36b9cc',
  SID04: '#4e73df', SID05: '#36b9cc', SID06: '#f6c23e', SID07: '#e74a3b',
  SID08: '#1cc88a', SID09: '#1cc88a', SID10: '#f6c23e', SID11: '#e74a3b',
  SID12: '#858796', SID13: '#1cc88a', SID14: '#f6c23e', SID15: '#4e73df',
  SID16: '#f6c23e',
}

const TERMINAL = new Set(['SID12', 'SID13'])
const FOCUS_EXCLUDE_STATUSES = new Set(['SID06', 'SID12', 'SID13'])

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#858796'
  return (
    <span
      className="badge"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        fontWeight: 600,
        fontSize: '0.72rem',
      }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function PriorityBadge({ p }: { p: number | null }) {
  if (p == null) return <span className="text-muted">—</span>
  const bg = p === 1 ? '#dc3545' : p === 2 ? '#fd7e14' : '#0d6efd'
  return (
    <span
      className="badge"
      style={{ background: bg, fontSize: '0.7rem' }}
    >
      P{p}
    </span>
  )
}

export default function MyTaskBoard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskLoading, setTaskLoading] = useState(false)
  const [showReminder, setShowReminder] = useState(false)
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    setTaskLoading(true)
    getTasks({ assignee_id: user.id })
      .then(setTasks)
      .finally(() => setTaskLoading(false))
  }, [user])

  // End-of-day reminder
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const todayKey = `pd_eod_${now.toISOString().split('T')[0]}`
      if (now.getHours() >= 17 && !localStorage.getItem(todayKey)) {
        setShowReminder(true)
      }
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  const dismissReminder = (updated: boolean) => {
    const todayKey = `pd_eod_${new Date().toISOString().split('T')[0]}`
    localStorage.setItem(todayKey, '1')
    setShowReminder(false)
    if (!updated) {
      setShowWarning(true)
      setTimeout(() => setShowWarning(false), 3000)
    }
  }

  if (!user?.id) {
    return (
      <div className="card border-0 shadow-sm rounded-3 p-4 text-center" style={{ maxWidth: 480, margin: '40px auto' }}>
        <i className="bi bi-person-x fs-2 mb-2" style={{ color: '#858796' }} />
        <p className="mb-0" style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Your account is not linked to a team member entry. Ask the lead to add your email to the team.
        </p>
      </div>
    )
  }

  const todayStr = new Date().toISOString().split('T')[0]

  const activeTasks = tasks.filter(t => !TERMINAL.has(t.status as string))
  const dueTodayTasks = tasks.filter(t => t.end_date === todayStr)
  const overdueTasks = tasks.filter(
    t => t.end_date && t.end_date < todayStr && !TERMINAL.has(t.status as string)
  )

  const focusTasks = tasks.filter(
    t =>
      t.end_date != null &&
      t.end_date >= todayStr &&
      !FOCUS_EXCLUDE_STATUSES.has(t.status as string)
  )

  const sortedTasks = [...tasks].sort((a, b) => {
    const aTerminal = TERMINAL.has(a.status as string) ? 1 : 0
    const bTerminal = TERMINAL.has(b.status as string) ? 1 : 0
    if (aTerminal !== bTerminal) return aTerminal - bTerminal
    if (a.end_date && b.end_date) return a.end_date.localeCompare(b.end_date)
    if (a.end_date) return -1
    if (b.end_date) return 1
    return 0
  })

  const statCards = [
    { label: 'Active Tasks', value: activeTasks.length, color: '#4e73df', icon: 'bi-check2-square' },
    { label: 'Due Today', value: dueTodayTasks.length, color: '#DD5600', icon: 'bi-clock-history' },
    { label: 'Overdue', value: overdueTasks.length, color: '#C71C22', icon: 'bi-exclamation-triangle-fill' },
  ]

  return (
    <>
      {taskLoading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
      ) : (
        <>
          {/* Section 1 — Stat cards */}
          <Row className="g-3 mb-4">
            {statCards.map(card => (
              <Col key={card.label} xs={12} sm={4}>
                <div className="card h-100" style={{ borderLeft: `4px solid ${card.color}`, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  <div className="card-body py-4 px-4">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>{card.label}</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                      </div>
                      <i className={`bi ${card.icon}`} style={{ color: card.color, opacity: 0.25, fontSize: '2.5rem' }} />
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          {/* Section 2 — Today's Focus */}
          <div className="mb-4">
            <h6 className="fw-bold mb-3" style={{ color: 'var(--text-dark)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <i className="bi bi-lightning-fill me-2" style={{ color: '#f6c23e' }} />
              Today's Focus
            </h6>
            {focusTasks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No tasks for today 🎉</p>
            ) : (
              <Row className="g-2">
                {focusTasks.map(task => {
                  const isOverdue = task.end_date && task.end_date < todayStr && !TERMINAL.has(task.status as string)
                  const isDueToday = task.end_date === todayStr
                  return (
                    <Col key={task.id} xs={12} sm={6} md={4}>
                      <div
                        className="card border-0 shadow-sm rounded-3 p-3"
                        style={{ cursor: 'pointer', borderLeft: isOverdue ? '3px solid #C71C22' : isDueToday ? '3px solid #DD5600' : '3px solid #4e73df' }}
                        onClick={() => navigate('/tasks', { state: { openTaskId: task.id } })}
                      >
                        <div className="fw-semibold mb-2" style={{ fontSize: '0.875rem', color: 'var(--text-dark)', lineHeight: 1.3 }}>
                          {task.title}
                        </div>
                        <div className="d-flex flex-wrap gap-1 align-items-center">
                          <StatusBadge status={task.status as string} />
                          <PriorityBadge p={task.priority} />
                          {task.end_date && (
                            <span style={{ fontSize: '0.72rem', color: isOverdue ? '#C71C22' : isDueToday ? '#DD5600' : 'var(--text-muted)', fontWeight: 600 }}>
                              <i className="bi bi-calendar2 me-1" />
                              {dayjs(task.end_date).format('DD MMM')}
                            </span>
                          )}
                        </div>
                      </div>
                    </Col>
                  )
                })}
              </Row>
            )}
          </div>

          {/* Section 3 — All My Tasks */}
          <div>
            <h6 className="fw-bold mb-3" style={{ color: 'var(--text-dark)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <i className="bi bi-list-task me-2" style={{ color: '#4e73df' }} />
              All My Tasks
            </h6>
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
              <Table className="pd-table mb-0" hover responsive>
                <thead>
                  <tr>
                    <th className="ps-2" style={{ width: 50 }}>#</th>
                    <th>Title</th>
                    <th style={{ width: 140 }}>Status</th>
                    <th style={{ width: 80 }}>Priority</th>
                    <th style={{ width: 120 }}>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task, idx) => {
                    const isOverdue = task.end_date && task.end_date < todayStr && !TERMINAL.has(task.status as string)
                    const isDueToday = task.end_date === todayStr
                    return (
                      <tr
                        key={task.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate('/tasks', { state: { openTaskId: task.id } })}
                      >
                        <td className="ps-2 text-muted" style={{ fontSize: '0.8rem' }}>{idx + 1}</td>
                        <td className="fw-medium" style={{ color: 'var(--text-dark)' }}>{task.title}</td>
                        <td><StatusBadge status={task.status as string} /></td>
                        <td><PriorityBadge p={task.priority} /></td>
                        <td>
                          {task.end_date ? (
                            <span style={{ color: isOverdue ? '#C71C22' : isDueToday ? '#DD5600' : undefined, fontWeight: (isOverdue || isDueToday) ? 600 : undefined, fontSize: '0.875rem' }}>
                              {dayjs(task.end_date).format('DD MMM YYYY')}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {sortedTasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-5">
                        <i className="bi bi-inbox fs-2 d-block mb-2" />
                        No tasks assigned to you yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* End-of-day reminder modal */}
      <Modal show={showReminder} centered onHide={() => {}}>
        <Modal.Header style={{ border: 'none', paddingBottom: 0 }}>
          <Modal.Title style={{ fontSize: '1rem', fontWeight: 700 }}>
            <i className="bi bi-clock-history me-2" style={{ color: '#f6c23e' }} />
            End of Day Check-in
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ textAlign: 'center', padding: '20px 24px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Have you updated today's task status?</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>Take a moment to update your progress before you leave.</p>
        </Modal.Body>
        <Modal.Footer style={{ border: 'none', justifyContent: 'center', gap: 12 }}>
          <Button variant="success" onClick={() => dismissReminder(true)}>
            <i className="bi bi-check-lg me-1" /> Yes, updated!
          </Button>
          <Button variant="outline-secondary" onClick={() => dismissReminder(false)}>
            Not yet
          </Button>
        </Modal.Footer>
      </Modal>

      {showWarning && (
        <Alert variant="warning" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, maxWidth: 320 }}>
          <i className="bi bi-exclamation-triangle-fill me-2" />
          Please make sure to update your tasks before you leave!
        </Alert>
      )}
    </>
  )
}
