import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getInviteInfo, acceptInvite } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { FiLock, FiAlertTriangle, FiEye, FiEyeOff } from 'react-icons/fi'

export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { loginUser } = useAuth()
  const [info, setInfo] = useState(null)
  const [inviteError, setInviteError] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    getInviteInfo(token)
      .then((res) => setInfo(res.data))
      .catch((err) => {
        setInviteError(
          err.response?.data?.detail ||
          'This invite link is invalid or has expired.'
        )
      })
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const res = await acceptInvite(token, form.password)
      loginUser(res.data, 'doctor')
      navigate('/doctor')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not activate your account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="CuraLine Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Activate Your Doctor Account</h1>
        </div>

        {loading ? (
          <div className="card">
            <div className="skeleton h-5 w-2/3 mb-3" />
            <div className="skeleton h-10 mb-3" />
            <div className="skeleton h-10" />
          </div>
        ) : inviteError ? (
          <div className="card text-center py-8">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FiAlertTriangle className="text-amber-600" size={20} />
            </div>
            <p className="font-semibold text-gray-800">Invite not available</p>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed px-4">{inviteError}</p>
            <Link to="/login" className="btn-secondary inline-block mt-5 text-sm">Go to Sign In</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div className="bg-primary-50 rounded-xl p-3.5">
              <p className="text-sm font-semibold text-primary-800">{info.name}</p>
              <p className="text-xs text-primary-600">{info.specialization} · {info.email}</p>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Choose a password to activate your CuraLine portal access.
              Only you will know it.
            </p>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg" role="alert">{error}</div>
            )}

            <div>
              <label htmlFor="invite-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  id="invite-password" type={showPassword ? 'text' : 'password'} className="input-field pr-10"
                  placeholder="Min. 8 characters" minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password" required
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
              <label htmlFor="invite-confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <div className="relative">
                <input
                  id="invite-confirm" type={showConfirm ? 'text' : 'password'} className="input-field pr-10"
                  minLength={8}
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  autoComplete="new-password" required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? 'Activating…' : <span className="flex items-center justify-center gap-2"><FiLock size={14} /> Activate & Sign In</span>}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
