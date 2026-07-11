import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setPasswordApi, setToken } from '../api/client'
import { useAuth } from '../AuthContext'

export default function SetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUser } = useAuth()

  const email = searchParams.get('email') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const data = await setPasswordApi(email, newPassword)
      setToken(data.access_token)
      setUser({ id: data.id, email, name: data.name, role: data.role as 'lead' | 'member' })
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to set password')
    } finally {
      setLoading(false)
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

        <h5 style={{ fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>Set Your Password</h5>
        <p style={{ color: '#9e9fb4', fontSize: '0.85rem', marginBottom: 24 }}>
          Welcome! Choose a password for your account to get started.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5a5c69' }}>Email address</label>
            <input
              type="email"
              className="form-control"
              value={email}
              readOnly
              style={{ background: '#f8f9fc', color: '#858796', cursor: 'not-allowed' }}
            />
          </div>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5a5c69' }}>New Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Min 6 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5a5c69' }}>Confirm Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && (
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
                Setting password...
              </>
            ) : 'Set Password & Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
