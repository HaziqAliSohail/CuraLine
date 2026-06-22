import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Chat from '../pages/Chat'
import { MemoryRouter } from 'react-router-dom'
import * as apiClient from '../api/client'

// Mock useAuth
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'John Doe', email: 'john@example.com' },
  }),
}))

// Mock useToast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}
vi.mock('../context/ToastContext', () => ({
  useToast: () => mockToast,
}))

// Mock API client
vi.mock('../api/client', () => ({
  sendMessage: vi.fn(),
  // Consent gate: resolve as already-accepted so the chat UI renders.
  getConsent: vi.fn(() => Promise.resolve({ data: { accepted: true } })),
  acceptConsent: vi.fn(() => Promise.resolve()),
}))

describe('Chat Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('renders chat interface and initial greeting', () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Header title and description
    expect(screen.getByText('AI Appointment Booking')).toBeInTheDocument()
    expect(screen.getAllByText(/Describe your symptoms/i).length).toBeGreaterThan(0)

    // Initial AI message greeting John
    expect(screen.getByText(/Hello John/i)).toBeInTheDocument()
  })

  it('sends user message and displays AI reply with severity score', async () => {
    apiClient.sendMessage.mockResolvedValue({
        message: 'Understood. Booking an appointment for you.',
        is_appointment_booked: true,
        appointment_id: 12,
        severity_score: 4,
        stage: 'complete',
        collected_fields: { chief_complaint: 'sore throat' },
    })

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText('Describe your symptoms…')
    const sendBtn = screen.getByLabelText('Send message')

    fireEvent.change(input, { target: { value: 'I have a sore throat.' } })
    fireEvent.click(sendBtn)

    // User message is shown
    expect(screen.getByText('I have a sore throat.')).toBeInTheDocument()

    // Wait for AI reply
    await waitFor(() => {
      expect(screen.getByText('Understood. Booking an appointment for you.')).toBeInTheDocument()
      // Severity badge is shown
      expect(screen.getByText(/4\/5 - High/i)).toBeInTheDocument()
      // Toast notification is triggered
      expect(mockToast.success).toHaveBeenCalledWith(
        'Your appointment has been successfully booked!',
        'Booked!'
      )
    })
  })

  it('shows emergency banner when AI flags emergency stage', async () => {
    apiClient.sendMessage.mockResolvedValue({
        message: 'This sounds like an emergency. Please go to the nearest ER.',
        is_appointment_booked: false,
        severity_score: 5,
        stage: 'emergency',
        collected_fields: {},
    })

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText('Describe your symptoms…')
    const sendBtn = screen.getByLabelText('Send message')

    fireEvent.change(input, { target: { value: 'Chest pain and numbness' } })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(screen.getByText(/Emergency Detected - Call 911 Now/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Call Emergency Services/i })).toBeInTheDocument()
    })
  })

  it('shows no slots banner when AI stage is no_slots', async () => {
    apiClient.sendMessage.mockResolvedValue({
        message: 'No slots available.',
        is_appointment_booked: false,
        severity_score: 3,
        stage: 'no_slots',
        collected_fields: {},
    })

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText('Describe your symptoms…')
    const sendBtn = screen.getByLabelText('Send message')

    fireEvent.change(input, { target: { value: 'Fever' } })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(screen.getByText(/No Available Slots Found/i)).toBeInTheDocument()
    })
  })

  it('renders inline urgent guidance banner when API returns guidance data', async () => {
    apiClient.sendMessage.mockResolvedValue({
        message: 'I have matched your symptoms.',
        is_appointment_booked: false,
        severity_score: 2,
        stage: 'intake',
        collected_fields: {},
        urgent_guidance: 'Take rest and stay hydrated.\n\nThis is general guidance.',
        guidance_type: 'TELEHEALTH',
    })

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText('Describe your symptoms…')
    const sendBtn = screen.getByLabelText('Send message')

    fireEvent.change(input, { target: { value: 'Mild fever' } })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      // The guidance banner should render with correct title and content
      expect(screen.getByText('Schedule a Telehealth Visit')).toBeInTheDocument()
      expect(screen.getByText('Take rest and stay hydrated.')).toBeInTheDocument()
      expect(screen.getByText('This is general guidance.')).toBeInTheDocument()
    })
  })
})
