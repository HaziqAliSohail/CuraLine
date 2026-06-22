import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
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
import HospitalApply from './pages/HospitalApply'
import AcceptInvite from './pages/AcceptInvite'
import AdminApplications from './pages/AdminApplications'
import AdminHospitals from './pages/AdminHospitals'
import DoctorApplications from './pages/DoctorApplications'
import AdminAuditLog from './pages/AdminAuditLog'
import Landing from './pages/Landing'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// Heavy WebGL bundle (three/gsap/lenis) — loaded only when /experience is visited.
const LandingImmersive = lazy(() => import('./pages/LandingImmersive'))

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-3 focus:left-3 focus:bg-primary-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="pb-20 md:pb-0">
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={user ? <Navigate to={role === 'doctor' ? '/doctor' : role === 'admin' ? '/admin/hospitals' : '/'} replace /> :<Login />} />
          <Route path="/register" element={user ? <Navigate to={role === 'doctor' ? '/doctor' : role === 'admin' ? '/admin/hospitals' : '/'} replace /> :<Register />} />
          <Route path="/apply"    element={user ? <Navigate to={role === 'doctor' ? '/doctor' : role === 'admin' ? '/admin/hospitals' : '/'} replace /> :<ApplyDoctor />} />
          <Route path="/hospital-apply" element={user ? <Navigate to={role === 'doctor' ? '/doctor' : role === 'admin' ? '/admin/hospitals' : '/'} replace /> :<HospitalApply />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Immersive 3D experience — PRIVATE for now (login-gated, still WIP).
              Lazy WebGL bundle. Promote to a public route / homepage when ready. */}
          <Route
            path="/experience"
            element={
              <ProtectedRoute>
                <Suspense fallback={<div className="min-h-screen bg-[#05060f]" />}>
                  <LandingImmersive />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* Root: public landing for guests, dashboard for patients, portal for doctors */}
          <Route
            path="/"
            element={
              !user ? (
                <Landing />
              ) : role === 'doctor' ? (
                <Navigate to="/doctor" replace />
              ) : role === 'admin' ? (
                <Navigate to="/admin/hospitals" replace />
              ) : (
                <ProtectedRoute><Dashboard /></ProtectedRoute>
              )
            }
          />

          {/* Patient routes */}
          <Route path="/chat"        element={<ProtectedRoute><Chat        /></ProtectedRoute>} />
          <Route path="/appointments"element={<ProtectedRoute><Appointments/></ProtectedRoute>} />
          <Route path="/reschedule"  element={<ProtectedRoute><Reschedule  /></ProtectedRoute>} />
          <Route path="/doctors"     element={<ProtectedRoute><Doctors     /></ProtectedRoute>} />
          <Route path="/profile"     element={<ProtectedRoute><Profile     /></ProtectedRoute>} />

          {/* Admin routes (admin = PlatformAdmin, a first-class identity) */}
          <Route path="/admin/applications" element={<ProtectedRoute requiredRole="admin"><AdminApplications /></ProtectedRoute>} />
          <Route path="/admin/hospitals" element={<ProtectedRoute requiredRole="admin"><AdminHospitals /></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={<ProtectedRoute requiredRole="admin"><AdminAuditLog /></ProtectedRoute>} />

          {/* Doctor portal routes */}
          <Route path="/doctor"          element={<ProtectedRoute requiredRole="doctor"><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/doctor/schedule" element={<ProtectedRoute requiredRole="doctor"><DoctorSchedule  /></ProtectedRoute>} />
          <Route path="/doctor/insights" element={<ProtectedRoute requiredRole="doctor"><DoctorInsights  /></ProtectedRoute>} />
          <Route path="/doctor/applications" element={<ProtectedRoute requiredRole="doctor"><DoctorApplications /></ProtectedRoute>} />
          <Route path="/doctor/settings" element={<ProtectedRoute requiredRole="doctor"><DoctorSettings  /></ProtectedRoute>} />

          {/* Default redirect - guests land on the marketing home */}
          <Route path="*" element={<Navigate to={user ? (role === 'doctor' ? '/doctor' : role === 'admin' ? '/admin/hospitals' : '/') : '/'} replace />} />
        </Routes>
      </main>
    </ToastProvider>
  )
}
