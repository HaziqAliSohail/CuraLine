import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  clearToken,
  getDoctorProfile,
  getMyProfile,
  getRefreshToken,
  loadAuth,
  registerDevice,
  revokeSession,
  saveToken,
  setUnauthorizedHandler,
  unregisterDevice,
} from '../api/client'
import { getPushToken } from '../notifications'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('patient')
  const [loading, setLoading] = useState(true)
  const pushTokenRef = useRef(null)

  // Best-effort: register this device for push after sign-in. Failure is
  // silent - the app is fully functional without push.
  const enablePush = async () => {
    try {
      const token = await getPushToken()
      if (token) {
        await registerDevice(token)
        pushTokenRef.current = token
      }
    } catch {
      // no push in this runtime - fine
    }
  }

  const fetchUser = async (activeRole) => {
    try {
      const res = activeRole === 'doctor' ? await getDoctorProfile() : await getMyProfile()
      setUser(res.data)
      setRole(activeRole)
      enablePush()
    } catch {
      await clearToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    const boot = async () => {
      const { token, role: storedRole } = await loadAuth()
      if (!token) {
        setLoading(false)
        return
      }
      await fetchUser(storedRole)
    }
    boot()
  }, [])

  // Accepts the login response body ({access_token, refresh_token}) or a
  // bare access-token string for backward compatibility.
  const loginUser = async (auth, userRole = 'patient') => {
    await saveToken(auth, userRole)
    setRole(userRole)
    await fetchUser(userRole)
  }

  const logout = async () => {
    // Best-effort server-side cleanup: stop pushes to this device and revoke
    // the session - neither may block signing out.
    try {
      if (pushTokenRef.current) await unregisterDevice(pushTokenRef.current)
    } catch {}
    try {
      const refreshToken = await getRefreshToken()
      if (refreshToken) await revokeSession(refreshToken)
    } catch {}
    pushTokenRef.current = null
    await clearToken()
    setUser(null)
    setRole('patient')
  }

  const refreshUser = () => fetchUser(role)

  return (
    <AuthContext.Provider value={{ user, role, loading, loginUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
