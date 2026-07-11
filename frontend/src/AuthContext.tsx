import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getToken, clearToken, getMe } from './api/client'
import type { AuthUser } from './api/client'

interface AuthContextType {
  user: AuthUser | null
  setUser: (u: AuthUser | null) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On mount, try to restore session from token
    const token = getToken()
    if (!token) { setLoading(false); return }
    // Validate token by calling /auth/me
    getMe()
      .then(u => setUser(u))
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const logout = () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
