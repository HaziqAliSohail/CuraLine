import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendMessage, getConsent, acceptConsent } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import SeverityBadge from '../components/SeverityBadge'
import { FiSend, FiAlertOctagon, FiCalendar, FiPhone, FiAlertTriangle, FiActivity, FiHeart, FiShield } from 'react-icons/fi'

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}

function EmergencyBanner({ analysis }) {
  return (
    <div className="mx-4 mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 animate-scale-up">
      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <FiAlertOctagon className="text-red-600" size={20} />
      </div>
      <div>
        <p className="font-bold text-red-800 text-sm">Emergency Detected - Call 911 Now</p>
        <p className="text-red-600 text-xs mt-1 leading-relaxed">{analysis}</p>
        <a
          href="tel:911"
          className="inline-flex items-center gap-1.5 mt-3 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
        >
          <FiPhone size={12} /> Call Emergency Services
        </a>
      </div>
    </div>
  )
}

function NoSlotsBanner() {
  return (
    <div className="mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 animate-scale-up">
      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <FiCalendar className="text-amber-600" size={18} />
      </div>
      <div>
        <p className="font-bold text-amber-800 text-sm">No Available Slots Found</p>
        <p className="text-amber-600 text-xs mt-1">Please call the hospital directly or try browsing doctors for available times.</p>
      </div>
    </div>
  )
}

/* ── Urgent Guidance Banner ────────────────────────────────────────── */
const GUIDANCE_CONFIG = {
  EMERGENCY: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    titleColor: 'text-red-800',
    textColor: 'text-red-600',
    disclaimerColor: 'text-red-400',
    Icon: FiAlertOctagon,
    title: 'Emergency - Call 911 Immediately',
  },
  URGENT_CARE: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    titleColor: 'text-orange-800',
    textColor: 'text-orange-600',
    disclaimerColor: 'text-orange-400',
    Icon: FiAlertTriangle,
    title: 'Visit Nearest Urgent Care',
  },
  TELEHEALTH: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-800',
    textColor: 'text-blue-600',
    disclaimerColor: 'text-blue-400',
    Icon: FiActivity,
    title: 'Schedule a Telehealth Visit',
  },
  FIRST_AID: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-800',
    textColor: 'text-emerald-600',
    disclaimerColor: 'text-emerald-400',
    Icon: FiHeart,
    title: 'First Aid Recommendation',
  },
}

function UrgentGuidanceBanner({ guidanceType, guidance }) {
  if (!guidanceType || !guidance) return null

  const config = GUIDANCE_CONFIG[guidanceType]
  if (!config) return null

  const { bg, border, iconBg, iconColor, titleColor, textColor, disclaimerColor, Icon, title } = config

  // Split guidance from the disclaimer (they're separated by double newline)
  const [mainGuidance, ...disclaimerParts] = guidance.split('\n\n')
  const disclaimer = disclaimerParts.join('\n\n')

  return (
    <div
      id={`guidance-banner-${guidanceType.toLowerCase()}`}
      className={`mx-4 mb-3 ${bg} border ${border} rounded-2xl p-4 flex items-start gap-3 animate-scale-up`}
    >
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon className={iconColor} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <FiShield className={iconColor} size={12} />
          <p className={`font-bold ${titleColor} text-sm`}>{title}</p>
        </div>
        <p className={`${textColor} text-xs mt-1 leading-relaxed`}>{mainGuidance}</p>
        {disclaimer && (
          <p className={`${disclaimerColor} text-[11px] mt-2 leading-relaxed italic`}>{disclaimer}</p>
        )}
      </div>
    </div>
  )
}

function ConsentGate({ info, accepting, onAccept }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-gray-100 rounded-2xl shadow-sm p-6 animate-scale-up">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
          <FiShield className="text-primary-600" size={22} />
        </div>
        <h2 className="text-lg font-bold text-gray-900">{info?.title || 'Before we begin'}</h2>
        <p className="text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-wrap">{info?.text}</p>
        <button
          onClick={onAccept}
          disabled={accepting}
          className="btn-primary w-full mt-5 disabled:opacity-50"
        >
          {accepting ? 'One moment…' : 'I understand and agree'}
        </button>
      </div>
    </div>
  )
}

function BookingSuccessCard({ data, onViewAppointments }) {
  return (
    <div className="p-4 border-t border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 animate-slide-up">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <FiCalendar className="text-emerald-600" size={18} />
        </div>
        <div>
          <p className="font-bold text-emerald-800">Appointment Confirmed!</p>
          <p className="text-emerald-600 text-xs">Your slot has been reserved.</p>
        </div>
      </div>
      <button
        onClick={onViewAppointments}
        className="w-full btn-primary text-sm"
      >
        View My Appointments
      </button>
    </div>
  )
}

export default function Chat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        `Hello ${user?.name?.split(' ')[0] || 'there'}! I'm CuraLine's AI assistant. ` +
        `Tell me about your symptoms and I'll help book the right appointment for you.\n\n` +
        `For example: "I have severe chest pain radiating to my left arm for the past 2 hours."`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationHistory, setConversationHistory] = useState([])
  const [collectedFields, setCollectedFields] = useState({})
  const [bookingResult, setBookingResult] = useState(null)
  const [stage, setStage] = useState(null)
  const [latestGuidance, setLatestGuidance] = useState(null)
  const [consent, setConsent] = useState(null)
  const [accepting, setAccepting] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Triage is gated on accepting the current medical disclaimer.
  useEffect(() => {
    getConsent().then((r) => setConsent(r.data)).catch(() => setConsent({ accepted: true }))
  }, [])

  const handleAccept = async () => {
    setAccepting(true)
    try {
      await acceptConsent()
      setConsent((c) => ({ ...c, accepted: true }))
    } catch {
      toast.error('Could not record your consent. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const data = await sendMessage({
        message: text,
        conversation_history: conversationHistory,
        collected_fields: collectedFields,
      })

      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: text },
        { role: 'assistant', content: data.message },
      ]
      setConversationHistory(newHistory)
      setCollectedFields(data.collected_fields || collectedFields)
      setStage(data.stage)

      // Track guidance for banner rendering
      if (data.urgent_guidance && data.guidance_type) {
        setLatestGuidance({
          type: data.guidance_type,
          text: data.urgent_guidance,
        })
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          severity_score: data.severity_score,
          is_appointment_booked: data.is_appointment_booked,
          appointment_id: data.appointment_id,
          stage: data.stage,
          urgent_guidance: data.urgent_guidance,
          guidance_type: data.guidance_type,
        },
      ])

      if (data.is_appointment_booked) {
        setBookingResult(data)
        toast.success('Your appointment has been successfully booked!', 'Booked!')
      }
    } catch (err) {
      // Server enforces the consent gate too — surface it instead of an error.
      const detail = err.response?.data?.detail
      if (err.response?.status === 403 && detail?.code === 'consent_required') {
        try { const r = await getConsent(); setConsent(r.data) }
        catch { setConsent({ accepted: false, title: 'Before we begin', text: '' }) }
        return
      }
      const msg = (typeof detail === 'string' ? detail : null) || err.message || 'Sorry, I encountered an error. Please try again.'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: msg, error: true },
      ])
      toast.error(msg, 'Connection Error')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const charCount = input.length
  const isOverLimit = charCount > 1000

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <h1 className="text-lg font-bold text-gray-900">AI Appointment Booking</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Describe your symptoms - our AI assesses severity and books the right doctor.
        </p>
      </div>

      {consent && consent.accepted === false ? (
        <ConsentGate info={consent} accepting={accepting} onAccept={handleAccept} />
      ) : (
      <>
      {/* Messages */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Chat conversation"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-primary-600 to-primary-500 text-white rounded-br-sm'
                    : msg.error
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-sm'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {msg.severity_score > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/20">
                    <SeverityBadge score={msg.severity_score} />
                  </div>
                )}

                {msg.is_appointment_booked && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => navigate('/appointments')}
                      className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <FiCalendar size={13} /> View My Appointments →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Inline urgent guidance banner right after the assistant message */}
            {msg.role === 'assistant' && msg.urgent_guidance && msg.guidance_type && (
              <div className="mt-2">
                <UrgentGuidanceBanner
                  guidanceType={msg.guidance_type}
                  guidance={msg.urgent_guidance}
                />
              </div>
            )}
          </div>
        ))}

        {loading && <TypingIndicator />}
        <div ref={endRef} />
      </div>

      {/* Context banners */}
      {stage === 'no_slots' && <NoSlotsBanner />}

      {/* Input, success card, or emergency action */}
      {bookingResult ? (
        <BookingSuccessCard data={bookingResult} onViewAppointments={() => navigate('/appointments')} />
      ) : stage === 'emergency' ? (
        <div className="mx-4 mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3 animate-scale-up">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <FiAlertOctagon className="text-red-600" size={20} />
            </div>
            <div>
              <p className="font-bold text-red-800 text-sm">Emergency Detected - Call 911 Now</p>
              <p className="text-red-600 text-xs mt-1 leading-relaxed">
                Please seek immediate emergency medical care. Chat is disabled due to the critical nature of your symptoms.
              </p>
            </div>
          </div>
          <a
            href="tel:911"
            className="w-full bg-red-600 text-white font-bold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-700 transition-colors shadow-md hover:shadow-lg active:scale-[0.98] duration-150"
          >
            <FiPhone size={14} /> Call Emergency Services
          </a>
        </div>
      ) : (
        <div className="px-4 py-3 bg-white/80 backdrop-blur-sm border-t border-gray-100">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <label htmlFor="chat-input" className="sr-only">Describe your symptoms</label>
              <textarea
                id="chat-input"
                ref={inputRef}
                rows={1}
                className={`input-field resize-none leading-relaxed pr-3 ${isOverLimit ? 'border-red-400 focus:border-red-400 focus:ring-red-300' : ''}`}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                placeholder="Describe your symptoms…"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  // Auto-resize
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                disabled={loading}
                aria-label="Describe your symptoms"
              />
            </div>
            <button
              onClick={handleSend}
              className="btn-primary p-3 flex-shrink-0 rounded-xl disabled:opacity-40"
              disabled={loading || !input.trim() || isOverLimit}
              aria-label="Send message"
            >
              <FiSend size={16} />
            </button>
          </div>
          {isOverLimit && (
            <p className="text-xs text-red-500 mt-1">Message too long ({charCount}/1000 characters)</p>
          )}
          <p className="text-xs text-gray-400 mt-1.5">Press Enter to send · Shift+Enter for new line</p>
        </div>
      )}
      </>
      )}
    </div>
  )
}
