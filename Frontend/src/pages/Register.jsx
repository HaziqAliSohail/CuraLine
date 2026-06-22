import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register, login } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { INSURANCE_PLANS } from '../constants/insurance'
import { FiEye, FiEyeOff } from 'react-icons/fi'


export default function Register() {
  const [form, setForm] = useState({
    name: '',
    gender: 'MALE',
    phone: '',
    email: '',
    password: '',
    medical_history: '',
    insurance_plan: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      // Auto-login after registration
      const res = await login({ email: form.email, password: form.password })
      loginUser(res.data)
      navigate('/chat')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="CuraLine Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-1">Get started with CuraLine</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                id="reg-name"
                type="text"
                className="input-field"
                placeholder="John Doe"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>
            <div>
              <label htmlFor="reg-gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select id="reg-gender" className="input-field" value={form.gender} onChange={set('gender')}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              id="reg-phone"
              type="tel"
              className="input-field"
              placeholder="+1 234 567 8900"
              value={form.phone}
              onChange={set('phone')}
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="reg-email"
              type="email"
              className="input-field"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={set('password')}
                minLength={8}
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

          <div>
            <label htmlFor="reg-history" className="block text-sm font-medium text-gray-700 mb-1">
              Medical History <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="reg-history"
              className="input-field h-24 resize-none"
              placeholder="Previous conditions, allergies, medications, surgeries..."
              value={form.medical_history}
              onChange={set('medical_history')}
            />
          </div>

          <div>
            <label htmlFor="reg-insurance" className="block text-sm font-medium text-gray-700 mb-1">
              Insurance Plan <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              id="reg-insurance"
              className="input-field"
              value={form.insurance_plan}
              onChange={set('insurance_plan')}
            >
              <option value="">Select your insurance plan...</option>
              {INSURANCE_PLANS.map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
