import { useEffect, useState } from 'react'
import { listAppointments, cancelAppointment } from '../api/client'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import { FiCalendar, FiClock, FiUser, FiTrash2 } from 'react-icons/fi'

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAppointments = async () => {
    try {
      const res = await listAppointments()
      setAppointments(res.data)
    } catch {
      setError('Failed to load appointments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [])

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return
    try {
      await cancelAppointment(id)
      fetchAppointments()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel.')
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-sm text-gray-500 mt-1">
            {appointments.length} appointment{appointments.length !== 1 && 's'}
          </p>
        </div>
      </div>

      {error ? (
        <div className="card text-center py-12">
          <FiCalendar className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-gray-400 mt-1">Please check your connection and try again.</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="card text-center py-12">
          <FiCalendar className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500">No appointments yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Use the AI chat to book your first appointment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <div key={appt.id} className="card flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Left — info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <StatusBadge status={appt.status} />
                  <SeverityBadge score={appt.severity_score} />
                  {appt.reschedule_requested && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Reschedule Requested
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  {appt.doctor_name && (
                    <span className="flex items-center gap-1">
                      <FiUser size={14} />
                      {appt.doctor_name}
                    </span>
                  )}
                  {appt.slot_date && (
                    <span className="flex items-center gap-1">
                      <FiCalendar size={14} />
                      {appt.slot_date}
                    </span>
                  )}
                  {appt.slot_time && (
                    <span className="flex items-center gap-1">
                      <FiClock size={14} />
                      {appt.slot_time}
                    </span>
                  )}
                </div>

                {appt.reason && (
                  <p className="text-sm text-gray-500 mt-2 truncate">
                    Reason: {appt.reason}
                  </p>
                )}
              </div>

              {/* Right — actions */}
              {appt.status === 'SCHEDULED' && (
                <button
                  onClick={() => handleCancel(appt.id)}
                  className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  <FiTrash2 size={14} />
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
