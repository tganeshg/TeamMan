import { useEffect, useState, useRef, useCallback } from 'react'
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Team from './pages/Team'
import Todo from './pages/Todo'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import { getReleases, getTasks } from './api/client'
import type { Task } from './types'

const navItems = [
  { to: '/', icon: 'bi-speedometer2', label: 'Dashboard' },
  { to: '/tasks', icon: 'bi-check2-square', label: 'Tasks' },
  { to: '/team', icon: 'bi-people-fill', label: 'Team' },
  { to: '/todo', icon: 'bi-card-checklist', label: 'Todo' },
  { to: '/reports', icon: 'bi-bar-chart-line-fill', label: 'Reports' },
  { to: '/settings', icon: 'bi-gear-fill', label: 'Settings' },
]

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Dashboard', sub: 'Welcome back, Project Lead 👋' },
  '/tasks': { title: 'Task Management', sub: 'Manage and track your team tasks' },
  '/team': { title: 'Team Members', sub: 'Manage your Prime Team' },
  '/todo': { title: 'Todo', sub: 'Threads, action items and meeting notes' },
  '/reports': { title: 'Reports', sub: 'Release performance reports for your team' },
  '/settings': { title: 'Settings', sub: 'Configure PrimeDesk preferences' },
}

function ReleaseBadge({ date, name }: { date: string; name: string | null }) {
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
          {name ? `Release: ${name}` : 'Next Ship Release'}
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

const COLOR_HEX: Record<string, string> = {
  gray: '#858796', blue: '#4e73df', orange: '#f6c23e', red: '#e74a3b', green: '#1cc88a',
}
const STATUS_LABEL: Record<string, string> = {
  SID00:'Not Started', SID01:'Study', SID02:'Requirement', SID03:'POC',
  SID04:'Core Impl',   SID05:'Dev Testing', SID06:'Review', SID07:'Rework',
  SID08:'Ready to Merge', SID09:'Ready to Release', SID10:'Waiting',
  SID11:'Reopened', SID12:'Closed', SID13:'Released', SID14:'On Hold',
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const page = PAGE_TITLES[location.pathname] ?? { title: 'PrimeDesk', sub: '' }
  const [activeReleases, setActiveReleases] = useState<{ name: string; release_date: string }[]>([])

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pd-theme') === 'dark')
  useEffect(() => {
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('pd-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Task[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close search on navigation
  useEffect(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [location.pathname])

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await getTasks({ search: q.trim() } as any)
        setSearchResults(results.slice(0, 8))
        setSearchOpen(true)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }, [])

  const handleResultClick = (task: Task) => {
    setSearchOpen(false)
    setSearchQuery('')
    navigate('/tasks', { state: { openTaskId: task.id } })
  }

  useEffect(() => {
    getReleases()
      .then(list => setActiveReleases(list.filter(r => r.status === 'active')))
      .catch(() => {})
  }, [location.pathname])

  return (
    <div>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="pd-sidebar">
        <div className="pd-sidebar-brand">
          <div className="pd-brand-icon" style={{
            width: 32, height: 32,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '0.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i className="bi bi-kanban-fill" style={{ fontSize: '1rem', color: '#fff' }} />
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
              <div style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 600 }}>Project Lead</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="pd-main">

        {/* Topbar */}
        <div className="pd-topbar">
          <div className="pd-topbar-search" ref={searchRef} style={{ position: 'relative' }}>
            <div className="input-group">
              <span className="input-group-text">
                {searchLoading
                  ? <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14, borderWidth: 2, color: 'var(--text-muted)' }} />
                  : <i className="bi bi-search" />}
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search by task title or bug ID..."
                style={{ fontSize: '0.9rem' }}
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              />
              {searchQuery && (
                <button className="btn btn-link" style={{ color: 'var(--text-muted)', padding: '0 10px' }}
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false) }}>
                  <i className="bi bi-x" />
                </button>
              )}
            </div>

            {/* Search dropdown */}
            {searchOpen && (
              <div className="pd-search-dropdown" style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)',
                zIndex: 9999, maxHeight: 360, overflowY: 'auto',
              }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No tasks found for "<strong>{searchQuery}</strong>"
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '8px 16px 4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </div>
                    {searchResults.map(task => (
                      <div
                        key={task.id}
                        onClick={() => handleResultClick(task)}
                        style={{
                          padding: '10px 16px', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', gap: 10, borderBottom: '1px solid var(--card-border)',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = document.body.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.06)' : '#f8f9fc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                          background: COLOR_HEX[task.color] ?? '#858796',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                            {task.portal_task_id && <span style={{ marginRight: 8 }}><i className="bi bi-hash" />{task.portal_task_id}</span>}
                            <span>{STATUS_LABEL[task.status] ?? task.status}</span>
                            {task.assignee && <span style={{ marginLeft: 8 }}><i className="bi bi-person me-1" />{task.assignee.name}</span>}
                          </div>
                        </div>
                        <i className="bi bi-arrow-right" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', flexShrink: 0 }} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="pd-topbar-actions">
            {/* Release date badge — always visible in topbar */}
            {activeReleases.map(r => (
              <ReleaseBadge key={r.name} date={r.release_date} name={r.name} />
            ))}

            <div className="pd-topbar-divider" />

            {/* Dark mode toggle */}
            <button
              className="pd-icon-btn"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              onClick={() => setDarkMode(d => !d)}
              style={{ border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <i className={`bi ${darkMode ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} />
            </button>

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
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
