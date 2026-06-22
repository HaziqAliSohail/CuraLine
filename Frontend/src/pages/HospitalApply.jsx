import { useState } from 'react'
import { Link } from 'react-router-dom'
import { hospitalApply } from '../api/client'
import { FiCheckCircle, FiShield, FiEye, FiEyeOff, FiHome } from 'react-icons/fi'

export default function HospitalApply() {
  const [form, setForm] = useState({
    hospital_name: '', org_npi: '', address: '', phone: '',
    admin_name: '', admin_email: '', admin_password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await hospitalApply({
        ...form,
        org_npi: form.org_npi || null,
        address: form.address || null,
        phone: form.phone || null,
      })
      setSubmitted(true)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Application failed. Please check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4">
        <div className="card max-w-md w-full text-center py-10 animate-scale-up">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="text-emerald-600" size={26} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Application Submitted</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed px-4">
            Thank you. The CuraLine team will verify {form.hospital_name} before it
            goes live. Once verified, sign in as <span className="font-medium">{form.admin_email}</span> to
            manage your roster and approve your doctors.
          </p>
          <Link to="/login" className="btn-primary inline-block mt-6 text-sm">Back to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="CuraLine Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">List your hospital or clinic</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Join the CuraLine marketplace. You'll manage your own doctors — once
            we've verified your organization.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg" role="alert">{error}</div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
              <FiHome size={12} /> Organization
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="h-name" className="block text-sm font-medium text-gray-700 mb-1">Hospital / clinic name</label>
                <input id="h-name" className="input-field" placeholder="St Mary Medical Center"
                  value={form.hospital_name} onChange={set('hospital_name')} maxLength={100} required />
              </div>
              <div>
                <label htmlFor="h-npi" className="block text-sm font-medium text-gray-700 mb-1">
                  Organizational NPI <span className="text-gray-400">(Type 2, optional)</span>
                </label>
                <input id="h-npi" className="input-field" placeholder="10 digits"
                  value={form.org_npi} onChange={set('org_npi')}
                  pattern="\d{10}" title="NPI is exactly 10 digits" maxLength={10} />
              </div>
              <div>
                <label htmlFor="h-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
                <input id="h-phone" className="input-field" placeholder="+1 555 0100"
                  value={form.phone} onChange={set('phone')} maxLength={15} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="h-address" className="block text-sm font-medium text-gray-700 mb-1">Address <span className="text-gray-400">(optional)</span></label>
                <input id="h-address" className="input-field" placeholder="1 Health Way, Springfield"
                  value={form.address} onChange={set('address')} maxLength={255} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
              <FiShield size={12} /> Administrator account
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="h-admin-name" className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                <input id="h-admin-name" className="input-field" placeholder="Jane Admin"
                  value={form.admin_name} onChange={set('admin_name')} maxLength={50} required />
              </div>
              <div>
                <label htmlFor="h-admin-email" className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
                <input id="h-admin-email" type="email" className="input-field" placeholder="admin@hospital.org"
                  value={form.admin_email} onChange={set('admin_email')} autoComplete="email" required />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="h-admin-pass" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input id="h-admin-pass" type={showPassword ? 'text' : 'password'} className="input-field pr-10" placeholder="Min. 8 characters"
                    value={form.admin_password} onChange={set('admin_password')} minLength={8} autoComplete="new-password" required />
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
            </div>
          </div>

          <div className="flex items-start gap-2 bg-primary-50 rounded-xl p-3">
            <FiShield className="text-primary-600 flex-shrink-0 mt-0.5" size={14} />
            <p className="text-xs text-primary-700 leading-relaxed">
              CuraLine verifies every organization (KYB) before activation. After
              verification you can approve your own doctors directly — no central
              gatekeeper.
            </p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Application'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Applying as an individual doctor instead?{' '}
            <Link to="/apply" className="text-primary-600 hover:text-primary-700 font-medium">Apply here</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
