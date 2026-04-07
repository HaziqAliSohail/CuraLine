import { useEffect, useState } from 'react'
import { listRescheduleRequests, acceptReschedule, declineReschedule } from '../api/client'
import { FiCalendar, FiClock, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi'

export default function Reschedule() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchRequests = async () => {
    try {
      const res = await listRescheduleRequests()
      setRequests(res.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleAccept = async (id) => {
    setActionLoading(id)
    try {
      await acceptReschedule(id)
      fetchRequests()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async (id) => {
    setActionLoading(id)
    try {
      await declineReschedule(id)
      fetchRequests()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to decline.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reschedule Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          A critically ill patient may need your slot. You can help by switching to a different time.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="card text-center py-12">
          <FiAlertCircle className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500">No reschedule requests at the moment.</p>
          <p className="text-sm text-gray-400 mt-1">
            You&apos;ll see requests here if a critical patient needs your time slot.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="card border-l-4 border-l-amber-400">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FiAlertCircle size={16} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    Reschedule Request
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    A patient with a more critical condition needs your current slot.
                    Would you be willing to move to the proposed time below?
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Proposed new slot:</p>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {req.proposed_slot_date && (
                    <span className="flex items-center gap-1">
                      <FiCalendar size={14} />
                      {req.proposed_slot_date}
                    </span>
                  )}
                  {req.proposed_slot_time && (
                    <span className="flex items-center gap-1">
                      <FiClock size={14} />
                      {req.proposed_slot_time}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAccept(req.id)}
                  disabled={actionLoading === req.id}
                  className="btn-primary flex items-center gap-1.5 text-sm"
                >
                  <FiCheck size={14} />
                  Accept &amp; Switch
                </button>
                <button
                  onClick={() => handleDecline(req.id)}
                  disabled={actionLoading === req.id}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  <FiX size={14} />
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
