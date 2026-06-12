import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getDoctorBriefing,
  listDoctorAppointments,
  listDoctorReschedules,
  recordOutcome,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import {
  FiSunrise, FiChevronLeft, FiChevronRight, FiClock, FiCheck,
  FiUserX, FiChevronDown, FiPhone, FiFileText, FiRefreshCw, FiCalendar,
} from 'react-icons/fi'

const SEVERITY_STRIP = {
  1: 'bg-emerald-400', 2: 'bg-lime-400', 3: 'bg-amber-400', 4: 'bg-orange-400', 5: 'bg-red-500',
}

function fmtTime(t) {
  return t ? new Date(`1970-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'
}

function toISODate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [year, month, date] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, date)
}

/* ── Morning briefing card ─────────────────────────────────────────── */
function BriefingCard({ briefing, loading }) {
  if (loading) {
    return (
      <div className="card-glass">
        <div className="skeleton h-5 w-40 mb-3" />
        <div className="skeleton h-4 w-full mb-2" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    )
  }
  if (!briefing) return null

  const mix = [
    { label: 'Critical', count: briefing.critical_count, color: 'bg-red-50 text-red-700' },
    { label: 'Moderate', count: briefing.moderate_count, color: 'bg-amber-50 text-amber-700' },
    { label: 'Routine',  count: briefing.routine_count,  color: 'bg-emerald-50 text-emerald-700' },
  ]

  return (
    <div className="card-glass relative overflow-hidden">
      <div className="absolute top-0 right-0 w-36 h-36 bg-primary-500/5 rounded-full -translate-y-10 translate-x-10" />
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/30">
          <FiSunrise className="text-white" size={17} />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Morning Briefing</p>
          <p className="text-xs text-gray-400">
            {parseLocalDate(briefing.date)?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{briefing.summary}</p>
      {briefing.total_appointments > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {mix.filter((m) => m.count > 0).map((m) => (
            <span key={m.label} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${m.color}`}>
              {m.count} {m.label}
            </span>
          ))}
          {briefing.first_appointment_time && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 flex items-center gap-1">
              <FiClock size={11} /> First at {fmtTime(briefing.first_appointment_time)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Appointment row with expandable triage intel ──────────────────── */
function AppointmentRow({ appt, isToday, onOutcome, acting }) {
  const [expanded, setExpanded] = useState(false)
  const strip = SEVERITY_STRIP[appt.severity_score] || SEVERITY_STRIP[1]

  return (
    <div className="card !p-0 overflow-hidden animate-fade-in">
      <div className="flex">
        {/* Severity heat strip */}
        <div className={`w-1.5 flex-shrink-0 ${strip}`} aria-hidden="true" />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900">{fmtTime(appt.slot_time)}</p>
                <p className="font-semibold text-gray-700 truncate">{appt.patient_name || 'Patient'}</p>
                <SeverityBadge score={appt.severity_score} />
              </div>
              {appt.reason && (
                <p className="text-sm text-gray-500 mt-1 truncate">{appt.reason}</p>
              )}
            </div>
            <StatusBadge status={appt.status} />
          </div>

          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
              aria-expanded={expanded}
            >
              <FiChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Hide patient details' : 'Patient details'}
            </button>

            {appt.status === 'SCHEDULED' && isToday && (
              <div className="flex gap-2">
                <button
                  onClick={() => onOutcome(appt.id, 'NO_SHOW')}
                  disabled={!!acting}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <FiUserX size={12} /> No-show
                </button>
                <button
                  onClick={() => onOutcome(appt.id, 'COMPLETED')}
                  disabled={!!acting}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <FiCheck size={12} /> {acting === 'COMPLETED' ? 'Saving…' : 'Complete'}
                </button>
              </div>
            )}
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 animate-fade-in">
              {appt.patient_phone && (
                <p className="text-xs text-gray-600 flex items-center gap-2">
                  <FiPhone size={12} className="text-gray-400" />
                  <a href={`tel:${appt.patient_phone}`} className="hover:text-primary-600">{appt.patient_phone}</a>
                </p>
              )}
              <div className="text-xs text-gray-600 flex items-start gap-2">
                <FiFileText size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="whitespace-pre-wrap leading-relaxed">
                  {appt.patient_medical_history || 'No medical history on file.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Reschedule activity ───────────────────────────────────────────── */
function RescheduleActivity({ requests }) {
  if (!requests.length) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-1.5">
        <FiRefreshCw className="text-amber-600" size={15} />
        <p className="font-semibold text-amber-800 text-sm">
          {requests.length} pending severity swap{requests.length !== 1 ? 's' : ''} on your calendar
        </p>
      </div>
      <p className="text-xs text-amber-700 leading-relaxed">
        A critical patient has asked lower-priority patients to switch slots. Your schedule
        will update automatically when a patient accepts.
      </p>
    </div>
  )
}

export default function DoctorDashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const [briefing, setBriefing] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [reschedules, setReschedules] = useState([])
  const [day, setDay] = useState(() => toISODate(new Date()))
  const [loading, setLoading] = useState(true)
  const [outcomeLoading, setOutcomeLoading] = useState({})

  const today = toISODate(new Date())
  const isToday = day === today

  const loadDay = async (targetDay) => {
    try {
      const res = await listDoctorAppointments(targetDay)
      setAppointments(res.data)
    } catch {
      toast.error('Could not load your schedule. Please refresh.')
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const [briefRes, reschedRes] = await Promise.all([getDoctorBriefing(), listDoctorReschedules()])
        setBriefing(briefRes.data)
        setReschedules(reschedRes.data)
      } catch {
        // briefing is non-critical; schedule load shows its own error
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => { loadDay(day) }, [day])

  const shiftDay = (delta) => {
    const d = parseLocalDate(day)
    if (!d) return
    d.setDate(d.getDate() + delta)
    setDay(toISODate(d))
  }

  const handleOutcome = async (id, status) => {
    setOutcomeLoading((prev) => ({ ...prev, [id]: status }))
    try {
      await recordOutcome(id, status)
      toast.success(
        status === 'COMPLETED' ? 'Visit marked as completed.' : 'Patient marked as no-show.',
        'Outcome Recorded'
      )
      loadDay(day)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not record the outcome.')
    } finally {
      setOutcomeLoading((prev) => ({ ...prev, [id]: null }))
    }
  }

  const dayLabel = isToday
    ? 'Today'
    : parseLocalDate(day)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, <span className="text-primary-600">{user?.name}</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">{user?.specialization} · {user?.qualification}</p>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '60ms' }}>
        <BriefingCard briefing={briefing} loading={loading} />
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
        <RescheduleActivity requests={reschedules} />
      </div>

      {/* Day navigator */}
      <div className="flex items-center justify-between animate-slide-up" style={{ animationDelay: '160ms' }}>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
          Schedule — {dayLabel}
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftDay(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Previous day">
            <FiChevronLeft size={16} />
          </button>
          {!isToday && (
            <button onClick={() => setDay(today)} className="text-xs font-semibold text-primary-600 px-2 py-1 rounded-lg hover:bg-primary-50">
              Today
            </button>
          )}
          <button onClick={() => shiftDay(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Next day">
            <FiChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day schedule */}
      {appointments.length === 0 ? (
        <div className="text-center py-14 animate-fade-in">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiCalendar className="text-gray-300" size={28} />
          </div>
          <p className="font-semibold text-gray-600">No appointments {isToday ? 'today' : 'on this day'}</p>
          <p className="text-sm text-gray-400 mt-1">
            Open slots stay bookable for patients.{' '}
            <Link to="/doctor/schedule" className="text-primary-600 font-medium hover:text-primary-700">Manage your schedule →</Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <AppointmentRow
              key={appt.id}
              appt={appt}
              isToday={isToday}
              onOutcome={handleOutcome}
              acting={outcomeLoading[appt.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
