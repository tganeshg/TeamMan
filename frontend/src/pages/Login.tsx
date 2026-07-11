import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, setToken, leadInitPasswordApi } from '../api/client'
import { useAuth } from '../AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Lead init password section
  const [showLeadInit, setShowLeadInit] = useState(false)
  const [leadNewPw, setLeadNewPw] = useState('')
  const [leadConfirmPw, setLeadConfirmPw] = useState('')
  const [leadInitLoading, setLeadInitLoading] = useState(false)
  const [leadInitError, setLeadInitError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      if ('first_login' in data && data.first_login) {
        navigate(`/set-password?email=${encodeURIComponent(data.email)}`)
        return
      }
      const tokenData = data as { access_token: string; role: string; name: string; id: number | null }
      setToken(tokenData.access_token)
      setUser({ id: tokenData.id, email, name: tokenData.name, role: tokenData.role as 'lead' | 'member' })
      navigate('/')
    } catch (err: any) {
      const detail: string = err?.response?.data?.detail ?? 'Login failed'
      setError(detail)
      if (detail.toLowerCase().includes('lead password not configured')) {
        setShowLeadInit(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLeadInit = async (e: FormEvent) => {
    e.preventDefault()
    setLeadInitError('')
    if (leadNewPw !== leadConfirmPw) {
      setLeadInitError('Passwords do not match')
      return
    }
    if (leadNewPw.length < 6) {
      setLeadInitError('Password must be at least 6 characters')
      return
    }
    setLeadInitLoading(true)
    try {
      await leadInitPasswordApi(leadNewPw)
      // Auto-login with the new password
      const data = await login(email, leadNewPw) as { access_token: string; role: string; name: string; id: number | null }
      setToken(data.access_token)
      setUser({ id: data.id, email, name: data.name, role: data.role as 'lead' | 'member' })
      navigate('/')
    } catch (err: any) {
      setLeadInitError(err?.response?.data?.detail ?? 'Failed to set password')
    } finally {
      setLeadInitLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        padding: '40px 36px',
        width: '100%',
        maxWidth: 400,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center' }}>
          <div style={{
            width: 36, height: 36,
            background: '#4e73df',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="bi bi-kanban-fill" style={{ fontSize: '1.1rem', color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2d3748', lineHeight: 1.2 }}>PrimeDesk</div>
            <div style={{ fontSize: '0.72rem', color: '#9e9fb4', letterSpacing: '0.04em' }}>Prime Team</div>
          </div>
        </div>

        <h5 style={{ fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>Sign in to your account</h5>
        <p style={{ color: '#9e9fb4', fontSize: '0.85rem', marginBottom: 24 }}>Enter your credentials to continue</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5a5c69' }}>Email address</label>
            <input
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5a5c69' }}>Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && !showLeadInit && (
            <div className="alert alert-danger py-2 px-3" style={{ fontSize: '0.85rem', borderRadius: 8 }}>
              <i className="bi bi-exclamation-circle me-2" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
            style={{ fontWeight: 600, borderRadius: 8, padding: '10px' }}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Signing in...
              </>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Lead first-time setup */}
        {showLeadInit && (
          <div style={{ marginTop: 24, borderTop: '1px solid #e3e6f0', paddingTop: 20 }}>
            <div className="alert alert-warning py-2 px-3 mb-3" style={{ fontSize: '0.82rem', borderRadius: 8 }}>
              <i className="bi bi-shield-exclamation me-2" />
              Lead password not configured. Set it up below to get started.
            </div>
            <h6 style={{ fontWeight: 700, color: '#2d3748', marginBottom: 12 }}>Set up lead account</h6>
            <form onSubmit={handleLeadInit}>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5a5c69' }}>New Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Min 6 characters"
                  value={leadNewPw}
                  onChange={e => setLeadNewPw(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5a5c69' }}>Confirm Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Repeat password"
                  value={leadConfirmPw}
                  onChange={e => setLeadConfirmPw(e.target.value)}
                  required
                />
              </div>
              {leadInitError && (
                <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '0.85rem', borderRadius: 8 }}>
                  <i className="bi bi-exclamation-circle me-2" />
                  {leadInitError}
                </div>
              )}
              <button
                type="submit"
                className="btn btn-success w-100"
                disabled={leadInitLoading}
                style={{ fontWeight: 600, borderRadius: 8, padding: '10px' }}
              >
                {leadInitLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    Setting password...
                  </>
                ) : 'Set Password & Sign In'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
