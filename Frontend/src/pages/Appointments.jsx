import { useEffect, useRef, useState } from 'react'
import { listAppointments, cancelAppointment, createReview, listMyReviews } from '../api/client'
import { useToast } from '../context/ToastContext'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import { FiCalendar, FiClock, FiUser, FiTrash2, FiX, FiAlertTriangle, FiStar } from 'react-icons/fi'

function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [year, month, date] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, date)
}

const FILTERS = ['All', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex gap-4">
        <div className="skeleton w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
          <div className="skeleton h-3 w-2/3" />
        </div>
      </div>
    </div>
  )
}

function CancelModal({ appointment, onConfirm, onCancel, loading }) {
  const keepButtonRef = useRef(null)

  // Close on Escape; focus the safe action on open and restore focus on close
  useEffect(() => {
    const previouslyFocused = document.activeElement
    keepButtonRef.current?.focus()
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      previouslyFocused?.focus?.()
    }
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center">
            <FiAlertTriangle className="text-red-600" size={20} />
          </div>
          <h2 id="cancel-dialog-title" className="font-bold text-gray-900">Cancel Appointment</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          Are you sure you want to cancel your appointment with{' '}
          <span className="font-semibold">{appointment?.doctor_name}</span>{' '}
          on{' '}
          <span className="font-semibold">
            {appointment?.slot_date
              ? parseLocalDate(appointment.slot_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
              : '—'}
          </span>?
          This will free up the slot for other patients.
        </p>
        <div className="flex gap-3">
          <button ref={keepButtonRef} onClick={onCancel} className="btn-secondary flex-1">Keep Appointment</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn-danger flex-1 disabled:opacity-50"
          >
            {loading ? 'Cancelling…' : 'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewModal({ appointment, onClose, onSubmitted }) {
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    if (!rating) {
      toast.error('Please select a star rating.')
      return
    }
    setSubmitting(true)
    try {
      await createReview({
        appointment_id: appointment.id,
        rating,
        comment: comment.trim() || null,
      })
      toast.success('Thank you! Your verified review has been published.', 'Review Posted')
      onSubmitted()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not submit your review.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-up">
        <div className="flex items-center justify-between mb-1">
          <h2 id="review-dialog-title" className="font-bold text-gray-900">Rate your visit</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
            aria-label="Close review form"
          >
            <FiX size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          How was your appointment with <span className="font-semibold">{appointment.doctor_name}</span>?
        </p>

        {/* Star picker */}
        <div className="flex justify-center gap-2 mb-5" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <FiStar
                size={28}
                className={
                  star <= (hover || rating)
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-200'
                }
              />
            </button>
          ))}
        </div>

        <label htmlFor="review-comment" className="block text-sm font-medium text-gray-700 mb-1">
          Comment <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          rows={3}
          maxLength={1000}
          className="input-field resize-none text-sm"
          placeholder="What stood out about your visit?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          disabled={submitting || !rating}
          className="btn-primary w-full mt-4 disabled:opacity-50"
        >
          {submitting ? 'Publishing…' : 'Publish Review'}
        </button>
        <p className="text-[11px] text-gray-400 text-center mt-2">
          Posted as a verified review — only patients who attended can rate.
        </p>
      </div>
    </div>
  )
}

function AppointmentCard({ appointment, onCancel, myReview, onReview }) {
  const slotDate = appointment.slot_date
    ? parseLocalDate(appointment.slot_date).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : '—'

  const slotTime = appointment.slot_time
    ? new Date(`1970-01-01T${appointment.slot_time}`).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
      })
    : '—'

  return (
    <div className="card flex items-start gap-4 animate-fade-in">
      <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
        <FiUser className="text-primary-500" size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{appointment.doctor_name || 'Doctor'}</p>
            {appointment.doctor_specialization && (
              <p className="text-xs text-primary-600 font-medium">{appointment.doctor_specialization}</p>
            )}
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><FiCalendar size={11} /> {slotDate}</span>
          <span className="flex items-center gap-1"><FiClock size={11} /> {slotTime}</span>
        </div>

        {appointment.reason && (
          <p className="text-xs text-gray-400 mt-1.5 truncate">{appointment.reason}</p>
        )}

        <div className="flex items-center justify-between mt-3">
          <SeverityBadge score={appointment.severity_score} />
          {appointment.status === 'SCHEDULED' && (
            <button
              onClick={() => onCancel(appointment)}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
              aria-label={`Cancel appointment with ${appointment.doctor_name}`}
            >
              <FiTrash2 size={12} />
              Cancel
            </button>
          )}
          {appointment.status === 'COMPLETED' && (
            myReview ? (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold" aria-label={`You rated this visit ${myReview.rating} out of 5`}>
                <FiStar size={12} className="fill-amber-400 text-amber-400" />
                You rated {myReview.rating}/5
              </span>
            ) : (
              <button
                onClick={() => onReview(appointment)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                aria-label={`Rate your visit with ${appointment.doctor_name}`}
              >
                <FiStar size={12} /> Rate your visit
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default function Appointments() {
  const toast = useToast()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [reviewTarget, setReviewTarget] = useState(null)
  const [myReviews, setMyReviews] = useState({})

  const fetchAppointments = async () => {
    try {
      const [apptRes, reviewRes] = await Promise.all([listAppointments(), listMyReviews()])
      setAppointments(apptRes.data)
      // Map reviews by appointment id for quick "already rated" lookups
      setMyReviews(Object.fromEntries(reviewRes.data.map((r) => [r.appointment_id, r])))
    } catch {
      toast.error('Could not load appointments. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAppointments() }, [])

  const handleCancelConfirm = async () => {
    setCancelling(true)
    try {
      await cancelAppointment(cancelTarget.id)
      toast.success('Your appointment has been cancelled and the slot is now free.', 'Appointment Cancelled')
      setCancelTarget(null)
      fetchAppointments()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel appointment.')
    } finally {
      setCancelling(false)
    }
  }

  const filtered = filter === 'All'
    ? appointments
    : appointments.filter((a) => a.status === filter)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
        <p className="text-gray-400 text-sm mt-1">Manage and track all your bookings.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-5 animate-fade-in" role="group" aria-label="Filter appointments">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              filter === f
                ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800'
            }`}
          >
            {f === 'All' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase().replace('_', ' ')}
            {f === 'All' && <span className="ml-1.5 text-xs opacity-70">({appointments.length})</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiCalendar className="text-gray-300" size={28} />
          </div>
          <p className="font-semibold text-gray-600">No {filter !== 'All' ? filter.toLowerCase().replace('_', ' ') : ''} appointments</p>
          <p className="text-sm text-gray-400 mt-1">Your appointments will appear here once booked.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              onCancel={setCancelTarget}
              myReview={myReviews[appt.id]}
              onReview={setReviewTarget}
            />
          ))}
        </div>
      )}

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <CancelModal
          appointment={cancelTarget}
          onConfirm={handleCancelConfirm}
          onCancel={() => setCancelTarget(null)}
          loading={cancelling}
        />
      )}

      {/* Review modal */}
      {reviewTarget && (
        <ReviewModal
          appointment={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => {
            setReviewTarget(null)
            fetchAppointments()
          }}
        />
      )}
    </div>
  )
}
