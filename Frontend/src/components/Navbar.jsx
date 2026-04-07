import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiMessageSquare, FiCalendar, FiRefreshCw, FiUsers, FiLogOut, FiUser } from 'react-icons/fi'

const navItems = [
  { to: '/chat', label: 'Book Appointment', icon: FiMessageSquare },
  { to: '/appointments', label: 'My Appointments', icon: FiCalendar },
  { to: '/reschedule', label: 'Reschedule', icon: FiRefreshCw },
  { to: '/doctors', label: 'Doctors', icon: FiUsers },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (!user) return null

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/chat" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CL</span>
            </div>
            <span className="font-bold text-lg text-gray-900">CuraLine</span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* User menu */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FiUser size={16} />
              <span className="hidden sm:inline">{user.name}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              <FiLogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex md:hidden gap-1 pb-3 overflow-x-auto">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
