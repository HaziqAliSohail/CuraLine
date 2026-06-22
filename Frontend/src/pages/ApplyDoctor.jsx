import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { doctorApply, listHospitals } from '../api/client'
import { FiCheckCircle, FiShield, FiEye, FiEyeOff } from 'react-icons/fi'

const SPECIALIZATIONS = [
  'Cardiology', 'Neurology', 'Orthopedics', 'Dermatology', 'Pediatrics',
  'Gastroenterology', 'Pulmonology', 'General Medicine',
]

export default function ApplyDoctor() {
  const [form, setForm] = useState({
    name: '', gender: 'FEMALE', email: '', phone: '',
    specialization: 'General Medicine', qualification: '',
    license_number: '', npi_number: '', password: '', hospital_id: '',
  })
  const [hospitals, setHospitals] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    listHospitals().then((res) => setHospitals(res.data)).catch(() => {})
  }, [])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await doctorApply({
        ...form,
        phone: form.phone || null,
        npi_number: form.npi_number || null,
        hospital_id: form.hospital_id ? Number(form.hospital_id) : null,
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
            Thank you, {form.name}. Our team will verify your medical license and
            qualifications. You'll be able to sign in to the doctor portal once
            your application is approved.
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
          <h1 className="text-2xl font-bold text-gray-900">Join CuraLine as a Doctor</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Apply to practice on the platform. Every application is credential-verified.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg" role="alert">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="apply-hospital" className="block text-sm font-medium text-gray-700 mb-1">Hospital / clinic</label>
              <select id="apply-hospital" className="input-field" value={form.hospital_id} onChange={set('hospital_id')}>
                <option value="">Independent / my own clinic</option>
                {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Choose your hospital and its admin approves you. Independent? We'll
                verify your NPI automatically.
              </p>
            </div>
            <div>
              <label htmlFor="apply-name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input id="apply-name" className="input-field" placeholder="Dr. Jane Smith"
                value={form.name} onChange={set('name')} maxLength={50} required />
            </div>
            <div>
              <label htmlFor="apply-gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select id="apply-gender" className="input-field" value={form.gender} onChange={set('gender')}>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="apply-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="apply-email" type="email" className="input-field" placeholder="you@hospital.com"
                value={form.email} onChange={set('email')} autoComplete="email" required />
            </div>
            <div>
              <label htmlFor="apply-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
              <input id="apply-phone" className="input-field" placeholder="+1 555 0100"
                value={form.phone} onChange={set('phone')} maxLength={15} />
            </div>
            <div>
              <label htmlFor="apply-spec" className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
              <select id="apply-spec" className="input-field" value={form.specialization} onChange={set('specialization')}>
                {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="apply-qual" className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
              <input id="apply-qual" className="input-field" placeholder="MD, FACC"
                value={form.qualification} onChange={set('qualification')} maxLength={100} required />
            </div>
            <div>
              <label htmlFor="apply-license" className="block text-sm font-medium text-gray-700 mb-1">Medical license no.</label>
              <input id="apply-license" className="input-field" placeholder="LIC-12345"
                value={form.license_number} onChange={set('license_number')} minLength={3} maxLength={50} required />
            </div>
            <div>
              <label htmlFor="apply-npi" className="block text-sm font-medium text-gray-700 mb-1">
                NPI number <span className="text-gray-400">(US, optional)</span>
              </label>
              <input id="apply-npi" className="input-field" placeholder="10 digits"
                value={form.npi_number} onChange={set('npi_number')}
                pattern="\d{10}" title="NPI is exactly 10 digits" maxLength={10} />
            </div>
            <div>
              <label htmlFor="apply-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input id="apply-password" type={showPassword ? 'text' : 'password'} className="input-field pr-10" placeholder="Min. 8 characters"
                  value={form.password} onChange={set('password')} minLength={8} autoComplete="new-password" required />
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

          <div className="flex items-start gap-2 bg-primary-50 rounded-xl p-3">
            <FiShield className="text-primary-600 flex-shrink-0 mt-0.5" size={14} />
            <p className="text-xs text-primary-700 leading-relaxed">
              Your license number and qualifications will be verified by hospital
              administration before your profile becomes visible to patients.
            </p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Application'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already approved?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign in</Link>
          </p>
          <p className="text-center text-sm text-gray-500">
            Representing a hospital or clinic?{' '}
            <Link to="/hospital-apply" className="text-primary-600 hover:text-primary-700 font-medium">List your organization</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
