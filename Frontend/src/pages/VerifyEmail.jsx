import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { verifyEmail } from '../api/client'
import { FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi'

export default function VerifyEmail() {
  const { token } = useParams()
  const [status, setStatus] = useState('verifying') // verifying | success | error

  useEffect(() => {
    let active = true
    verifyEmail(token)
      .then(() => active && setStatus('success'))
      .catch(() => active && setStatus('error'))
    return () => { active = false }
  }, [token])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-5">
      <div className="max-w-md w-full bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center">
        {status === 'verifying' && (
          <>
            <FiLoader className="mx-auto text-primary-500 animate-spin" size={36} />
            <h1 className="mt-4 text-lg font-bold text-gray-900">Verifying your email…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <FiCheckCircle className="mx-auto text-emerald-500" size={40} />
            <h1 className="mt-4 text-lg font-bold text-gray-900">Email verified</h1>
            <p className="mt-2 text-sm text-gray-500">Your email address is confirmed. You're all set.</p>
            <Link to="/login" className="btn-primary inline-block mt-6">Continue to sign in</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <FiXCircle className="mx-auto text-red-500" size={40} />
            <h1 className="mt-4 text-lg font-bold text-gray-900">Link invalid or expired</h1>
            <p className="mt-2 text-sm text-gray-500">This verification link is no longer valid. Sign in to request a new one.</p>
            <Link to="/login" className="btn-secondary inline-block mt-6">Go to sign in</Link>
          </>
        )}
      </div>
    </div>
  )
}
