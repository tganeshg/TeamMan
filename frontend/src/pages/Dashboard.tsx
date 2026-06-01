import { useEffect, useState } from 'react'
import { Row, Col, Table, Badge, Spinner } from 'react-bootstrap'
import { getDashboard } from '../api/client'
import type { DashboardData } from '../types'

const STATUS_LABEL: Record<string, string> = {
  SID00: 'Not Started',
  SID01: 'Study',       SID02: 'Requirement',      SID03: 'POC',
  SID04: 'Core Impl',  SID05: 'Dev Testing',       SID06: 'Review',
  SID07: 'Rework',     SID08: 'Ready to Merge',    SID09: 'Ready to Release',
  SID10: 'Waiting',    SID11: 'Reopened',           SID12: 'Closed',
  SID13: 'Released',   SID14: 'On Hold',
}

const STATUS_BG: Record<string, string> = {
  SID00: '#858796',
  SID01: '#858796', SID02: '#4e73df', SID03: '#36b9cc',
  SID04: '#4e73df', SID05: '#36b9cc', SID06: '#f6c23e',
  SID07: '#e74a3b', SID08: '#1cc88a', SID09: '#1cc88a',
  SID10: '#f6c23e', SID11: '#e74a3b', SID12: '#858796',
  SID13: '#1cc88a', SID14: '#f6c23e',
}

const STATUS_BADGE: Record<string, string> = {
  SID00: 'secondary',
  SID01: 'secondary', SID02: 'primary',   SID03: 'info',
  SID04: 'primary',   SID05: 'info',       SID06: 'warning',
  SID07: 'danger',    SID08: 'success',    SID09: 'success',
  SID10: 'warning',   SID11: 'danger',     SID12: 'secondary',
  SID13: 'success',   SID14: 'warning',
}

const ROLE_BADGE: Record<string, string> = {
  Lead: 'warning', Senior: 'primary', Junior: 'success', Intern: 'secondary',
}

const STAT_CARDS = [
  { key: 'total',    label: 'Total Tasks',     icon: 'bi-list-check',               variant: 'sba-card-primary' },
  { key: 'overdue',  label: 'Overdue',         icon: 'bi-exclamation-triangle-fill', variant: 'sba-card-danger'  },
  { key: 'due_today', label: 'Due Today',      icon: 'bi-clock-history',             variant: 'sba-card-warning' },
  { key: 'due_week', label: 'Due This Week',   icon: 'bi-calendar-week-fill',        variant: 'sba-card-info'    },
]

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: 300 }}>
      <Spinner animation="border" style={{ color: 'var(--primary)', width: 48, height: 48 }} />
    </div>
  )

  const d = data!
  const values: Record<string, number> = {
    total: d.total_tasks,
    due_today: d.due_today,
    overdue: d.overdue,
    due_week: d.due_this_week,
  }
  const total = d.total_tasks || 1

  return (
    <>
      {/* Stat Cards — SB Admin 2 border-left style */}
      <Row className="g-3 mb-4">
        {STAT_CARDS.map(card => (
          <Col key={card.key} xs={12} sm={6} xl={3}>
            <div className={`card sba-card ${card.variant} h-100`}>
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <div className="sba-card-label mb-1">{card.label}</div>
                    <div className="sba-card-value">{values[card.key]}</div>
                  </div>
                  <i className={`bi ${card.icon} sba-card-icon`} />
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Row className="g-3">
        {/* Status Breakdown */}
        <Col xs={12} lg={5}>
          <div className="card pd-card h-100">
            <div className="card-header">
              <span>
                <i className="bi bi-bar-chart-fill me-2" style={{ color: 'var(--primary)' }} />
                Tasks by Status
              </span>
              <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
                {d.total_tasks} total
              </span>
            </div>
            <div className="card-body">
              {Object.entries(d.by_status).length === 0 && (
                <p className="text-muted">No tasks yet.</p>
              )}
              {Object.entries(d.by_status).map(([status, count]) => (
                <div key={status} className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span
                        style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: STATUS_BG[status] ?? '#adb5bd',
                          display: 'inline-block', flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#3a3f5c' }}>
                        <span style={{ color: '#9e9fb4', fontWeight: 700, fontSize: '0.78rem' }}>{status} </span>
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#3a3f5c' }}>
                      {count} <span style={{ color: '#9e9fb4', fontWeight: 500 }}>({Math.round((count / total) * 100)}%)</span>
                    </span>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div
                      className="progress-bar"
                      style={{
                        width: `${Math.round((count / total) * 100)}%`,
                        background: STATUS_BG[status] ?? '#adb5bd',
                        borderRadius: 10,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Col>

        {/* Team Workload */}
        <Col xs={12} lg={7}>
          <div className="card pd-card h-100">
            <div className="card-header">
              <span>
                <i className="bi bi-people-fill me-2" style={{ color: 'var(--primary)' }} />
                Team Workload
              </span>
            </div>
            <div className="card-body p-0">
              <Table className="pd-table mb-0" hover responsive>
                <thead>
                  <tr>
                    <th className="ps-4">Member</th>
                    <th>Role</th>
                    <th>Active Tasks</th>
                    <th style={{ width: 160 }}>Capacity</th>
                    <th>Load</th>
                  </tr>
                </thead>
                <tbody>
                  {d.workload.map(w => {
                    const pct = Math.min(w.active_tasks * 10, 100)
                    const loadColor = pct > 70 ? '#e74a3b' : pct > 40 ? '#f6c23e' : '#1cc88a'
                    const loadLabel = pct > 70 ? 'High' : pct > 40 ? 'Medium' : 'Low'
                    return (
                      <tr key={w.id}>
                        <td className="ps-4">
                          <div className="d-flex align-items-center gap-2">
                            <div
                              style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: '#4e73df22', color: 'var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: '0.88rem', flexShrink: 0,
                              }}
                            >
                              {w.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600 }}>{w.name}</span>
                          </div>
                        </td>
                        <td>
                          <Badge bg={ROLE_BADGE[w.role] ?? 'secondary'} className="fw-normal">
                            {w.role}
                          </Badge>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{ background: '#4e73df22', color: 'var(--primary)', fontWeight: 700 }}
                          >
                            {w.active_tasks}
                          </span>
                        </td>
                        <td>
                          <div className="progress" style={{ height: 8 }}>
                            <div
                              className="progress-bar"
                              style={{ width: `${pct}%`, background: loadColor, borderRadius: 10 }}
                            />
                          </div>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{ background: `${loadColor}22`, color: loadColor, fontWeight: 700 }}
                          >
                            {loadLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {d.workload.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-5">
                        <i className="bi bi-people fs-2 d-block mb-2" />
                        No team members yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </div>
        </Col>
      </Row>
    </>
  )
}
