import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole = 'patient' }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Wrong portal for this account type - send them home for their role
  if (role !== requiredRole) {
    const home = role === 'doctor' ? '/doctor' : role === 'admin' ? '/admin/hospitals' : '/'
    return <Navigate to={home} replace />
  }

  return children
}
