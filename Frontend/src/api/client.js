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

// ── Silent session renewal ───────────────────────────────────────────
// On 401: try the refresh token once (single-flight - concurrent 401s share
// one refresh call), retry the original request, and only log the user out
// if the refresh itself fails.
let refreshInFlight = null

const refreshSession = async () => {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) throw new Error('no refresh token')
  // Plain axios - must not recurse through this interceptor
  const res = await axios.post('/v1/auth/refresh', { refresh_token: refreshToken })
  localStorage.setItem('token', res.data.access_token)
  localStorage.setItem('refresh_token', res.data.refresh_token)
  return res.data.access_token
}

const hardLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('role')
  window.dispatchEvent(new Event('auth:unauthorized'))
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const isAuthRoute = original?.url?.includes('/auth/')
    const canRetry =
      original && !original._retried && !isAuthRoute && localStorage.getItem('refresh_token')

    if (err.response?.status === 401 && canRetry) {
      original._retried = true
      try {
        refreshInFlight = refreshInFlight || refreshSession()
        const newToken = await refreshInFlight
        refreshInFlight = null
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        refreshInFlight = null
        hardLogout()
      }
    } else if (err.response?.status === 401 && !isAuthRoute) {
      hardLogout()
    }
    return Promise.reject(err)
  }
)

// ── Auth ──
export const register    = (data) => api.post('/auth/register', data)
export const login       = (data) => api.post('/auth/login', data)
export const doctorLogin = (data) => api.post('/auth/doctor/login', data)
export const adminLogin  = (data) => api.post('/auth/admin/login', data)
export const doctorApply  = (data)            => api.post('/auth/doctor/apply', data)
export const refreshAuth   = (refresh_token)   => api.post('/auth/refresh', { refresh_token })
export const revokeSession = (refresh_token)   => api.post('/auth/logout', { refresh_token })
export const getInviteInfo = (token)           => api.get(`/auth/doctor/invite/${token}`)
export const acceptInvite  = (token, password) => api.post(`/auth/doctor/invite/${token}/accept`, { password })
export const verifyEmail     = (token)               => api.post('/auth/verify-email', { token })
export const forgotPassword  = (email)               => api.post('/auth/forgot-password', { email })
export const resetPassword   = (token, new_password) => api.post('/auth/reset-password', { token, new_password })

// ── Patient ──
export const getMyProfile    = ()     => api.get('/patients/me')
export const updateMyProfile = (data) => api.put('/patients/me', data)
// Data rights (GDPR/HIPAA-style): export everything, or erase the account.
export const exportMyData    = ()     => api.get('/patients/me/export')
export const deleteMyAccount = ()     => api.delete('/patients/me')
export const changePatientPassword = (data) => api.put('/patients/me/password', data)

// ── Insurance (US eligibility) ──
export const verifyInsurance = ()     => api.post('/insurance/verify')
export const listCarriers    = ()     => api.get('/insurance/carriers')

// ── Consent (medical disclaimer; triage is gated on acceptance) ──
export const getConsent    = () => api.get('/consent/')
export const acceptConsent = () => api.post('/consent/accept')

// ── Inference / AI Chat ──
// AI chat is async on the server: POST dispatches a job, then we poll for the
// result. The server may also return status="complete" inline (dev without a
// worker). Returns the result object (InferenceOut shape).
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const sendMessage = async (data) => {
  const { data: job } = await api.post('/inference/', data)
  if (job.status === 'complete' && job.result) return job.result

  const deadline = Date.now() + 90000 // 90s ceiling
  let delay = 800
  while (Date.now() < deadline) {
    await _sleep(delay)
    const { data: poll } = await api.get(`/inference/result/${job.job_id}`)
    if (poll.status === 'complete') return poll.result
    delay = Math.min(delay + 400, 2000) // gentle backoff
  }
  throw new Error('The assistant took too long to respond. Please try again.')
}

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
export const getAppointmentVideo       = (id)           => api.get(`/telehealth/appointments/${id}/video`)
export const createCopayCheckout       = (id)           => api.post(`/payments/appointments/${id}/copay-checkout`)

// ── Reschedule ──
export const listRescheduleRequests = ()   => api.get('/reschedule/')
export const acceptReschedule       = (id) => api.post(`/reschedule/${id}/accept`)
export const declineReschedule      = (id) => api.post(`/reschedule/${id}/decline`)

// ── Doctor Portal ──
export const getDoctorProfile        = ()             => api.get('/doctor/me')
export const getAdminProfile         = ()             => api.get('/admin/me')
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
export const getDoctorAnalytics      = (days)         => api.get('/doctor/analytics', { params: days ? { days } : {} })
export const regenerateBriefing       = (id)           => api.post(`/doctor/appointments/${id}/regenerate-briefing`)

// ── Reviews (verified - gated on COMPLETED visits) ──
export const createReview     = (data) => api.post('/reviews/', data)
export const listMyReviews    = ()     => api.get('/reviews/mine')
export const getDoctorReviews = (id)   => api.get(`/reviews/doctor/${id}`)

// ── Admin: doctor applications ──
export const listDoctorApplications  = (status)       => api.get('/doctors/applications', { params: status ? { application_status: status } : {} })
export const decideDoctorApplication = (id, action)   => api.put(`/doctors/${id}/application`, { action })
export const inviteDoctor            = (data)         => api.post('/doctors/invite', data)
export const listAuditLogs           = (params)       => api.get('/admin/audit-logs', { params })
export const verifyDoctorNpi         = (id)           => api.post(`/doctors/${id}/verify-npi`)

// ── Hospitals ──
export const listHospitals           = ()             => api.get('/hospitals/')
export const listNearbyHospitals     = (params)       => api.get('/hospitals/nearby', { params })

// ── Hospital onboarding (multi-tenant marketplace) ──
export const hospitalApply           = (data)         => api.post('/auth/hospital/apply', data)
// Platform operator: verify hospitals (root of trust)
export const listAdminHospitals      = (status)       => api.get('/admin/hospitals', { params: status ? { verification_status: status } : {} })
export const decideHospital          = (id, action)   => api.put(`/admin/hospitals/${id}/verification`, { action })
export const verifyHospitalNpi       = (id)           => api.post(`/admin/hospitals/${id}/verify-npi`)

export default api
