import { createContext, useContext, useEffect, useState } from 'react'
import { getMyProfile, getDoctorProfile, getAdminProfile, revokeSession } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(() => localStorage.getItem('role') || 'patient')
  const [loading, setLoading] = useState(true)

  const fetchUser = async (activeRole = localStorage.getItem('role') || 'patient') => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res =
        activeRole === 'doctor' ? await getDoctorProfile()
        : activeRole === 'admin' ? await getAdminProfile()
        : await getMyProfile()
      setUser(res.data)
      setRole(activeRole)
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
    // Expired/invalid token detected by the API client → log out immediately
    const onUnauthorized = () => setUser(null)
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  // Accepts the login response body ({access_token, refresh_token}) or, for
  // backward compatibility, a bare access-token string.
  const loginUser = (auth, userRole = 'patient') => {
    const accessToken = typeof auth === 'string' ? auth : auth.access_token
    localStorage.setItem('token', accessToken)
    if (auth.refresh_token) localStorage.setItem('refresh_token', auth.refresh_token)
    localStorage.setItem('role', userRole)
    setRole(userRole)
    fetchUser(userRole)
  }

  const logout = () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) revokeSession(refreshToken).catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('role')
    setUser(null)
    setRole('patient')
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
