import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_BASE_URL } from '../config'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // AI booking can take several seconds
})

// Tokens live in the OS keychain/keystore - not plain storage
export const saveToken = (auth, role) => {
  const accessToken = typeof auth === 'string' ? auth : auth.access_token
  const writes = [
    SecureStore.setItemAsync('token', accessToken),
    SecureStore.setItemAsync('role', role),
  ]
  if (auth.refresh_token) writes.push(SecureStore.setItemAsync('refresh_token', auth.refresh_token))
  return Promise.all(writes)
}

export const loadAuth = async () => ({
  token: await SecureStore.getItemAsync('token'),
  role: (await SecureStore.getItemAsync('role')) || 'patient',
})

export const getRefreshToken = () => SecureStore.getItemAsync('refresh_token')

export const clearToken = () =>
  Promise.all([
    SecureStore.deleteItemAsync('token'),
    SecureStore.deleteItemAsync('role'),
    SecureStore.deleteItemAsync('refresh_token'),
  ])

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

// ── Silent session renewal ───────────────────────────────────────────
// On 401: refresh once (single-flight), retry the original request, and only
// sign the user out when the refresh itself fails. This is what keeps mobile
// users logged in for weeks despite the 30-minute access token.
let refreshInFlight = null

const refreshSession = async () => {
  const refreshToken = await SecureStore.getItemAsync('refresh_token')
  if (!refreshToken) throw new Error('no refresh token')
  // Plain axios - must not recurse through this interceptor
  const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
  await SecureStore.setItemAsync('token', res.data.access_token)
  await SecureStore.setItemAsync('refresh_token', res.data.refresh_token)
  return res.data.access_token
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const isAuthRoute = original?.url?.includes('/auth/')
    if (err.response?.status === 401 && original && !original._retried && !isAuthRoute) {
      original._retried = true
      try {
        refreshInFlight = refreshInFlight || refreshSession()
        const newToken = await refreshInFlight
        refreshInFlight = null
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        refreshInFlight = null
        await clearToken()
        onUnauthorized?.()
      }
    } else if (err.response?.status === 401 && !isAuthRoute) {
      await clearToken()
      onUnauthorized?.()
    }
    return Promise.reject(err)
  }
)

// ── Auth ──
export const register      = (data)          => api.post('/auth/register', data)
export const login         = (data)          => api.post('/auth/login', data)
export const doctorLogin   = (data)          => api.post('/auth/doctor/login', data)
export const revokeSession = (refresh_token) => api.post('/auth/logout', { refresh_token })

// ── Push notification devices ──
export const registerDevice   = (expo_push_token) => api.post('/notifications/devices', { expo_push_token })
export const unregisterDevice = (expo_push_token) => api.post('/notifications/devices/unregister', { expo_push_token })

// ── Patient ──
export const getMyProfile    = ()     => api.get('/patients/me')
export const updateMyProfile = (data) => api.put('/patients/me', data)

// ── Insurance (US real-time eligibility) ──
export const verifyInsurance = ()     => api.post('/insurance/verify')
export const listCarriers    = ()     => api.get('/insurance/carriers')

// ── Consent (medical disclaimer; triage is gated on acceptance) ──
export const getConsent    = ()       => api.get('/consent/')
export const acceptConsent = ()       => api.post('/consent/accept')

// ── AI Chat ──
// AI chat is async on the server: POST dispatches a job, then we poll for the
// result. The server may also return status="complete" inline (dev without a
// worker). Resolves to the result object (InferenceOut shape).
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
    delay = Math.min(delay + 400, 2000)
  }
  throw new Error('The assistant took too long to respond. Please try again.')
}

// ── Doctors / slots / hospitals ──
export const listDoctors         = (params) => api.get('/doctors/', { params })
export const listSlots         = (params) => api.get('/slots/', { params })
export const getDoctorReviews  = (id)     => api.get(`/reviews/doctor/${id}`)
export const listNearbyHospitals = (params) => api.get('/hospitals/nearby', { params })

// ── Appointments ──
export const listAppointments         = ()           => api.get('/appointments/')
export const listUpcomingAppointments = ()           => api.get('/appointments/upcoming')
export const createAppointment        = (data)       => api.post('/appointments/', data)
export const cancelAppointment        = (id)         => api.delete(`/appointments/${id}`)
export const getAppointmentVideo      = (id)         => api.get(`/telehealth/appointments/${id}/video`)

// ── Reviews ──
export const createReview  = (data) => api.post('/reviews/', data)
export const listMyReviews = ()     => api.get('/reviews/mine')

// ── Reschedule ──
export const listRescheduleRequests = ()   => api.get('/reschedule/')
export const acceptReschedule       = (id) => api.post(`/reschedule/${id}/accept`)
export const declineReschedule      = (id) => api.post(`/reschedule/${id}/decline`)

// ── Doctor portal ──
export const getDoctorProfile       = ()           => api.get('/doctor/me')
export const getDoctorBriefing      = ()           => api.get('/doctor/briefing')
export const listDoctorAppointments = (day)        => api.get('/doctor/appointments', { params: day ? { day } : {} })
export const recordOutcome          = (id, status) => api.put(`/doctor/appointments/${id}/outcome`, { status })
export const listDoctorSlots        = (params)     => api.get('/doctor/slots', { params })
export const createDoctorSlot       = (data)       => api.post('/doctor/slots', data)
export const bulkCreateDoctorSlots  = (data)       => api.post('/doctor/slots/bulk', data)
export const closeDoctorSlot        = (id)         => api.put(`/doctor/slots/${id}/close`)
export const deleteDoctorSlot       = (id)         => api.delete(`/doctor/slots/${id}`)
export const listDoctorReschedules  = ()           => api.get('/doctor/reschedules')
export const getDoctorAnalytics     = (days)       => api.get('/doctor/analytics', { params: days ? { days } : {} })
export const changeDoctorPassword   = (data)       => api.put('/doctor/me/password', data)

export default api
