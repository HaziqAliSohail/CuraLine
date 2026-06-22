import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { listAdminHospitals, decideHospital, verifyHospitalNpi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { FiHome, FiCheck, FiX, FiMapPin, FiPhone, FiInbox, FiShield } from 'react-icons/fi'

const STATUS_BADGE = {
  PENDING:  { color: 'bg-amber-50 text-amber-700',     label: 'Awaiting verification' },
  VERIFIED: { color: 'bg-emerald-50 text-emerald-700', label: 'Verified' },
  REJECTED: { color: 'bg-red-50 text-red-700',         label: 'Rejected' },
}

const NPI_BADGES = {
  VERIFIED:  { color: 'bg-emerald-50 text-emerald-700', label: 'Org NPI verified' },
  MISMATCH:  { color: 'bg-amber-50 text-amber-700',     label: 'Org NPI name mismatch' },
  NOT_FOUND: { color: 'bg-red-50 text-red-700',         label: 'Org NPI not found' },
  ERROR:     { color: 'bg-gray-100 text-gray-600',      label: 'Registry unavailable' },
}

const FILTERS = [
  { key: 'PENDING', label: 'Pending' },
  { key: '', label: 'All' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'REJECTED', label: 'Rejected' },
]

function HospitalCard({ hospital, onDecide, acting, onVerifyNpi, npiResult, verifying }) {
  const badge = STATUS_BADGE[hospital.verification_status]
  const npiBadge = npiResult ? NPI_BADGES[npiResult.status] : null
  const decided = hospital.verification_status !== 'PENDING'

  return (
    <div className="card animate-fade-in">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <FiHome className="text-primary-500" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 truncate">{hospital.name}</p>
            {badge && (
              <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-lg ${badge.color}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            {hospital.address && <span className="flex items-center gap-1"><FiMapPin size={11} /> {hospital.address}</span>}
            {hospital.phone && <span className="flex items-center gap-1"><FiPhone size={11} /> {hospital.phone}</span>}
          </div>
          {hospital.org_npi && (
            <div className="mt-2">
              {npiBadge ? (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${npiBadge.color}`}>
                  <FiShield size={11} /> {npiBadge.label}
                  {npiResult?.registry_name && ` - ${npiResult.registry_name}`}
                </span>
              ) : (
                <button
                  onClick={() => onVerifyNpi(hospital.id)}
                  disabled={verifying}
                  className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  <FiShield size={11} /> {verifying ? 'Checking registry…' : `Verify org NPI ${hospital.org_npi}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!decided && (
        <>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            Confirm this is a real, licensed organization (org NPI + business
            license) before verifying. A verified hospital's admin can then
            approve its own doctors.
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => onDecide(hospital.id, 'reject')}
              disabled={!!acting}
              className="btn-secondary flex-1 text-sm disabled:opacity-50"
            >
              {acting === 'reject' ? 'Rejecting…' : <><FiX size={13} /> Reject</>}
            </button>
            <button
              onClick={() => onDecide(hospital.id, 'approve')}
              disabled={!!acting}
              className="btn-primary flex-1 text-sm disabled:opacity-50"
            >
              {acting === 'approve' ? 'Verifying…' : <><FiCheck size={13} /> Verify & Activate</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function AdminHospitals() {
  const { user, role } = useAuth()
  const toast = useToast()
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDING')
  const [acting, setActing] = useState({})
  const [npiResults, setNpiResults] = useState({})
  const [npiVerifying, setNpiVerifying] = useState({})

  const fetchHospitals = async (status) => {
    setLoading(true)
    try {
      const res = await listAdminHospitals(status)
      setHospitals(res.data)
    } catch {
      toast.error('Could not load hospitals.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (role === 'admin') fetchHospitals(filter)
  }, [role, filter])

  // Platform-operator-only page
  if (user && role !== 'admin') return <Navigate to="/" replace />

  const handleVerifyNpi = async (id) => {
    setNpiVerifying((p) => ({ ...p, [id]: true }))
    try {
      const res = await verifyHospitalNpi(id)
      setNpiResults((p) => ({ ...p, [id]: res.data }))
      const s = res.data.status
      if (s === 'VERIFIED') toast.success(`Registry match: ${res.data.registry_name}`, 'Org NPI Verified')
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
      await decideHospital(id, action)
      if (action === 'approve') {
        toast.success('Hospital verified - its admin can now approve doctors.', 'Hospital Verified')
      } else {
        toast.info('Hospital rejected.', 'Hospital Rejected')
      }
      fetchHospitals(filter)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not process the decision.')
    } finally {
      setActing((p) => ({ ...p, [id]: null }))
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold text-gray-900">Hospital Verification</h1>
        <p className="text-gray-400 text-sm mt-1">
          You are the root of trust: verify organizations before they can onboard
          their own doctors.
        </p>
      </div>

      <div className="flex gap-1.5 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              filter === f.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
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
            </div>
          ))}
        </div>
      ) : hospitals.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiInbox className="text-gray-300" size={26} />
          </div>
          <p className="font-semibold text-gray-500">Nothing here</p>
          <p className="text-sm text-gray-400 mt-1">Hospital applications will appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hospitals.map((h) => (
            <HospitalCard
              key={h.id}
              hospital={h}
              onDecide={handleDecide}
              acting={acting[h.id]}
              onVerifyNpi={handleVerifyNpi}
              npiResult={npiResults[h.id]}
              verifying={npiVerifying[h.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
