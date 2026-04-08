import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage
const store = {}
const localStorageMock = {
  getItem: vi.fn((key) => store[key] || null),
  setItem: vi.fn((key, val) => { store[key] = val }),
  removeItem: vi.fn((key) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Now import the module (it uses localStorage in interceptors)
import api, {
  register,
  login,
  getMyProfile,
  sendMessage,
  listDoctors,
  listSlots,
  listAppointments,
  cancelAppointment,
  listRescheduleRequests,
  acceptReschedule,
  declineReschedule,
} from '../api/client'

describe('API client', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('exports all required functions', () => {
    expect(typeof register).toBe('function')
    expect(typeof login).toBe('function')
    expect(typeof getMyProfile).toBe('function')
    expect(typeof sendMessage).toBe('function')
    expect(typeof listDoctors).toBe('function')
    expect(typeof listSlots).toBe('function')
    expect(typeof listAppointments).toBe('function')
    expect(typeof cancelAppointment).toBe('function')
    expect(typeof listRescheduleRequests).toBe('function')
    expect(typeof acceptReschedule).toBe('function')
    expect(typeof declineReschedule).toBe('function')
  })

  it('has correct baseURL', () => {
    expect(api.defaults.baseURL).toBe('/v1')
  })

  it('has JSON content type', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('request interceptor adds auth header when token exists', async () => {
    store['token'] = 'test-jwt-token'
    // Simulate the interceptor by manually running through axios config
    const config = { headers: {} }
    const interceptor = api.interceptors.request.handlers[0]
    const result = interceptor.fulfilled(config)
    expect(result.headers.Authorization).toBe('Bearer test-jwt-token')
  })

  it('request interceptor does not add auth header when no token', () => {
    const config = { headers: {} }
    const interceptor = api.interceptors.request.handlers[0]
    const result = interceptor.fulfilled(config)
    expect(result.headers.Authorization).toBeUndefined()
  })

  it('response interceptor clears token on 401', () => {
    store['token'] = 'some-token'
    const interceptor = api.interceptors.response.handlers[0]
    const error = { response: { status: 401 } }
    expect(interceptor.rejected(error)).rejects.toBeTruthy()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token')
  })

  it('response interceptor does not clear token on non-401', () => {
    store['token'] = 'some-token'
    const interceptor = api.interceptors.response.handlers[0]
    const error = { response: { status: 500 } }
    expect(interceptor.rejected(error)).rejects.toBeTruthy()
    expect(localStorageMock.removeItem).not.toHaveBeenCalled()
  })
})
