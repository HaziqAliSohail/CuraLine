import { useEffect, useState } from 'react'
import { listAuditLogs } from '../api/client'
import { useToast } from '../context/ToastContext'
import { FiShield, FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const PAGE = 50

const ROLE_STYLES = {
  patient: 'bg-primary-50 text-primary-700',
  doctor: 'bg-emerald-50 text-emerald-700',
  admin: 'bg-amber-50 text-amber-700',
  system: 'bg-gray-100 text-gray-600',
}

export default function AdminAuditLog() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (off = offset, action = actionFilter) => {
    setLoading(true)
    try {
      const { data } = await listAuditLogs({ limit: PAGE, offset: off, action: action || undefined })
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load the audit log.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(0, actionFilter) /* eslint-disable-next-line */ }, [])

  const applyFilter = (e) => {
    e.preventDefault()
    setOffset(0)
    load(0, actionFilter)
  }

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '-')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 flex items-center gap-2">
        <FiShield className="text-primary-600" size={22} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-400 text-sm mt-0.5">Append-only record of sensitive actions.</p>
        </div>
      </div>

      <form onSubmit={applyFilter} className="flex gap-2 mb-4">
        <input
          className="input-field flex-1"
          placeholder="Filter by action (e.g. appointment.cancel)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
        <button type="submit" className="btn-secondary px-5">Filter</button>
      </form>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-400 py-16">No audit entries found.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">When</th>
                <th className="text-left px-4 py-2.5 font-semibold">Actor</th>
                <th className="text-left px-4 py-2.5 font-semibold">Action</th>
                <th className="text-left px-4 py-2.5 font-semibold">Target</th>
                <th className="text-left px-4 py-2.5 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{fmt(r.created_at)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_STYLES[r.actor_role] || ROLE_STYLES.system}`}>
                      {r.actor_role}{r.actor_id ? ` #${r.actor_id}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{r.action}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {r.target_type ? `${r.target_type}${r.target_id ? ` #${r.target_id}` : ''}` : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{r.ip_address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-400">
            {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => { const o = Math.max(0, offset - PAGE); setOffset(o); load(o) }}
              className="btn-secondary px-3 py-1.5 disabled:opacity-40"
            >
              <FiChevronLeft size={14} />
            </button>
            <button
              disabled={offset + PAGE >= total}
              onClick={() => { const o = offset + PAGE; setOffset(o); load(o) }}
              className="btn-secondary px-3 py-1.5 disabled:opacity-40"
            >
              <FiChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
