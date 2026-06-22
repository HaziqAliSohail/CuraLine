import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getDoctorBriefing,
  listDoctorAppointments,
  listDoctorReschedules,
  recordOutcome,
  regenerateBriefing,
  getAppointmentVideo,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import {
  FiSunrise, FiChevronLeft, FiChevronRight, FiClock, FiCheck,
  FiUserX, FiChevronDown, FiPhone, FiFileText, FiRefreshCw, FiCalendar,
  FiCpu, FiAlertCircle, FiVideo,
} from 'react-icons/fi'

const SEVERITY_STRIP = {
  1: 'bg-emerald-400', 2: 'bg-lime-400', 3: 'bg-amber-400', 4: 'bg-orange-400', 5: 'bg-red-500',
}

function fmtTime(t) {
  return t ? new Date(`1970-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '-'
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
function AppointmentRow({ appt, isToday, isPastOrToday, onOutcome, acting, onRegenerate, onJoinVideo }) {
  const [expanded, setExpanded] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const strip = SEVERITY_STRIP[appt.severity_score] || SEVERITY_STRIP[1]

  const handleRegenerateClick = async (e) => {
    e.stopPropagation()
    setRegenerating(true)
    await onRegenerate(appt.id)
    setRegenerating(false)
  }

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

            {appt.status === 'SCHEDULED' && isPastOrToday && (
              <div className="flex gap-2">
                <button
                  onClick={() => onJoinVideo(appt.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
                >
                  <FiVideo size={12} /> Video
                </button>
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

              {/* AI Prep Briefing Card */}
              <div className="mt-3 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 shadow-sm shadow-indigo-500/5 animate-fade-in relative">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                    <FiCpu size={14} className={`text-indigo-600 ${regenerating ? 'animate-spin' : 'animate-pulse'}`} />
                    AI Doctor Prep Briefing
                  </p>
                  <button
                    onClick={handleRegenerateClick}
                    disabled={regenerating}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    aria-label="Regenerate AI Triage"
                  >
                    <FiRefreshCw size={10} className={regenerating ? 'animate-spin' : ''} />
                    {regenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                </div>
                {appt.clinical_summary ? (
                  <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                    {appt.clinical_summary}
                  </p>
                ) : (
                  <p className="text-xs text-indigo-400 italic leading-relaxed">
                    AI briefing is not available. Click Regenerate to build one.
                  </p>
                )}
              </div>

              {/* No-Show Attendance Card */}
              {appt.no_show_probability !== undefined && appt.no_show_probability !== null ? (
                <div className="mt-2.5 bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-start gap-3 shadow-sm shadow-gray-500/5 animate-fade-in">
                  <div className="mt-0.5">
                    <FiAlertCircle size={15} className={
                      appt.no_show_probability >= 0.7 ? 'text-red-500' :
                      appt.no_show_probability >= 0.3 ? 'text-amber-500' : 'text-emerald-500'
                    } />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      No-Show Risk:{' '}
                      <span className={
                        appt.no_show_probability >= 0.7 ? 'text-red-600 font-extrabold' :
                        appt.no_show_probability >= 0.3 ? 'text-amber-600 font-extrabold' : 'text-emerald-600 font-extrabold'
                      }>
                        {Math.round(appt.no_show_probability * 100)}%
                      </span>
                    </p>
                    {appt.no_show_risk_reason && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {appt.no_show_risk_reason}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-start gap-3 shadow-sm shadow-gray-500/5 animate-fade-in">
                  <div className="mt-0.5">
                    <FiAlertCircle size={15} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-700">No-Show Risk: Not calculated</p>
                    <p className="text-xs text-gray-400 italic mt-0.5">Click Regenerate above to calculate attendance risk.</p>
                  </div>
                </div>
              )}
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
  const isPastOrToday = day <= today

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

  const handleJoinVideo = async (id) => {
    try {
      const { data } = await getAppointmentVideo(id)
      if (data.enabled && data.url) {
        window.open(data.url, '_blank', 'noopener')
      } else {
        const notify = toast.info || toast.success || toast.error
        notify(data.message || "Video visits aren't enabled yet.")
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not start the video visit.')
    }
  }

  const handleRegenerate = async (id) => {
    try {
      const res = await regenerateBriefing(id)
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...res.data } : a))
      )
      toast.success('AI Triage insights regenerated successfully.', 'Regenerated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not regenerate AI Triage.')
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
          Schedule - {dayLabel}
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
              isPastOrToday={isPastOrToday}
              onOutcome={handleOutcome}
              acting={outcomeLoading[appt.id]}
              onRegenerate={handleRegenerate}
              onJoinVideo={handleJoinVideo}
            />
          ))}
        </div>
      )}
    </div>
  )
}
