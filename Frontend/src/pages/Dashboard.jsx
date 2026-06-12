import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listUpcomingAppointments, listRescheduleRequests } from '../api/client'
import { FiMessageSquare, FiCalendar, FiUsers, FiAlertTriangle, FiClock, FiUser, FiChevronRight } from 'react-icons/fi'
import SeverityBadge from '../components/SeverityBadge'

function Greeting({ name }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
        {greeting}, <span className="text-primary-600">{name?.split(' ')[0]}</span> 👋
      </h1>
      <p className="text-gray-500 mt-1 text-sm">Here's your health summary for today.</p>
    </div>
  )
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [year, month, date] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, date)
}

function NextAppointmentCard({ appointment }) {
  if (!appointment) {
    return (
      <div className="card-glass flex flex-col items-center justify-center py-10 text-center gap-3">
        <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center">
          <FiCalendar className="text-primary-400" size={26} />
        </div>
        <div>
          <p className="font-semibold text-gray-700">No upcoming appointments</p>
          <p className="text-sm text-gray-400 mt-1">Book one via AI or browse doctors below.</p>
        </div>
        <Link to="/chat" className="btn-primary text-sm mt-2">Book with AI</Link>
      </div>
    )
  }

  const slotDate = appointment.slot_date
    ? parseLocalDate(appointment.slot_date).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : '—'

  const slotTime = appointment.slot_time
    ? new Date(`1970-01-01T${appointment.slot_time}`).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
      })
    : '—'

  return (
    <div className="card-glass overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -translate-y-8 translate-x-8" />
      <p className="text-xs font-semibold text-primary-600 uppercase tracking-widest mb-3">Next Appointment</p>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-500/30">
          <FiUser className="text-white" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-lg truncate">
            {appointment.doctor_name || 'Your Doctor'}
          </p>
          {appointment.doctor_specialization && (
            <p className="text-primary-600 text-sm font-medium">{appointment.doctor_specialization}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <FiCalendar size={13} className="text-gray-400" /> {slotDate}
            </span>
            <span className="flex items-center gap-1.5">
              <FiClock size={13} className="text-gray-400" /> {slotTime}
            </span>
          </div>
          <div className="mt-3">
            <SeverityBadge score={appointment.severity_score} />
          </div>
        </div>
      </div>
      <Link
        to="/appointments"
        className="mt-4 flex items-center gap-1 text-sm text-primary-600 font-medium hover:text-primary-700 transition-colors"
      >
        View all appointments <FiChevronRight size={14} />
      </Link>
    </div>
  )
}

function RescheduleAlert({ count }) {
  if (count === 0) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <FiAlertTriangle className="text-amber-600" size={18} />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-amber-800 text-sm">
          {count} pending reschedule request{count !== 1 ? 's' : ''}
        </p>
        <p className="text-amber-600 text-xs mt-0.5">A critical patient needs your time slot.</p>
      </div>
      <Link to="/reschedule" className="btn-secondary text-sm py-2 px-3">Review</Link>
    </div>
  )
}

const actions = [
  {
    to: '/chat',
    icon: FiMessageSquare,
    label: 'Book with AI',
    desc: 'Describe symptoms, get matched instantly',
    color: 'from-primary-500 to-primary-600',
    bg: 'bg-primary-50 hover:bg-primary-100/60',
    text: 'text-primary-700',
  },
  {
    to: '/doctors',
    icon: FiUsers,
    label: 'Browse Doctors',
    desc: 'View specializations & available slots',
    color: 'from-violet-500 to-violet-600',
    bg: 'bg-violet-50 hover:bg-violet-100/60',
    text: 'text-violet-700',
  },
  {
    to: '/appointments',
    icon: FiCalendar,
    label: 'My Appointments',
    desc: 'View, cancel or track your bookings',
    color: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-50 hover:bg-emerald-100/60',
    text: 'text-emerald-700',
  },
]

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [upcoming, setUpcoming] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [apptRes, reschedRes] = await Promise.all([
        listUpcomingAppointments(),
        listRescheduleRequests(),
      ])
      setUpcoming(apptRes.data)
      setPendingCount(reschedRes.data.length)
    } catch {
      // silent — partials OK
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch on every navigation to this page (React Router keeps components mounted)
  const location = useLocation()
  useEffect(() => {
    setLoading(true)
    load()
  }, [location.key])

  // Also re-fetch when the user returns to this browser tab
  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Greeting */}
      <div className="animate-slide-up">
        <Greeting name={user?.name} />
      </div>

      {/* Reschedule alert */}
      <div className="animate-slide-up" style={{ animationDelay: '60ms' }}>
        <RescheduleAlert count={pendingCount} />
      </div>

      {/* Next appointment */}
      <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
        {loading ? (
          <div className="card-glass">
            <div className="skeleton h-5 w-32 mb-4" />
            <div className="flex gap-4">
              <div className="skeleton w-12 h-12 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-4 w-2/3 mt-2" />
              </div>
            </div>
          </div>
        ) : (
          <NextAppointmentCard appointment={upcoming[0] || null} />
        )}
      </div>

      {/* Quick actions */}
      <div className="animate-slide-up" style={{ animationDelay: '180ms' }}>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map(({ to, icon: Icon, label, desc, bg, text }) => (
            <Link
              key={to}
              to={to}
              className={`${bg} rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group border border-transparent hover:border-gray-100`}
            >
              <div className={`w-10 h-10 rounded-xl ${bg.replace('hover:bg', 'bg').split(' ')[0].replace('50', '100')} flex items-center justify-center`}>
                <Icon className={text} size={20} />
              </div>
              <div>
                <p className={`font-bold text-sm ${text}`}>{label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
              <FiChevronRight className={`${text} opacity-0 group-hover:opacity-100 transition-opacity self-end`} size={16} />
            </Link>
          ))}
        </div>
      </div>

      {/* All upcoming list */}
      {!loading && upcoming.length > 1 && (
        <div className="animate-slide-up" style={{ animationDelay: '240ms' }}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">All Upcoming</h2>
          <div className="space-y-2">
            {upcoming.slice(1).map((appt) => (
              <div key={appt.id} className="card py-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
                  <FiCalendar className="text-gray-400" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{appt.doctor_name}</p>
                  <p className="text-xs text-gray-400">{appt.slot_date} · {appt.slot_time}</p>
                </div>
                <SeverityBadge score={appt.severity_score} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
