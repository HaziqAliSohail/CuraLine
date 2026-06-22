import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, doctorLogin, adminLogin } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { FiUser, FiActivity, FiEye, FiEyeOff, FiShield } from 'react-icons/fi'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [mode, setMode] = useState('patient') // 'patient' | 'doctor' | 'admin'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = mode === 'doctor' ? doctorLogin : mode === 'admin' ? adminLogin : login
      const res = await fn(form)
      loginUser(res.data, mode)
      navigate(mode === 'doctor' ? '/doctor' : mode === 'admin' ? '/admin/hospitals' : '/chat')
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
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="CuraLine Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to CuraLine</h1>
          <p className="text-gray-500 mt-1">
            {mode === 'doctor' ? 'Doctor portal - sign in to view your day'
              : mode === 'admin' ? 'Platform operator - sign in to manage the marketplace'
              : 'Sign in to manage your appointments'}
          </p>
        </div>

        {/* Role toggle (hidden in operator mode) */}
        <div
          className={`flex bg-white/70 backdrop-blur rounded-xl p-1 mb-4 border border-gray-200 ${mode === 'admin' ? 'hidden' : ''}`}
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
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : mode === 'doctor' ? 'Sign In to Portal' : 'Sign In'}
          </button>

          {mode === 'patient' && (
            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Forgot password?
              </Link>
            </div>
          )}

          {mode === 'patient' && (
            <p className="text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                Register
              </Link>
            </p>
          )}
          {mode === 'doctor' && (
            <p className="text-center text-sm text-gray-500">
              New to CuraLine?{' '}
              <Link to="/apply" className="text-primary-600 hover:text-primary-700 font-medium">
                Apply to join as a doctor
              </Link>
            </p>
          )}
        </form>

        {/* Discreet platform-operator entry - admins are a separate identity */}
        <div className="text-center mt-5">
          {mode === 'admin' ? (
            <button
              type="button"
              onClick={() => { setMode('patient'); setError('') }}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              ← Patient / doctor sign-in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setMode('admin'); setError('') }}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 font-medium"
            >
              <FiShield size={12} /> Platform operator sign-in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
