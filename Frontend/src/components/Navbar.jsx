import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { listRescheduleRequests } from '../api/client'
import {
  FiHome,
  FiMessageSquare,
  FiCalendar,
  FiRefreshCw,
  FiUsers,
  FiLogOut,
  FiUser,
  FiUserCheck,
  FiSettings,
  FiTrendingUp,
  FiChevronDown,
} from 'react-icons/fi'

const patientNavItems = [
  { to: '/',             label: 'Home',             icon: FiHome },
  { to: '/chat',         label: 'Book with AI',     icon: FiMessageSquare },
  { to: '/appointments', label: 'My Appointments',  icon: FiCalendar },
  { to: '/reschedule',   label: 'Reschedule',       icon: FiRefreshCw, badge: true },
  { to: '/doctors',      label: 'Doctors',          icon: FiUsers },
]

const doctorNavItems = [
  { to: '/doctor',          label: 'My Day',      icon: FiHome },
  { to: '/doctor/schedule', label: 'My Schedule', icon: FiCalendar },
  { to: '/doctor/insights', label: 'Insights',    icon: FiTrendingUp },
]

const adminNavItem = { to: '/admin/applications', label: 'Applications', icon: FiUserCheck }

function HeartPulseIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

export default function Navbar() {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)

  const isDoctor = role === 'doctor'
  const navItems = isDoctor
    ? doctorNavItems
    : user?.is_admin
    ? [...patientNavItems, adminNavItem]
    : patientNavItems

  // Poll for pending reschedule requests every 30s (patient accounts only)
  useEffect(() => {
    if (!user || isDoctor) return
    const fetchPending = async () => {
      try {
        const res = await listRescheduleRequests()
        setPendingCount(res.data.length)
      } catch {
        // silent
      }
    }
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [user, isDoctor])

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to={isDoctor ? '/doctor' : '/'} className="flex items-center gap-2.5 group" aria-label="CuraLine Home">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-shadow">
              <HeartPulseIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight">CuraLine</span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-0.5">
            {navItems.map(({ to, label, icon: Icon, badge }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                  {/* Notification dot for pending reschedule requests */}
                  {badge && pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              aria-label="User menu"
              aria-expanded={profileOpen}
            >
              <div className="w-7 h-7 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center font-bold text-xs">
                {user.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="hidden sm:inline max-w-24 truncate">{user.name}</span>
              <FiChevronDown size={14} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-20 animate-scale-up">
                  {!isDoctor ? (
                    <>
                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <FiUser size={15} className="text-gray-400" />
                        My Profile
                      </Link>
                      <hr className="my-1 border-gray-100" />
                    </>
                  ) : (
                    <>
                      <Link
                        to="/doctor/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <FiSettings size={15} className="text-gray-400" />
                        Settings
                      </Link>
                      <hr className="my-1 border-gray-100" />
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <FiLogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <nav aria-label="Mobile navigation" className="flex md:hidden gap-0.5 pb-2 overflow-x-auto">
          {navItems.map(({ to, label, icon: Icon, badge }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  active ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={13} />
                {label}
                {badge && pendingCount > 0 && (
                  <span className="ml-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </nav>
  )
}
