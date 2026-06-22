import { useEffect, useState } from 'react'
import {
  listDoctorSlots,
  createDoctorSlot,
  bulkCreateDoctorSlots,
  closeDoctorSlot,
  deleteDoctorSlot,
} from '../api/client'
import { useToast } from '../context/ToastContext'
import { FiCalendar, FiPlus, FiX, FiTrash2, FiLock, FiZap, FiClock } from 'react-icons/fi'

const WEEKDAYS = [
  { iso: 1, label: 'Mon' }, { iso: 2, label: 'Tue' }, { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' }, { iso: 5, label: 'Fri' }, { iso: 6, label: 'Sat' }, { iso: 7, label: 'Sun' },
]

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

/* ── Bulk create form ──────────────────────────────────────────────── */
function BulkCreateForm({ onCreated }) {
  const toast = useToast()
  const today = new Date()
  const inTwoWeeks = new Date(today.getTime() + 13 * 86400000)
  const [form, setForm] = useState({
    start_date: toISODate(today),
    end_date: toISODate(inTwoWeeks),
    start_time: '09:00',
    end_time: '17:00',
    duration_minutes: 30,
    weekdays: [1, 2, 3, 4, 5],
  })
  const [submitting, setSubmitting] = useState(false)

  const toggleDay = (iso) => {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(iso) ? f.weekdays.filter((d) => d !== iso) : [...f.weekdays, iso].sort(),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.weekdays.length) {
      toast.error('Select at least one weekday.')
      return
    }
    setSubmitting(true)
    try {
      const res = await bulkCreateDoctorSlots({
        ...form,
        start_time: `${form.start_time}:00`,
        end_time: `${form.end_time}:00`,
        duration_minutes: Number(form.duration_minutes),
      })
      const { created, skipped_existing } = res.data
      toast.success(
        `${created} slot${created !== 1 ? 's' : ''} created${skipped_existing ? ` (${skipped_existing} already existed)` : ''}.`,
        'Schedule Generated'
      )
      onCreated()
    } catch (err) {
      toast.error(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || 'Could not generate slots.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
          <FiZap className="text-primary-600" size={16} />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Generate Recurring Slots</p>
          <p className="text-xs text-gray-400">e.g. every weekday, 9–5, 30-minute visits</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="bulk-start-date" className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input id="bulk-start-date" type="date" className="input-field text-sm" value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
        </div>
        <div>
          <label htmlFor="bulk-end-date" className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input id="bulk-end-date" type="date" className="input-field text-sm" value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
        </div>
        <div>
          <label htmlFor="bulk-start-time" className="block text-xs font-medium text-gray-600 mb-1">Day starts</label>
          <input id="bulk-start-time" type="time" className="input-field text-sm" value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
        </div>
        <div>
          <label htmlFor="bulk-end-time" className="block text-xs font-medium text-gray-600 mb-1">Day ends</label>
          <input id="bulk-end-time" type="time" className="input-field text-sm" value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
        </div>
      </div>

      <div>
        <p className="block text-xs font-medium text-gray-600 mb-1.5">Days of the week</p>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Days of the week">
          {WEEKDAYS.map(({ iso, label }) => (
            <button
              key={iso}
              type="button"
              onClick={() => toggleDay(iso)}
              aria-pressed={form.weekdays.includes(iso)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                form.weekdays.includes(iso)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="bulk-duration" className="block text-xs font-medium text-gray-600 mb-1">Visit duration</label>
        <select id="bulk-duration" className="input-field text-sm" value={form.duration_minutes}
          onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option>
        </select>
      </div>

      <button type="submit" className="btn-primary w-full text-sm" disabled={submitting}>
        {submitting ? 'Generating…' : 'Generate Slots'}
      </button>
    </form>
  )
}

/* ── Single slot form ──────────────────────────────────────────────── */
function SingleSlotForm({ onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ date: toISODate(new Date()), start_time: '09:00', duration_minutes: 30 })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createDoctorSlot({
        ...form,
        start_time: `${form.start_time}:00`,
        duration_minutes: Number(form.duration_minutes),
      })
      toast.success('Slot added to your schedule.', 'Slot Created')
      onCreated()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not create the slot.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <FiPlus className="text-violet-600" size={16} />
        </div>
        <p className="font-bold text-gray-900 text-sm">Add a Single Slot</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="single-date" className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input id="single-date" type="date" className="input-field text-sm" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div>
          <label htmlFor="single-time" className="block text-xs font-medium text-gray-600 mb-1">Start time</label>
          <input id="single-time" type="time" className="input-field text-sm" value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
        </div>
      </div>
      <button type="submit" className="btn-secondary w-full text-sm" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add Slot'}
      </button>
    </form>
  )
}

/* ── Main page ─────────────────────────────────────────────────────── */
export default function DoctorSchedule() {
  const toast = useToast()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState({})

  const fetchSlots = async () => {
    try {
      const res = await listDoctorSlots()
      setSlots(res.data)
    } catch {
      toast.error('Could not load your slots. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSlots() }, [])

  const handleClose = async (id) => {
    setActing((p) => ({ ...p, [id]: true }))
    try {
      await closeDoctorSlot(id)
      toast.info('Slot closed - patients can no longer book it.')
      fetchSlots()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not close the slot.')
    } finally {
      setActing((p) => ({ ...p, [id]: false }))
    }
  }

  const handleDelete = async (id) => {
    setActing((p) => ({ ...p, [id]: true }))
    try {
      await deleteDoctorSlot(id)
      toast.success('Slot removed from your schedule.')
      fetchSlots()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete the slot.')
    } finally {
      setActing((p) => ({ ...p, [id]: false }))
    }
  }

  // Group slots by date
  const grouped = slots.reduce((acc, s) => {
    (acc[s.date] = acc[s.date] || []).push(s)
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
        <p className="text-gray-400 text-sm mt-1">Define when patients can book you - in bulk or one slot at a time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Forms column */}
        <div className="space-y-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
          <BulkCreateForm onCreated={fetchSlots} />
          <SingleSlotForm onCreated={fetchSlots} />
        </div>

        {/* Slots column */}
        <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">Upcoming Slots</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="card"><div className="skeleton h-12" /></div>)}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiCalendar className="text-gray-300" size={28} />
              </div>
              <p className="font-semibold text-gray-600">No upcoming slots</p>
              <p className="text-sm text-gray-400 mt-1">Generate your schedule to start receiving bookings.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([date, daySlots]) => (
                <div key={date}>
                  <p className="text-xs font-bold text-gray-700 mb-2">
                    {parseLocalDate(date)?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`group flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                          slot.is_available
                            ? 'bg-white border-gray-200 text-gray-700'
                            : 'bg-gray-50 border-gray-100 text-gray-400'
                        }`}
                      >
                        <FiClock size={11} className={slot.is_available ? 'text-primary-500' : 'text-gray-300'} />
                        {fmtTime(slot.start_time)}
                        {!slot.is_available && <span className="text-[10px] uppercase tracking-wide">(booked/closed)</span>}
                        {slot.is_available && (
                          <span className="flex">
                            <button
                              onClick={() => handleClose(slot.id)}
                              disabled={!!acting[slot.id]}
                              className="p-1 rounded-md hover:bg-amber-50 text-gray-300 hover:text-amber-600 transition-colors"
                              aria-label={`Close ${fmtTime(slot.start_time)} slot on ${date}`}
                              title="Close (stop new bookings)"
                            >
                              <FiLock size={11} />
                            </button>
                            <button
                              onClick={() => handleDelete(slot.id)}
                              disabled={!!acting[slot.id]}
                              className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                              aria-label={`Delete ${fmtTime(slot.start_time)} slot on ${date}`}
                              title="Delete slot"
                            >
                              <FiTrash2 size={11} />
                            </button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
