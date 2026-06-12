import axios from 'axios'

const api = axios.create({
  baseURL: '/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear token and notify the app so the UI logs out immediately
// instead of leaving a stale "logged in" shell until the next refresh.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    return Promise.reject(err)
  }
)

// ── Auth ──
export const register    = (data) => api.post('/auth/register', data)
export const login       = (data) => api.post('/auth/login', data)
export const doctorLogin = (data) => api.post('/auth/doctor/login', data)
export const doctorApply = (data) => api.post('/auth/doctor/apply', data)

// ── Patient ──
export const getMyProfile    = ()     => api.get('/patients/me')
export const updateMyProfile = (data) => api.put('/patients/me', data)

// ── Inference / AI Chat ──
export const sendMessage = (data) => api.post('/inference/', data)

// ── Doctors ──
export const listDoctors  = (params) => api.get('/doctors/', { params })
export const createDoctor = (data)   => api.post('/doctors/', data)

// ── Slots ──
export const listSlots  = (params) => api.get('/slots/', { params })
export const createSlot = (data)   => api.post('/slots/', data)

// ── Appointments ──
export const listAppointments         = ()             => api.get('/appointments/')
export const listUpcomingAppointments = ()             => api.get('/appointments/upcoming')
export const getAppointment           = (id)           => api.get(`/appointments/${id}`)
export const createAppointment        = (data)         => api.post('/appointments/', data)
export const updateAppointmentStatus  = (id, status)   => api.put(`/appointments/${id}/status`, { status })
export const cancelAppointment        = (id)           => api.delete(`/appointments/${id}`)

// ── Reschedule ──
export const listRescheduleRequests = ()   => api.get('/reschedule/')
export const acceptReschedule       = (id) => api.post(`/reschedule/${id}/accept`)
export const declineReschedule      = (id) => api.post(`/reschedule/${id}/decline`)

// ── Doctor Portal ──
export const getDoctorProfile        = ()             => api.get('/doctor/me')
export const getDoctorBriefing       = ()             => api.get('/doctor/briefing')
export const listDoctorAppointments  = (day)          => api.get('/doctor/appointments', { params: day ? { day } : {} })
export const recordOutcome           = (id, status)   => api.put(`/doctor/appointments/${id}/outcome`, { status })
export const listDoctorSlots         = (params)       => api.get('/doctor/slots', { params })
export const createDoctorSlot        = (data)         => api.post('/doctor/slots', data)
export const bulkCreateDoctorSlots   = (data)         => api.post('/doctor/slots/bulk', data)
export const closeDoctorSlot         = (id)           => api.put(`/doctor/slots/${id}/close`)
export const deleteDoctorSlot        = (id)           => api.delete(`/doctor/slots/${id}`)
export const listDoctorReschedules   = ()             => api.get('/doctor/reschedules')
export const changeDoctorPassword    = (data)         => api.put('/doctor/me/password', data)

// ── Reviews (verified — gated on COMPLETED visits) ──
export const createReview     = (data) => api.post('/reviews/', data)
export const listMyReviews    = ()     => api.get('/reviews/mine')
export const getDoctorReviews = (id)   => api.get(`/reviews/doctor/${id}`)

// ── Admin: doctor applications ──
export const listDoctorApplications  = (status)       => api.get('/doctors/applications', { params: status ? { application_status: status } : {} })
export const decideDoctorApplication = (id, action)   => api.put(`/doctors/${id}/application`, { action })

export default api
