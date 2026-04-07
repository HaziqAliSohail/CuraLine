import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Chat from './pages/Chat'
import Appointments from './pages/Appointments'
import Reschedule from './pages/Reschedule'
import Doctors from './pages/Doctors'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={user ? <Navigate to="/chat" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/chat" replace /> : <Register />} />

        {/* Protected routes */}
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
        <Route path="/reschedule" element={<ProtectedRoute><Reschedule /></ProtectedRoute>} />
        <Route path="/doctors" element={<ProtectedRoute><Doctors /></ProtectedRoute>} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to={user ? '/chat' : '/login'} replace />} />
      </Routes>
    </>
  )
}
