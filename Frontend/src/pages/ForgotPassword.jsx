import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/client'
import { FiMail } from 'react-icons/fi'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch {
      setSent(true) // same UX either way — never reveal whether the email exists
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-5">
      <div className="max-w-md w-full bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
        {sent ? (
          <div className="text-center">
            <FiMail className="mx-auto text-primary-500" size={36} />
            <h1 className="mt-4 text-lg font-bold text-gray-900">Check your email</h1>
            <p className="mt-2 text-sm text-gray-500">
              If an account exists for <span className="font-medium text-gray-700">{email}</span>,
              we've sent a link to reset your password. It expires in 1 hour.
            </p>
            <Link to="/login" className="btn-secondary inline-block mt-6">Back to sign in</Link>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold text-gray-900">Reset your password</h1>
            <p className="mt-1 text-sm text-gray-500">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={submit} className="mt-5 space-y-3">
              <input
                type="email"
                required
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={loading || !email}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <Link to="/login" className="block text-center text-sm text-primary-600 hover:text-primary-700 mt-4">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
