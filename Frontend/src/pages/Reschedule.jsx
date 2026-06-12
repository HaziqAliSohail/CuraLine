import { useEffect, useState } from 'react'
import { listRescheduleRequests, acceptReschedule, declineReschedule } from '../api/client'
import { useToast } from '../context/ToastContext'
import { FiRefreshCw, FiArrowRight, FiCalendar, FiClock, FiAlertTriangle, FiCheck, FiX } from 'react-icons/fi'

function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [year, month, date] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, date)
}

function SlotTime({ date, time, label }) {
  const fmtDate = date
    ? parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '—'
  const fmtTime = time
    ? new Date(`1970-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '—'

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <FiCalendar size={12} className="text-gray-400" /> {fmtDate}
        </p>
        <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
          <FiClock size={11} className="text-gray-400" /> {fmtTime}
        </p>
      </div>
    </div>
  )
}

export default function Reschedule() {
  const toast = useToast()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})

  const fetchRequests = async () => {
    try {
      const res = await listRescheduleRequests()
      setRequests(res.data)
    } catch {
      toast.error('Could not load reschedule requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const handleAccept = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'accept' }))
    try {
      await acceptReschedule(id)
      toast.success(
        'Your appointment has been successfully moved to the new slot.',
        'Reschedule Accepted'
      )
      fetchRequests()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not accept the request.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }))
    }
  }

  const handleDecline = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'decline' }))
    try {
      await declineReschedule(id)
      toast.info(
        'You have declined the reschedule. Your appointment remains unchanged.',
        'Reschedule Declined'
      )
      fetchRequests()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not decline the request.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }))
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold text-gray-900">Reschedule Requests</h1>
        <p className="text-gray-400 text-sm mt-1">
          A critical patient has requested your time slot.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="skeleton h-4 w-1/2 mb-4" />
              <div className="grid grid-cols-2 gap-3">
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
              </div>
              <div className="skeleton h-10 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiRefreshCw className="text-gray-300" size={26} />
          </div>
          <p className="font-semibold text-gray-500">No pending reschedule requests</p>
          <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const acting = actionLoading[req.id]
            return (
              <div key={req.id} className="card animate-fade-in overflow-hidden">
                {/* Urgency notice */}
                <div className="flex items-center gap-2 mb-4 text-amber-700 bg-amber-50 -mx-6 -mt-6 px-5 py-3 border-b border-amber-100">
                  <FiAlertTriangle size={14} />
                  <p className="text-xs font-semibold">
                    A critical patient needs your appointment slot sooner
                  </p>
                </div>

                {/* Before → After slot comparison */}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Proposed slot swap
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <SlotTime
                    date={req.current_slot_date}
                    time={req.current_slot_time}
                    label="Your current slot"
                  />
                  <div className="flex items-center justify-center">
                    <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                      <FiArrowRight className="text-primary-600" size={13} />
                    </div>
                  </div>
                  <SlotTime
                    date={req.proposed_slot_date}
                    time={req.proposed_slot_time}
                    label="Proposed new slot"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => handleDecline(req.id)}
                    disabled={!!acting}
                    className="btn-secondary flex-1 disabled:opacity-50"
                    aria-label="Decline reschedule request"
                  >
                    {acting === 'decline' ? (
                      <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Declining…</span>
                    ) : (
                      <><FiX size={14} /> Decline</>
                    )}
                  </button>
                  <button
                    onClick={() => handleAccept(req.id)}
                    disabled={!!acting}
                    className="btn-primary flex-1 disabled:opacity-50"
                    aria-label="Accept reschedule request"
                  >
                    {acting === 'accept' ? (
                      <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Accepting…</span>
                    ) : (
                      <><FiCheck size={14} /> Accept & Move</>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
