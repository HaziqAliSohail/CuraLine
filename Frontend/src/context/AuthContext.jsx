import { createContext, useContext, useEffect, useState } from 'react'
import { getMyProfile, getDoctorProfile } from '../api/client'

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
      const res = activeRole === 'doctor' ? await getDoctorProfile() : await getMyProfile()
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

  const loginUser = (token, userRole = 'patient') => {
    localStorage.setItem('token', token)
    localStorage.setItem('role', userRole)
    setRole(userRole)
    fetchUser(userRole)
  }

  const logout = () => {
    localStorage.removeItem('token')
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
