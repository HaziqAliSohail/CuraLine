import { useEffect, useState } from 'react'
import { getDoctorAnalytics } from '../api/client'
import { useToast } from '../context/ToastContext'
import { FiCheckCircle, FiUserX, FiActivity, FiCalendar, FiTrendingUp } from 'react-icons/fi'

const WINDOWS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
]

const SEVERITY_COLORS = {
  1: 'bg-emerald-400', 2: 'bg-lime-400', 3: 'bg-amber-400', 4: 'bg-orange-400', 5: 'bg-red-500',
}
const SEVERITY_LABELS = { 1: 'Routine', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Critical' }

function StatCard({ icon: Icon, iconBg, iconColor, label, value, hint }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={iconColor} size={14} />
        </div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function DoctorInsights() {
  const toast = useToast()
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getDoctorAnalytics(days)
      .then((res) => setData(res.data))
      .catch(() => toast.error('Could not load your practice insights.'))
      .finally(() => setLoading(false))
  }, [days])

  const maxSeverityCount = data
    ? Math.max(1, ...Object.values(data.severity_counts))
    : 1

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Practice Insights</h1>
          <p className="text-gray-400 text-sm mt-1">
            Built on outcomes you record - accurate by construction.
          </p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Time window">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setDays(w.days)}
              aria-pressed={days === w.days}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                days === w.days ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="card"><div className="skeleton h-16" /></div>)}
        </div>
      ) : data.total_appointments === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiTrendingUp className="text-gray-300" size={28} />
          </div>
          <p className="font-semibold text-gray-600">No appointment data in this window</p>
          <p className="text-sm text-gray-400 mt-1">
            Insights appear as visits are booked and you record outcomes.
          </p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>
            <StatCard
              icon={FiCheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              label="Completed" value={data.completed}
              hint={`of ${data.total_appointments} total`}
            />
            <StatCard
              icon={FiUserX} iconBg="bg-red-50" iconColor="text-red-500"
              label="No-show rate"
              value={data.no_show_rate !== null ? `${data.no_show_rate}%` : '-'}
              hint={data.no_show_rate !== null ? `${data.no_show} no-show${data.no_show !== 1 ? 's' : ''}` : 'No outcomes recorded yet'}
            />
            <StatCard
              icon={FiActivity} iconBg="bg-amber-50" iconColor="text-amber-600"
              label="Avg severity"
              value={data.avg_severity !== null ? `${data.avg_severity}/5` : '-'}
              hint="Across non-cancelled visits"
            />
            <StatCard
              icon={FiCalendar} iconBg="bg-violet-50" iconColor="text-violet-600"
              label="Busiest day" value={data.busiest_weekday || '-'}
              hint={`${data.scheduled} still scheduled`}
            />
          </div>

          {/* Severity mix */}
          <div className="card animate-slide-up" style={{ animationDelay: '120ms' }}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Case mix by severity
            </p>
            <div className="space-y-2.5">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = data.severity_counts[s] || 0
                const pct = Math.round((count / maxSeverityCount) * 100)
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-600 w-16 flex-shrink-0">
                      {s} · {SEVERITY_LABELS[s]}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${SEVERITY_COLORS[s]} transition-all duration-500`}
                        style={{ width: `${count ? Math.max(pct, 4) : 0}%` }}
                        role="img"
                        aria-label={`Severity ${s}: ${count} visit${count !== 1 ? 's' : ''}`}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
