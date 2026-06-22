import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { listDoctorApplications, decideDoctorApplication } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { FiUserCheck, FiCheck, FiX, FiFileText, FiMail, FiPhone, FiInbox, FiShield } from 'react-icons/fi'

const NPI_BADGES = {
  VERIFIED:  { color: 'bg-emerald-50 text-emerald-700', label: 'NPI verified' },
  MISMATCH:  { color: 'bg-amber-50 text-amber-700',     label: 'NPI name mismatch' },
  NOT_FOUND: { color: 'bg-red-50 text-red-700',         label: 'NPI not found' },
}

function ApplicationCard({ app, onDecide, acting }) {
  const npiStatus = app.npi_verification_status !== 'UNVERIFIED' ? app.npi_verification_status : null
  const badge = npiStatus ? NPI_BADGES[npiStatus] : null

  return (
    <div className="card animate-fade-in">
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
            {badge && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${badge.color}`}>
                <FiShield size={11} /> {badge.label}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3 leading-relaxed">
        Verify the license against the state medical board before approving.
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

export default function DoctorApplications() {
  const { user, role } = useAuth()
  const toast = useToast()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState({})

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
    if (user?.is_hospital_admin) fetchApplications()
  }, [user])

  // Only hospital-admin doctor accounts can see this page
  if (user && !(role === 'doctor' && user.is_hospital_admin)) return <Navigate to="/doctor" replace />

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
        <h1 className="text-2xl font-bold text-gray-900">Doctor Applications</h1>
        <p className="text-gray-400 text-sm mt-1">
          Review doctors applying to {user?.hospital_name || 'your hospital'} and approve your own roster.
        </p>
      </div>

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
          <p className="text-sm text-gray-400 mt-1">Doctors who apply to your hospital will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <ApplicationCard key={app.id} app={app} onDecide={handleDecide} acting={acting[app.id]} />
          ))}
        </div>
      )}
    </div>
  )
}
