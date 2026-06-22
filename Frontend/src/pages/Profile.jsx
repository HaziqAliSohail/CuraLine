import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateMyProfile, verifyInsurance, changePatientPassword, exportMyData, deleteMyAccount } from '../api/client'
import { useToast } from '../context/ToastContext'
import { FiUser, FiPhone, FiMail, FiEdit3, FiSave, FiX, FiShield, FiCheckCircle, FiAlertCircle, FiKey, FiEye, FiEyeOff, FiDownload, FiTrash2, FiDatabase, FiRefreshCw } from 'react-icons/fi'
import { INSURANCE_PLANS } from '../constants/insurance'


export default function Profile() {
  const { user, loginUser, logout } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [coverage, setCoverage] = useState(null)
  const [form, setForm] = useState({
    phone: user?.phone || '',
    medical_history: user?.medical_history || '',
    insurance_plan: user?.insurance_plan || '',
    insurance_member_id: user?.insurance_member_id || '',
    insurance_group_number: user?.insurance_group_number || '',
  })

  const handleVerify = async () => {
    setVerifying(true)
    setCoverage(null)
    try {
      const res = await verifyInsurance()
      setCoverage(res.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not verify coverage right now.')
    } finally {
      setVerifying(false)
    }
  }

  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [pwSaving, setPwSaving] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      toast.error('All password fields are required.')
      return
    }
    if (pwForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.')
      return
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }
    setPwSaving(true)
    try {
      await changePatientPassword({
        current_password: pwForm.currentPassword,
        new_password: pwForm.newPassword,
      })
      toast.success('Your password has been changed successfully. Please log in again.', 'Password Changed')
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }, 1500)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password.')
    } finally {
      setPwSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateMyProfile({
        phone: form.phone || null,
        medical_history: form.medical_history || null,
        insurance_plan: form.insurance_plan || null,
        insurance_member_id: form.insurance_member_id || null,
        insurance_group_number: form.insurance_group_number || null,
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

  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [swapSaving, setSwapSaving] = useState(false)

  const handleSwapToggle = async () => {
    setSwapSaving(true)
    try {
      await updateMyProfile({ allow_severity_swap: !user?.allow_severity_swap })
      const token = localStorage.getItem('token')
      if (token) loginUser(token)
      toast.success('Scheduling preference updated.')
    } catch {
      toast.error('Could not update your preference right now.')
    } finally {
      setSwapSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportMyData()
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'curaline-my-data.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Your data has been downloaded.')
    } catch {
      toast.error('Could not export your data right now.')
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete your account and erase your health data? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteMyAccount()
      toast.success('Your account has been deleted.')
      logout()
      window.location.href = '/'
    } catch {
      toast.error('Could not delete your account right now.')
      setDeleting(false)
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

          {/* Insurance member ID + group (needed for real-time eligibility) */}
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="profile-member-id" className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Member ID
                </label>
                <input
                  id="profile-member-id"
                  className="input-field"
                  placeholder="e.g. XYZ123456"
                  value={form.insurance_member_id}
                  onChange={(e) => setForm((f) => ({ ...f, insurance_member_id: e.target.value }))}
                  maxLength={50}
                />
              </div>
              <div>
                <label htmlFor="profile-group" className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Group # <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="profile-group"
                  className="input-field"
                  placeholder="e.g. GRP-77"
                  value={form.insurance_group_number}
                  onChange={(e) => setForm((f) => ({ ...f, insurance_group_number: e.target.value }))}
                  maxLength={50}
                />
              </div>
            </div>
          )}

          {/* Real-time eligibility check */}
          {!editing && user?.insurance_plan && (
            <div>
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="btn-secondary w-full disabled:opacity-50"
              >
                {verifying ? (
                  <><div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Checking coverage…</>
                ) : (
                  <><FiShield size={15} /> Check my coverage</>
                )}
              </button>
              {coverage && (
                <div
                  className={`mt-3 rounded-xl p-3.5 flex items-start gap-2.5 ${
                    coverage.active ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'
                  }`}
                >
                  {coverage.active
                    ? <FiCheckCircle className="text-emerald-600 mt-0.5 flex-shrink-0" size={16} />
                    : <FiAlertCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={16} />}
                  <div>
                    <p className={`text-sm font-semibold ${coverage.active ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {coverage.message}
                      {coverage.sandbox && <span className="ml-1 text-[10px] uppercase tracking-wide font-bold text-gray-400">Demo</span>}
                    </p>
                    {coverage.copay_estimate != null && (
                      <p className="text-xs text-gray-600 mt-0.5">Estimated copay: ${coverage.copay_estimate}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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

      {/* Change Password Card */}
      <div className="card animate-slide-up mt-5" style={{ animationDelay: '180ms' }}>
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FiKey className="text-gray-400" /> Security
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                className="input-field pr-10"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showCurrent ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className="input-field pr-10"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="input-field pr-10"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Repeat new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pwSaving}
            className="btn-primary w-full mt-2 disabled:opacity-50"
          >
            {pwSaving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating…</>
            ) : (
              'Change Password'
            )}
          </button>
        </form>
      </div>

      {/* Flexible scheduling (severity-swap consent) */}
      <div className="card animate-slide-up mt-5" style={{ animationDelay: '210ms' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <FiRefreshCw className="text-gray-400" /> Flexible scheduling
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Allow CuraLine to ask you to give up your appointment time for a more urgent patient.
              You'll always be asked first and can decline — and we'll never move an appointment that's about to start.
            </p>
          </div>
          <button
            onClick={handleSwapToggle}
            disabled={swapSaving}
            role="switch"
            aria-checked={!!user?.allow_severity_swap}
            aria-label="Flexible scheduling"
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${user?.allow_severity_swap ? 'bg-primary-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${user?.allow_severity_swap ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Privacy & data card */}
      <div className="card animate-slide-up mt-5" style={{ animationDelay: '240ms' }}>
        <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
          <FiDatabase className="text-gray-400" /> Privacy &amp; data
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Download everything we hold about you, or permanently delete your account and erase your health data.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary w-full mb-3 disabled:opacity-50"
        >
          <FiDownload size={15} /> {exporting ? 'Preparing…' : 'Download my data'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <FiTrash2 size={15} /> {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </div>
  )
}
