import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import SeverityBadge from '../components/SeverityBadge'
import { FiSend, FiLoader } from 'react-icons/fi'

export default function Chat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        `Hello ${user?.name || 'there'}! I'm CuraLine's AI assistant. ` +
        `Tell me about your symptoms and I'll help book the right appointment for you.\n\n` +
        `For example: "I have severe chest pain radiating to my left arm for the past 2 hours."`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationHistory, setConversationHistory] = useState([])
  const [collectedFields, setCollectedFields] = useState({})
  const [bookingResult, setBookingResult] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await sendMessage({
        message: text,
        conversation_history: conversationHistory,
        collected_fields: collectedFields,
      })

      const data = res.data
      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: text },
        { role: 'assistant', content: data.message },
      ]
      setConversationHistory(newHistory)
      setCollectedFields(data.collected_fields || collectedFields)

      // Add assistant reply
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          severity_score: data.severity_score,
          is_appointment_booked: data.is_appointment_booked,
          appointment_id: data.appointment_id,
          stage: data.stage,
        },
      ])

      if (data.is_appointment_booked) {
        setBookingResult(data)
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          error: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <h1 className="text-lg font-bold text-gray-900">AI Appointment Booking</h1>
        <p className="text-sm text-gray-500">
          Describe your symptoms and our AI will assess severity and book the right doctor.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : msg.error
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Severity badge */}
              {msg.severity_score && msg.severity_score > 0 && (
                <div className="mt-2">
                  <SeverityBadge score={msg.severity_score} />
                </div>
              )}

              {/* Booking confirmation */}
              {msg.is_appointment_booked && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => navigate('/appointments')}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    View My Appointments &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-gray-400">
              <FiLoader className="animate-spin" size={16} />
              <span className="text-sm">Analyzing...</span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      {bookingResult ? (
        <div className="p-4 bg-green-50 border-t border-green-200 text-center">
          <p className="text-green-700 font-medium">Appointment booked successfully!</p>
          <button
            onClick={() => navigate('/appointments')}
            className="btn-primary mt-2"
          >
            View Appointments
          </button>
        </div>
      ) : (
        <div className="p-4 bg-white border-t">
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="Describe your symptoms..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              className="btn-primary flex items-center gap-2"
              disabled={loading || !input.trim()}
            >
              <FiSend size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
