import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Team from './pages/Team'
import Todo from './pages/Todo'
import Settings from './pages/Settings'
import { getReleaseDate } from './api/client'

const navItems = [
  { to: '/', icon: 'bi-speedometer2', label: 'Dashboard' },
  { to: '/tasks', icon: 'bi-check2-square', label: 'Tasks' },
  { to: '/team', icon: 'bi-people-fill', label: 'Team' },
  { to: '/todo', icon: 'bi-card-checklist', label: 'Todo' },
  { to: '/settings', icon: 'bi-gear-fill', label: 'Settings' },
]

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Dashboard', sub: 'Welcome back, Project Lead 👋' },
  '/tasks': { title: 'Task Management', sub: 'Manage and track your team tasks' },
  '/team': { title: 'Team Members', sub: 'Manage your Prime Team' },
  '/todo': { title: 'Todo', sub: 'Threads, action items and meeting notes' },
  '/settings': { title: 'Settings', sub: 'Configure PrimeDesk preferences' },
}

function ReleaseBadge({ date }: { date: string }) {
  const rd = dayjs(date)
  const daysLeft = rd.diff(dayjs(), 'day')
  const isPast = daysLeft < 0
  const isClose = daysLeft >= 0 && daysLeft <= 7

  const borderColor = isPast ? '#e74a3b' : isClose ? '#f6c23e' : '#1cc88a'
  const textColor = isPast ? '#e74a3b' : isClose ? '#b7860b' : '#13a673'
  const icon = isPast ? 'bi-exclamation-triangle-fill' : isClose ? 'bi-clock-history' : 'bi-rocket-takeoff-fill'
  const countdown = isPast
    ? `Overdue by ${Math.abs(daysLeft)}d`
    : daysLeft === 0 ? 'Today!'
    : `${daysLeft}d to go`

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: `${borderColor}12`,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 8,
      padding: '5px 12px',
    }}>
      <i className={`bi ${icon}`} style={{ color: textColor, fontSize: '0.85rem' }} />
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9e9fb4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Next Ship Release
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: textColor }}>
          {rd.format('DD MMM YYYY')}
          <span style={{
            marginLeft: 7,
            fontSize: '0.7rem',
            fontWeight: 700,
            background: borderColor,
            color: '#fff',
            borderRadius: 5,
            padding: '1px 6px',
          }}>
            {countdown}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const page = PAGE_TITLES[location.pathname] ?? { title: 'PrimeDesk', sub: '' }
  const [releaseDate, setReleaseDate] = useState<string | null>(null)

  useEffect(() => {
    getReleaseDate().then(r => setReleaseDate(r.release_date))
  }, [location.pathname]) // refresh when navigating back from Settings

  return (
    <div>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="pd-sidebar">
        <div className="pd-sidebar-brand">
          <div className="pd-brand-icon">
            <i className="bi bi-kanban-fill" style={{ fontSize: '1.2rem' }} />
          </div>
          <div>
            <div className="pd-brand-name">PrimeDesk</div>
            <div className="pd-brand-sub">Prime Team</div>
          </div>
        </div>

        <div className="pd-nav-section">Main</div>

        {navItems.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `pd-nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon"><i className={`bi ${n.icon}`} /></span>
            {n.label}
          </NavLink>
        ))}

        <div className="pd-nav-section" style={{ marginTop: 16 }}>Account</div>

        <a href="#" className="pd-nav-link">
          <span className="nav-icon"><i className="bi bi-person-circle" /></span>
          Profile
        </a>
        <a href="#" className="pd-nav-link">
          <span className="nav-icon"><i className="bi bi-shield-lock" /></span>
          Security
        </a>

        <div className="pd-sidebar-footer">
          <div className="pd-sidebar-user">
            <div className="pd-sidebar-avatar">PL</div>
            <div>
              <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}>Project Lead</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="pd-main">

        {/* Topbar */}
        <div className="pd-topbar">
          <div className="pd-topbar-search">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input type="text" className="form-control" placeholder="Search tasks, members..." style={{ fontSize: '0.9rem' }} />
            </div>
          </div>

          <div className="pd-topbar-actions">
            {/* Release date badge — always visible in topbar */}
            {releaseDate && <ReleaseBadge date={releaseDate} />}

            <div className="pd-topbar-divider" />

            <a className="pd-icon-btn" href="#"><i className="bi bi-bell" /><span className="pd-notif-dot" /></a>
            <a className="pd-icon-btn" href="#"><i className="bi bi-envelope" /></a>

            <div className="pd-topbar-divider" />

            <div className="pd-user-pill">
              <div className="pd-user-pill-avatar">PL</div>
              <div>
                <div className="pd-user-pill-name">Project Lead</div>
                <div className="pd-user-pill-role">Admin</div>
              </div>
              <i className="bi bi-chevron-down ms-1" style={{ fontSize: '0.75rem', color: '#9e9fb4' }} />
            </div>
          </div>
        </div>

        {/* Page */}
        <div className="pd-page">
          <div className="pd-page-header">
            <div>
              <h1 className="pd-page-title">{page.title}</h1>
              <p className="pd-page-sub mb-0">{page.sub}</p>
            </div>
            <div id="page-header-actions" />
          </div>
          <hr style={{ borderColor: 'var(--card-border)', marginBottom: 24, marginTop: 0 }} />

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/team" element={<Team />} />
            <Route path="/todo" element={<Todo />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
