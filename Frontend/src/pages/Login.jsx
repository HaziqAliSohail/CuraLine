import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, doctorLogin } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { FiUser, FiActivity } from 'react-icons/fi'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [mode, setMode] = useState('patient') // 'patient' | 'doctor'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = mode === 'doctor' ? await doctorLogin(form) : await login(form)
      loginUser(res.data.access_token, mode)
      navigate(mode === 'doctor' ? '/doctor' : '/chat')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4">
            <span className="text-white font-bold text-xl">CL</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to CuraLine</h1>
          <p className="text-gray-500 mt-1">
            {mode === 'doctor' ? 'Doctor portal — sign in to view your day' : 'Sign in to manage your appointments'}
          </p>
        </div>

        {/* Role toggle */}
        <div
          className="flex bg-white/70 backdrop-blur rounded-xl p-1 mb-4 border border-gray-200"
          role="tablist"
          aria-label="Account type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'patient'}
            onClick={() => { setMode('patient'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'patient' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiUser size={15} /> I'm a Patient
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'doctor'}
            onClick={() => { setMode('doctor'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'doctor' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiActivity size={15} /> I'm a Doctor
          </button>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg" role="alert">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="login-email"
              type="email"
              className="input-field"
              placeholder={mode === 'doctor' ? 'doctor@hospital.com' : 'you@example.com'}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="login-password"
              type="password"
              className="input-field"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : mode === 'doctor' ? 'Sign In to Portal' : 'Sign In'}
          </button>

          {mode === 'patient' ? (
            <p className="text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                Register
              </Link>
            </p>
          ) : (
            <p className="text-center text-sm text-gray-500">
              New to CuraLine?{' '}
              <Link to="/apply" className="text-primary-600 hover:text-primary-700 font-medium">
                Apply to join as a doctor
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
