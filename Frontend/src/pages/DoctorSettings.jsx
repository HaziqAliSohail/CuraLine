import { useState } from 'react'
import { changeDoctorPassword } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi'

export default function DoctorSettings() {
  const { user } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [submitting, setSubmitting] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm) {
      toast.error('New password and confirmation do not match.')
      return
    }
    setSubmitting(true)
    try {
      await changeDoctorPassword({
        current_password: form.current_password,
        new_password: form.new_password,
      })
      toast.success('Your password has been updated.', 'Password Changed')
      setForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not change the password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your portal account.</p>
      </div>

      {/* Profile summary */}
      <div className="card flex items-center gap-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
        <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <FiUser className="text-primary-500" size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 truncate">{user?.name}</p>
          <p className="text-xs text-primary-600 font-medium">{user?.specialization} · {user?.qualification}</p>
          <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Change password */}
      <form onSubmit={handleSubmit} className="card space-y-4 animate-slide-up" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
            <FiLock className="text-amber-600" size={16} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Change Password</p>
            <p className="text-xs text-gray-400">
              If your account was set up by an administrator, rotate the password so only you know it.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
          <div className="relative">
            <input
              id="current-password" type={showCurrent ? 'text' : 'password'} className="input-field pr-10"
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
              autoComplete="current-password" required
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              aria-label={showCurrent ? 'Hide password' : 'Show password'}
            >
              {showCurrent ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <div className="relative">
            <input
              id="new-password" type={showNew ? 'text' : 'password'} className="input-field pr-10" placeholder="Min. 8 characters"
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              minLength={8} autoComplete="new-password" required
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              aria-label={showNew ? 'Hide password' : 'Show password'}
            >
              {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
          <div className="relative">
            <input
              id="confirm-password" type={showConfirm ? 'text' : 'password'} className="input-field pr-10"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              minLength={8} autoComplete="new-password" required
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

        <button type="submit" className="btn-primary w-full text-sm" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
