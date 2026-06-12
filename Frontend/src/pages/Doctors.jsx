import { useEffect, useState } from 'react'
import { listDoctors, listSlots, createAppointment, getDoctorReviews } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { FiSearch, FiUser, FiStar, FiClock, FiCalendar, FiX, FiCheckCircle, FiShield, FiMessageCircle, FiFilter } from 'react-icons/fi'

function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [year, month, date] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, date)
}

function StarRating({ rating, max = 5 }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <FiStar
          key={i}
          size={12}
          className={i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}

function SlotPickerModal({ doctor, onClose }) {
  const toast = useToast()
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const res = await listSlots({ doctor_id: doctor.id, available_only: true })
        setSlots(res.data)
      } catch {
        toast.error('Could not load available slots.')
        onClose()
      } finally {
        setLoadingSlots(false)
      }
    }
    fetchSlots()
  }, [doctor.id])

  const handleBook = async (slotId) => {
    setBooking(true)
    try {
      await createAppointment({ slot_id: slotId, reason: 'Booked via doctor browser' })
      setBooked(true)
      toast.success(`Appointment with ${doctor.name} confirmed!`, 'Booked Successfully')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Booking failed. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slot-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-up max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 id="slot-modal-title" className="font-bold text-gray-900">{doctor.name}</h2>
            <p className="text-sm text-primary-600">{doctor.specialization}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close slot picker"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {booked ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiCheckCircle className="text-emerald-600" size={28} />
              </div>
              <p className="font-bold text-gray-900">Appointment Confirmed!</p>
              <p className="text-sm text-gray-400 mt-2">Check My Appointments for details.</p>
              <button onClick={onClose} className="btn-primary mt-5">Done</button>
            </div>
          ) : loadingSlots ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8">
              <FiCalendar className="text-gray-300 mx-auto mb-3" size={32} />
              <p className="font-semibold text-gray-600">No available slots</p>
              <p className="text-sm text-gray-400 mt-1">Try the AI booking which can find priority slots.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Select a time slot
              </p>
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => handleBook(slot.id)}
                  disabled={booking}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-all duration-150 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-9 h-9 bg-primary-50 group-hover:bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                    <FiCalendar className="text-primary-500" size={15} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">
                      {parseLocalDate(slot.date)?.toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <FiClock size={11} />
                      {new Date(`1970-01-01T${slot.start_time}`).toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit',
                      })}
                      {' · '}{slot.duration_minutes} min
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Book →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewsModal({ doctor, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    getDoctorReviews(doctor.id)
      .then((res) => setData(res.data))
      .catch(() => setData({ average_rating: 0, review_count: 0, reviews: [] }))
      .finally(() => setLoading(false))
  }, [doctor.id])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reviews-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-up max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 id="reviews-modal-title" className="font-bold text-gray-900">Patient Reviews</h2>
            <p className="text-sm text-primary-600">{doctor.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close reviews"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          ) : data.review_count === 0 ? (
            <div className="text-center py-8">
              <FiMessageCircle className="text-gray-300 mx-auto mb-3" size={30} />
              <p className="font-semibold text-gray-600">No reviews yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Reviews come only from patients who completed a visit.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <p className="text-3xl font-bold text-gray-900">{data.average_rating.toFixed(1)}</p>
                <div>
                  <StarRating rating={Math.round(data.average_rating)} />
                  <p className="text-xs text-gray-400 mt-0.5">
                    {data.review_count} verified review{data.review_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {data.reviews.map((r) => (
                  <div key={r.id} className="bg-gray-50 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">{r.patient_display_name}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                          <FiShield size={9} /> Verified visit
                        </span>
                      </div>
                      <StarRating rating={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="text-xs text-gray-600 leading-relaxed">{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const INSURANCE_PLANS = [
  'Blue Cross Blue Shield',
  'Aetna',
  'Cigna',
  'UnitedHealthcare',
  'Humana',
  'Medicare',
  'Medicaid',
  'Self-Pay / Uninsured',
]

export default function Doctors() {
  const { user } = useAuth()
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [insuranceFilter, setInsuranceFilter] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [reviewsDoctor, setReviewsDoctor] = useState(null)

  // Auto-default insurance filter to the patient's own plan
  useEffect(() => {
    if (user?.insurance_plan && !insuranceFilter) {
      setInsuranceFilter(user.insurance_plan)
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (insuranceFilter) params.insurance = insuranceFilter
    listDoctors(params)
      .then((res) => setDoctors(res.data))
      .finally(() => setLoading(false))
  }, [insuranceFilter])

  const filtered = doctors.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold text-gray-900">Browse Doctors</h1>
        <p className="text-gray-400 text-sm mt-1">Find specialists and book directly.</p>
      </div>

      {/* Insurance filter + Search */}
      <div className="space-y-3 mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <FiFilter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <select
              id="insurance-filter"
              className="input-field pl-10 pr-4 appearance-none"
              value={insuranceFilter}
              onChange={(e) => setInsuranceFilter(e.target.value)}
              aria-label="Filter by insurance plan"
            >
              <option value="">All insurance plans</option>
              {INSURANCE_PLANS.map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>
          </div>
          {insuranceFilter && (
            <button
              onClick={() => setInsuranceFilter('')}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors whitespace-nowrap"
            >
              <FiX size={12} /> Clear
            </button>
          )}
        </div>
        <div className="relative">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            id="doctor-search"
            type="text"
            className="input-field pl-10"
            placeholder="Search by name or specialization…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search doctors"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex gap-3">
                <div className="skeleton w-12 h-12 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FiUser className="text-gray-200 mx-auto mb-4" size={40} />
          <p className="font-semibold text-gray-500">No doctors found</p>
          <p className="text-sm text-gray-400 mt-1">Try a different specialization or name.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <div key={doc.id} className="card hover:shadow-lg hover:shadow-gray-100 transition-all duration-200 flex flex-col animate-fade-in">
              {/* Status badge */}
              <div className="flex items-start justify-between mb-3">
                <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                  doc.availability_status === 'AVAILABLE'
                    ? 'bg-emerald-50 text-emerald-700'
                    : doc.availability_status === 'LEAVE'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {doc.availability_status}
                </div>
                <button
                  onClick={() => setReviewsDoctor(doc)}
                  className="flex flex-col items-end gap-0.5 group/rating"
                  aria-label={`See patient reviews for ${doc.name}`}
                >
                  <StarRating rating={doc.rating} />
                  <span className="text-[10px] text-primary-600 font-medium opacity-70 group-hover/rating:opacity-100">
                    Reviews →
                  </span>
                </button>
              </div>

              {/* Doctor info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-primary-700 text-lg">
                  {doc.name.charAt(4).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{doc.name}</p>
                  <p className="text-xs text-primary-600 font-medium">{doc.specialization}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{doc.qualification}</p>
                </div>
              </div>

              {/* Fee + Insurance */}
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700">
                  <span className="text-xs text-gray-400 font-normal">Consultation fee </span>
                  ${parseFloat(doc.consultation_fee).toFixed(0)}
                </div>
                {doc.accepted_insurance_plans?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {doc.accepted_insurance_plans.slice(0, 3).map((plan) => (
                      <span
                        key={plan}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700"
                      >
                        {plan}
                      </span>
                    ))}
                    {doc.accepted_insurance_plans.length > 3 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-500">
                        +{doc.accepted_insurance_plans.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Book button */}
              <button
                onClick={() => doc.availability_status === 'AVAILABLE' && setSelectedDoctor(doc)}
                disabled={doc.availability_status !== 'AVAILABLE'}
                className={`mt-auto w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  doc.availability_status === 'AVAILABLE'
                    ? 'btn-primary'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                aria-label={`Book appointment with ${doc.name}`}
              >
                {doc.availability_status === 'AVAILABLE' ? 'View Slots' : 'Unavailable'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Slot picker modal */}
      {selectedDoctor && (
        <SlotPickerModal
          doctor={selectedDoctor}
          onClose={() => setSelectedDoctor(null)}
        />
      )}

      {/* Reviews modal */}
      {reviewsDoctor && (
        <ReviewsModal
          doctor={reviewsDoctor}
          onClose={() => setReviewsDoctor(null)}
        />
      )}
    </div>
  )
}
