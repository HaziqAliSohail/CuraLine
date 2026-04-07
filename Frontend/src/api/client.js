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

// On 401, clear token (let React router handle the redirect)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
    }
    return Promise.reject(err)
  }
)

// ── Auth ──
export const register = (data) => api.post('/auth/register', data)
export const login = (data) => api.post('/auth/login', data)

// ── Patient ──
export const getMyProfile = () => api.get('/patients/me')

// ── Inference / AI Chat ──
export const sendMessage = (data) => api.post('/inference/', data)

// ── Doctors ──
export const listDoctors = (params) => api.get('/doctors/', { params })
export const createDoctor = (data) => api.post('/doctors/', data)

// ── Slots ──
export const listSlots = (params) => api.get('/slots/', { params })
export const createSlot = (data) => api.post('/slots/', data)

// ── Appointments ──
export const listAppointments = () => api.get('/appointments/')
export const getAppointment = (id) => api.get(`/appointments/${id}`)
export const updateAppointmentStatus = (id, status) =>
  api.put(`/appointments/${id}/status`, { status })
export const cancelAppointment = (id) => api.delete(`/appointments/${id}`)

// ── Reschedule ──
export const listRescheduleRequests = () => api.get('/reschedule/')
export const acceptReschedule = (id) => api.post(`/reschedule/${id}/accept`)
export const declineReschedule = (id) => api.post(`/reschedule/${id}/decline`)

export default api
