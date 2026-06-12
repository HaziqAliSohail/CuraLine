import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateMyProfile } from '../api/client'
import { useToast } from '../context/ToastContext'
import { FiUser, FiPhone, FiMail, FiEdit3, FiSave, FiX, FiShield } from 'react-icons/fi'

const INSURANCE_PLANS = [
  'Blue Cross Blue Shield',
  'Aetna',
  'Cigna',
  'UnitedHealthcare',
  'Humana',
  'Medicare',
  'Medicaid',
  'Self-Pay / Uninsured',
]

export default function Profile() {
  const { user, loginUser } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    phone: user?.phone || '',
    medical_history: user?.medical_history || '',
    insurance_plan: user?.insurance_plan || '',
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateMyProfile({
        phone: form.phone || null,
        medical_history: form.medical_history || null,
        insurance_plan: form.insurance_plan || null,
      })
      toast.success('Your profile has been updated.', 'Profile Saved')
      setEditing(false)
      // Refresh auth context
      const token = localStorage.getItem('token')
      if (token) loginUser(token)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const genderColors = {
    MALE: 'bg-blue-50 text-blue-700',
    FEMALE: 'bg-pink-50 text-pink-700',
    OTHER: 'bg-purple-50 text-purple-700',
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your personal and health information.</p>
      </div>

      {/* Avatar + identity card */}
      <div className="card-glass mb-5 animate-slide-up" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-700 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary-500/30 flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">{user?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {user?.gender && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${genderColors[user.gender] || 'bg-gray-100 text-gray-600'}`}>
                  {user.gender}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Non-editable fields */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <FiMail size={15} className="text-gray-400 flex-shrink-0" />
            <span className="text-gray-700">{user?.email}</span>
            <span className="ml-auto text-xs text-gray-400">Verified</span>
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="card animate-slide-up" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900">Contact & Health Info</h3>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm text-primary-600 font-semibold hover:text-primary-700 transition-colors"
              aria-label="Edit profile"
            >
              <FiEdit3 size={14} /> Edit
            </button>
          ) : (
            <button
              onClick={() => { setEditing(false); setForm({ phone: user?.phone || '', medical_history: user?.medical_history || '', insurance_plan: user?.insurance_plan || '' }) }}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Cancel editing"
            >
              <FiX size={14} /> Cancel
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Phone */}
          <div>
            <label htmlFor="profile-phone" className="block text-xs font-semibold text-gray-500 mb-1.5">
              Phone Number
            </label>
            {editing ? (
              <div className="relative">
                <FiPhone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="profile-phone"
                  type="tel"
                  className="input-field pl-9"
                  placeholder="+1 555 000 0000"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-700 flex items-center gap-2">
                <FiPhone size={14} className="text-gray-400" />
                {user?.phone || <span className="text-gray-400 italic">Not provided</span>}
              </p>
            )}
          </div>

          {/* Medical history */}
          <div>
            <label htmlFor="profile-history" className="block text-xs font-semibold text-gray-500 mb-1.5">
              Medical History
            </label>
            {editing ? (
              <textarea
                id="profile-history"
                rows={4}
                className="input-field resize-none"
                placeholder="Known allergies, chronic conditions, current medications…"
                value={form.medical_history}
                onChange={(e) => setForm((f) => ({ ...f, medical_history: e.target.value }))}
              />
            ) : (
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 leading-relaxed min-h-16">
                {user?.medical_history || <span className="text-gray-400 italic">No medical history on file.</span>}
              </div>
            )}
          </div>

          {/* Insurance plan */}
          <div>
            <label htmlFor="profile-insurance" className="block text-xs font-semibold text-gray-500 mb-1.5">
              Insurance Plan
            </label>
            {editing ? (
              <select
                id="profile-insurance"
                className="input-field"
                value={form.insurance_plan}
                onChange={(e) => setForm((f) => ({ ...f, insurance_plan: e.target.value }))}
              >
                <option value="">Select your insurance plan...</option>
                {INSURANCE_PLANS.map((plan) => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-700 flex items-center gap-2">
                <FiShield size={14} className="text-gray-400" />
                {user?.insurance_plan || <span className="text-gray-400 italic">No insurance plan selected</span>}
              </p>
            )}
          </div>
        </div>

        {/* Save button */}
        {editing && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-5 disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
            ) : (
              <><FiSave size={15} /> Save Changes</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
