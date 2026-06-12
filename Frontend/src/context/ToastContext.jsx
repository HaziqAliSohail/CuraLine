import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi'

const ToastContext = createContext(null)

const VARIANTS = {
  success: {
    icon: FiCheckCircle,
    bar: 'bg-emerald-500',
    bg: 'bg-white border-l-4 border-emerald-500',
    icon_color: 'text-emerald-500',
    title_color: 'text-emerald-800',
  },
  error: {
    icon: FiAlertCircle,
    bar: 'bg-red-500',
    bg: 'bg-white border-l-4 border-red-500',
    icon_color: 'text-red-500',
    title_color: 'text-red-800',
  },
  warning: {
    icon: FiAlertTriangle,
    bar: 'bg-amber-500',
    bg: 'bg-white border-l-4 border-amber-500',
    icon_color: 'text-amber-500',
    title_color: 'text-amber-800',
  },
  info: {
    icon: FiInfo,
    bar: 'bg-primary-500',
    bg: 'bg-white border-l-4 border-primary-500',
    icon_color: 'text-primary-500',
    title_color: 'text-primary-800',
  },
}

function ToastItem({ toast, onDismiss }) {
  const variant = VARIANTS[toast.type] || VARIANTS.info
  const Icon = variant.icon

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-start gap-3 w-80 rounded-xl p-4 shadow-lg shadow-gray-200/60
        ${variant.bg} animate-toast-in
      `}
    >
      <Icon className={`${variant.icon_color} flex-shrink-0 mt-0.5`} size={18} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`font-semibold text-sm ${variant.title_color}`}>{toast.title}</p>
        )}
        <p className="text-sm text-gray-600 mt-0.5">{toast.message}</p>
        {/* Auto-dismiss progress bar */}
        <div className="mt-2 h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${variant.bar} animate-progress`} />
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
      >
        <FiX size={16} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, type, title, message }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  // Convenience methods
  toast.success = (message, title) => toast({ type: 'success', title, message })
  toast.error   = (message, title) => toast({ type: 'error', title, message })
  toast.warning = (message, title) => toast({ type: 'warning', title, message })
  toast.info    = (message, title) => toast({ type: 'info', title, message })

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast stack — fixed bottom-right */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-6 right-6 flex flex-col gap-3 z-[9999] pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
