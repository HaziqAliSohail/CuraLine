import { useEffect, useState } from 'react'
import { listDoctors, listSlots } from '../api/client'
import { FiStar, FiClock, FiCalendar, FiSearch, FiDollarSign } from 'react-icons/fi'

const availabilityColors = {
  AVAILABLE: 'bg-green-100 text-green-700',
  LEAVE: 'bg-yellow-100 text-yellow-700',
  OFFLINE: 'bg-gray-100 text-gray-500',
}

export default function Doctors() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedDoctor, setExpandedDoctor] = useState(null)
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const params = search ? { specialization: search } : {}
        const res = await listDoctors(params)
        setDoctors(res.data)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchDoctors()
  }, [search])

  const toggleSlots = async (doctorId) => {
    if (expandedDoctor === doctorId) {
      setExpandedDoctor(null)
      setSlots([])
      return
    }
    setExpandedDoctor(doctorId)
    setSlotsLoading(true)
    try {
      const res = await listSlots({ doctor_id: doctorId, available_only: true })
      setSlots(res.data)
    } catch {
      setSlots([])
    } finally {
      setSlotsLoading(false)
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
        <h1 className="text-2xl font-bold text-gray-900">Our Doctors</h1>
        <p className="text-sm text-gray-500 mt-1">Browse doctors and their available slots.</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          className="input-field pl-10"
          placeholder="Filter by specialization (e.g. Cardiology)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {doctors.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No doctors found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {doctors.map((doc) => (
            <div key={doc.id} className="card">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {doc.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${availabilityColors[doc.availability_status]}`}>
                      {doc.availability_status}
                    </span>
                  </div>
                  <p className="text-sm text-primary-600 font-medium">{doc.specialization}</p>
                  <p className="text-xs text-gray-500">{doc.qualification}</p>

                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FiStar size={12} className="text-amber-400" />
                      {doc.rating}/5
                    </span>
                    <span className="flex items-center gap-1">
                      <FiDollarSign size={12} />
                      {doc.consultation_fee}
                    </span>
                    <span className="flex items-center gap-1">
                      <FiClock size={12} />
                      {doc.reporting_time} &ndash; {doc.leaving_time}
                    </span>
                  </div>
                </div>

                {/* View slots */}
                <button
                  onClick={() => toggleSlots(doc.id)}
                  className="btn-secondary text-sm flex items-center gap-1.5"
                >
                  <FiCalendar size={14} />
                  {expandedDoctor === doc.id ? 'Hide Slots' : 'View Slots'}
                </button>
              </div>

              {/* Expanded slots */}
              {expandedDoctor === doc.id && (
                <div className="mt-4 pt-4 border-t">
                  {slotsLoading ? (
                    <p className="text-sm text-gray-400">Loading slots...</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-gray-400">No available slots.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center"
                        >
                          <p className="text-sm font-medium text-gray-900">{slot.date}</p>
                          <p className="text-xs text-gray-600">{slot.start_time}</p>
                          <p className="text-xs text-gray-400">{slot.duration_minutes} min</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
