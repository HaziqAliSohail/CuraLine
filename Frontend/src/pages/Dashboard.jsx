import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listUpcomingAppointments, listRescheduleRequests, listNearbyHospitals, listAppointments } from '../api/client'
import { FiMessageSquare, FiCalendar, FiUsers, FiAlertTriangle, FiClock, FiUser, FiChevronRight, FiMapPin, FiPhone } from 'react-icons/fi'
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
  const [countdown, setCountdown] = useState('')
  const [urgency, setUrgency] = useState('green')

  useEffect(() => {
    if (!appointment || !appointment.slot_date || !appointment.slot_time) return

    const updateCountdown = () => {
      const [hour, minute, second] = appointment.slot_time.split(':').map(Number)
      const [year, month, day] = appointment.slot_date.split('-').map(Number)
      const apptDateTime = new Date(year, month - 1, day, hour, minute, second || 0)
      
      const now = new Date()
      const diffMs = apptDateTime - now
      
      if (diffMs <= 0) {
        setCountdown('In progress')
        setUrgency('red')
        return
      }

      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      let text = ''
      if (diffDays > 0) {
        text = `in ${diffDays}d ${diffHours % 24}h`
        setUrgency('green')
      } else if (diffHours > 0) {
        text = `in ${diffHours}h ${diffMins % 60}m`
        setUrgency(diffHours >= 2 ? 'amber' : 'red')
      } else {
        text = `in ${diffMins}m`
        setUrgency('red')
      }
      setCountdown(text)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000)
    return () => clearInterval(interval)
  }, [appointment])

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
    : '-'

  const slotTime = appointment.slot_time
    ? new Date(`1970-01-01T${appointment.slot_time}`).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
      })
    : '-'

  return (
    <div className="card-glass overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -translate-y-8 translate-x-8" />
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-semibold text-primary-600 uppercase tracking-widest">Next Appointment</p>
        {countdown && (
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
            urgency === 'red' ? 'bg-red-50 text-red-600 animate-pulse' :
            urgency === 'amber' ? 'bg-amber-50 text-amber-600' :
            'bg-emerald-50 text-emerald-600'
          }`}>
            {countdown}
          </span>
        )}
      </div>
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

function HealthSummaryCard({ appointments }) {
  const completed = appointments.filter(a => a.status === 'COMPLETED')
  const noShow = appointments.filter(a => a.status === 'NO_SHOW')
  const severityEligible = appointments.filter(a => a.status === 'COMPLETED' || a.status === 'SCHEDULED')
  const avgSeverity = severityEligible.length > 0 
    ? (severityEligible.reduce((acc, a) => acc + a.severity_score, 0) / severityEligible.length).toFixed(1)
    : '0.0'

  let daysSinceLast = 'No past visits'
  if (completed.length > 0) {
    const dates = completed.map(a => new Date(a.slot_date).getTime())
    const maxDate = Math.max(...dates)
    const diffTime = Math.abs(new Date().setHours(0,0,0,0) - new Date(maxDate).setHours(0,0,0,0))
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    daysSinceLast = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '30ms' }}>
      <div className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100/80 flex flex-col justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed Visits</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{completed.length}</p>
        </div>
        <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md mt-3 self-start">
          Completed
        </div>
      </div>
      
      <div className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100/80 flex flex-col justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Missed Visits</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{noShow.length}</p>
        </div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md mt-3 self-start ${noShow.length > 0 ? 'text-rose-600 bg-rose-50' : 'text-gray-400 bg-gray-50'}`}>
          {noShow.length > 0 ? 'No-Show' : 'None'}
        </div>
      </div>

      <div className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100/80 flex flex-col justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Avg Severity</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{avgSeverity}</p>
        </div>
        <div className="text-[10px] text-primary-600 font-bold bg-primary-50 px-2 py-0.5 rounded-md mt-3 self-start">
          Scale 1-10
        </div>
      </div>

      <div className="card bg-white p-4 rounded-2xl shadow-sm border border-gray-100/80 flex flex-col justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Checkup</p>
          <p className="text-sm font-bold text-gray-900 mt-2.5 truncate">{daysSinceLast}</p>
        </div>
        <div className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md mt-3 self-start">
          Interval
        </div>
      </div>
    </div>
  )
}

function RescheduleAlert({ requests }) {
  if (!requests || requests.length === 0) return null
  const count = requests.length
  const hasUpgrade = requests.some((r) => r.triggering_appointment_id === r.target_appointment_id)

  if (hasUpgrade) {
    return (
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <FiClock className="text-primary-600" size={18} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-primary-800 text-sm">
            Earlier Slot Available!
          </p>
          <p className="text-primary-600 text-xs mt-0.5">We optimized the queue and found an earlier appointment slot for you.</p>
        </div>
        <Link to="/reschedule" className="btn-primary text-sm py-2 px-3">Review & Upgrade</Link>
      </div>
    )
  }

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

function NearestFacilityCard() {
  const [nearest, setNearest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isGps, setIsGps] = useState(false)

  useEffect(() => {
    const fetchLocationAndFacility = async () => {
      setLoading(true)
      const getCoords = () => {
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve({ latitude: 40.7580, longitude: -73.9855, isGps: false })
            return
          }
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                isGps: true,
              })
            },
            () => {
              resolve({ latitude: 40.7580, longitude: -73.9855, isGps: false })
            },
            { timeout: 8000 }
          )
        })
      }

      const coords = await getCoords()
      setIsGps(coords.isGps)

      try {
        const res = await listNearbyHospitals({
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
        if (res.data && res.data.length > 0) {
          setNearest(res.data[0])
        }
      } catch (err) {
        // silent
      } finally {
        setLoading(false)
      }
    }

    fetchLocationAndFacility()
  }, [])

  if (loading) {
    return (
      <div className="card-glass animate-pulse">
        <div className="skeleton h-4 w-36 mb-4" />
        <div className="flex gap-4">
          <div className="skeleton w-12 h-12 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  if (!nearest) return null

  return (
    <div className="card-glass overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-8 translate-x-8" />
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">
          Nearest Care Facility
        </p>
        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {isGps ? '📍 GPS active' : '📍 New York Center'}
        </span>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/30">
          <FiMapPin className="text-white" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <p className="font-bold text-gray-900 text-lg truncate">{nearest.name}</p>
            {nearest.distance !== null && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg flex-shrink-0">
                {nearest.distance} mi
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1">{nearest.address}</p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-400">
            {nearest.phone && (
              <span className="flex items-center gap-1.5">
                <FiPhone size={13} /> {nearest.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <FiUsers size={13} /> {nearest.doctor_count} provider{nearest.doctor_count !== 1 ? 's' : ''} available
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <Link
          to={`/doctors?hospital_id=${nearest.id}`}
          className="btn-primary text-xs py-2 px-3 flex items-center gap-1"
        >
          Browse Doctors Here <FiChevronRight size={12} />
        </Link>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [upcoming, setUpcoming] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [allAppointments, setAllAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [apptRes, reschedRes, allRes] = await Promise.all([
        listUpcomingAppointments(),
        listRescheduleRequests(),
        listAppointments(),
      ])
      setUpcoming(apptRes.data)
      setPendingRequests(reschedRes.data)
      setAllAppointments(allRes.data)
    } catch {
      // silent - partials OK
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

      {/* Health Summary */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-24 skeleton" />
          ))}
        </div>
      ) : (
        <HealthSummaryCard appointments={allAppointments} />
      )}

      {/* Reschedule alert */}
      <div className="animate-slide-up" style={{ animationDelay: '60ms' }}>
        <RescheduleAlert requests={pendingRequests} />
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

      {/* Nearest Care Facility */}
      <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
        <NearestFacilityCard />
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
