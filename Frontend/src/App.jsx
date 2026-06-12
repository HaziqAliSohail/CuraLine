import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Appointments from './pages/Appointments'
import Reschedule from './pages/Reschedule'
import Doctors from './pages/Doctors'
import Profile from './pages/Profile'
import DoctorDashboard from './pages/DoctorDashboard'
import DoctorSchedule from './pages/DoctorSchedule'
import DoctorSettings from './pages/DoctorSettings'
import DoctorInsights from './pages/DoctorInsights'
import ApplyDoctor from './pages/ApplyDoctor'
import AdminApplications from './pages/AdminApplications'

export default function App() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg animate-pulse">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400 font-medium">CuraLine</p>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <Navbar />
      <main>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={user ? <Navigate to={role === 'doctor' ? '/doctor' : '/'} replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to={role === 'doctor' ? '/doctor' : '/'} replace /> : <Register />} />
          <Route path="/apply"    element={user ? <Navigate to={role === 'doctor' ? '/doctor' : '/'} replace /> : <ApplyDoctor />} />

          {/* Patient routes */}
          <Route path="/"            element={<ProtectedRoute><Dashboard   /></ProtectedRoute>} />
          <Route path="/chat"        element={<ProtectedRoute><Chat        /></ProtectedRoute>} />
          <Route path="/appointments"element={<ProtectedRoute><Appointments/></ProtectedRoute>} />
          <Route path="/reschedule"  element={<ProtectedRoute><Reschedule  /></ProtectedRoute>} />
          <Route path="/doctors"     element={<ProtectedRoute><Doctors     /></ProtectedRoute>} />
          <Route path="/profile"     element={<ProtectedRoute><Profile     /></ProtectedRoute>} />

          {/* Admin routes (admin = patient account with is_admin) */}
          <Route path="/admin/applications" element={<ProtectedRoute><AdminApplications /></ProtectedRoute>} />

          {/* Doctor portal routes */}
          <Route path="/doctor"          element={<ProtectedRoute requiredRole="doctor"><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/doctor/schedule" element={<ProtectedRoute requiredRole="doctor"><DoctorSchedule  /></ProtectedRoute>} />
          <Route path="/doctor/insights" element={<ProtectedRoute requiredRole="doctor"><DoctorInsights  /></ProtectedRoute>} />
          <Route path="/doctor/settings" element={<ProtectedRoute requiredRole="doctor"><DoctorSettings  /></ProtectedRoute>} />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to={user ? (role === 'doctor' ? '/doctor' : '/') : '/login'} replace />} />
        </Routes>
      </main>
    </ToastProvider>
  )
}
