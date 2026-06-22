import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { listDoctorApplications, decideDoctorApplication, inviteDoctor, verifyDoctorNpi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { FiUserCheck, FiCheck, FiX, FiFileText, FiMail, FiPhone, FiInbox, FiSend, FiCopy, FiShield } from 'react-icons/fi'

const SPECIALIZATIONS = [
  'Cardiology', 'Neurology', 'Orthopedics', 'Dermatology', 'Pediatrics',
  'Gastroenterology', 'Pulmonology', 'General Medicine',
]

function InviteDoctorCard() {
  const toast = useToast()
  const [form, setForm] = useState({
    name: '', gender: 'FEMALE', email: '',
    specialization: 'General Medicine', qualification: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [inviteLink, setInviteLink] = useState(null)

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await inviteDoctor(form)
      setInviteLink(res.data.invite_link)
      toast.success(
        `Invite sent to ${form.email}. The doctor sets their own password - you never see it.`,
        'Doctor Invited'
      )
      setForm({ name: '', gender: 'FEMALE', email: '', specialization: 'General Medicine', qualification: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send the invite.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast.info('Invite link copied to clipboard.')
    } catch {
      toast.error('Could not copy - select and copy the link manually.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3 mb-6 animate-slide-up">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
          <FiSend className="text-primary-600" size={15} />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Invite a Doctor</p>
          <p className="text-xs text-gray-400">They receive a one-time link and choose their own password.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="inv-name" className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
          <input id="inv-name" className="input-field text-sm" placeholder="Dr. Jane Smith"
            value={form.name} onChange={set('name')} maxLength={50} required />
        </div>
        <div>
          <label htmlFor="inv-email" className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input id="inv-email" type="email" className="input-field text-sm" placeholder="doctor@hospital.com"
            value={form.email} onChange={set('email')} maxLength={50} required />
        </div>
        <div>
          <label htmlFor="inv-spec" className="block text-xs font-medium text-gray-600 mb-1">Specialization</label>
          <select id="inv-spec" className="input-field text-sm" value={form.specialization} onChange={set('specialization')}>
            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="inv-qual" className="block text-xs font-medium text-gray-600 mb-1">Qualification</label>
          <input id="inv-qual" className="input-field text-sm" placeholder="MD, FACC"
            value={form.qualification} onChange={set('qualification')} maxLength={100} required />
        </div>
        <div>
          <label htmlFor="inv-gender" className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
          <select id="inv-gender" className="input-field text-sm" value={form.gender} onChange={set('gender')}>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full text-sm" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </div>

      {inviteLink && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2">
          <p className="text-xs text-emerald-800 truncate flex-1" title={inviteLink}>{inviteLink}</p>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex-shrink-0"
            aria-label="Copy invite link"
          >
            <FiCopy size={12} /> Copy
          </button>
        </div>
      )}
    </form>
  )
}

const NPI_BADGES = {
  VERIFIED:  { color: 'bg-emerald-50 text-emerald-700', label: 'NPI verified' },
  MISMATCH:  { color: 'bg-amber-50 text-amber-700',     label: 'NPI name mismatch' },
  NOT_FOUND: { color: 'bg-red-50 text-red-700',         label: 'NPI not found' },
  ERROR:     { color: 'bg-gray-100 text-gray-600',      label: 'Registry unavailable' },
}

function ApplicationCard({ app, onDecide, acting, onVerifyNpi, npiResult, verifying }) {
  const npiStatus = npiResult?.status || (app.npi_verification_status !== 'UNVERIFIED' ? app.npi_verification_status : null)
  const badge = npiStatus ? NPI_BADGES[npiStatus] : null

  return (
    <div className="card animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <FiUserCheck className="text-primary-500" size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{app.name}</p>
            <p className="text-xs text-primary-600 font-medium">{app.specialization} · {app.qualification}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><FiMail size={11} /> {app.email}</span>
              {app.phone && <span className="flex items-center gap-1"><FiPhone size={11} /> {app.phone}</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
                <FiFileText size={11} /> License: {app.license_number || '-'}
              </span>
              {app.npi_number && (
                badge ? (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${badge.color}`}>
                    <FiShield size={11} /> {badge.label}
                    {npiResult?.registry_name && ` - ${npiResult.registry_name}`}
                  </span>
                ) : (
                  <button
                    onClick={() => onVerifyNpi(app.id)}
                    disabled={verifying}
                    className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <FiShield size={11} /> {verifying ? 'Checking registry…' : `Verify NPI ${app.npi_number}`}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3 leading-relaxed">
        Verify the license number against the state medical board before approving.
        Approval makes this doctor visible to patients immediately.
      </p>

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => onDecide(app.id, 'reject')}
          disabled={!!acting}
          className="btn-secondary flex-1 text-sm disabled:opacity-50"
        >
          {acting === 'reject' ? 'Rejecting…' : <><FiX size={13} /> Reject</>}
        </button>
        <button
          onClick={() => onDecide(app.id, 'approve')}
          disabled={!!acting}
          className="btn-primary flex-1 text-sm disabled:opacity-50"
        >
          {acting === 'approve' ? 'Approving…' : <><FiCheck size={13} /> Verify & Approve</>}
        </button>
      </div>
    </div>
  )
}

export default function AdminApplications() {
  const { user, role } = useAuth()
  const toast = useToast()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState({})
  const [npiResults, setNpiResults] = useState({})
  const [npiVerifying, setNpiVerifying] = useState({})

  const fetchApplications = async () => {
    try {
      const res = await listDoctorApplications()
      setApplications(res.data)
    } catch {
      toast.error('Could not load applications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (role === 'admin') fetchApplications()
  }, [role])

  // Platform-operator-only page
  if (user && role !== 'admin') return <Navigate to="/" replace />

  const handleVerifyNpi = async (id) => {
    setNpiVerifying((p) => ({ ...p, [id]: true }))
    try {
      const res = await verifyDoctorNpi(id)
      setNpiResults((p) => ({ ...p, [id]: res.data }))
      const s = res.data.status
      if (s === 'VERIFIED') toast.success(`Registry match: ${res.data.registry_name}`, 'NPI Verified')
      else if (s === 'MISMATCH') toast.error(`NPI belongs to ${res.data.registry_name} - review carefully.`, 'Name Mismatch')
      else if (s === 'NOT_FOUND') toast.error('This NPI does not exist in the CMS registry.', 'NPI Not Found')
      else toast.info('Registry unreachable - verify manually at npiregistry.cms.hhs.gov.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not verify the NPI.')
    } finally {
      setNpiVerifying((p) => ({ ...p, [id]: false }))
    }
  }

  const handleDecide = async (id, action) => {
    setActing((p) => ({ ...p, [id]: action }))
    try {
      await decideDoctorApplication(id, action)
      if (action === 'approve') {
        toast.success('Doctor approved - they can now sign in and patients can book them.', 'Application Approved')
      } else {
        toast.info('Application rejected.', 'Application Rejected')
      }
      fetchApplications()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not process the decision.')
    } finally {
      setActing((p) => ({ ...p, [id]: null }))
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold text-gray-900">Doctor Onboarding</h1>
        <p className="text-gray-400 text-sm mt-1">
          Invite vetted doctors directly, or review incoming applications.
        </p>
      </div>

      <InviteDoctorCard />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex gap-3">
                <div className="skeleton w-11 h-11 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-3 w-2/3" />
                </div>
              </div>
              <div className="skeleton h-10 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiInbox className="text-gray-300" size={26} />
          </div>
          <p className="font-semibold text-gray-500">No pending applications</p>
          <p className="text-sm text-gray-400 mt-1">New doctor applications will appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              onDecide={handleDecide}
              acting={acting[app.id]}
              onVerifyNpi={handleVerifyNpi}
              npiResult={npiResults[app.id]}
              verifying={npiVerifying[app.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
