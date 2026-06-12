import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Doctors from '../pages/Doctors'
import { MemoryRouter } from 'react-router-dom'
import * as apiClient from '../api/client'

// Mock useToast so the component doesn't crash without ToastProvider
vi.mock('../context/ToastContext', () => ({
  useToast: () => Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

vi.mock('../api/client', () => ({
  listDoctors: vi.fn(),
  listSlots: vi.fn(),
  createAppointment: vi.fn(),
}))

describe('Doctors page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders doctors list and opens slot picker modal on click', async () => {
    const mockDoctors = [
      {
        id: 1,
        name: 'Dr. John Doe',
        specialization: 'Cardiology',
        qualification: 'MD',
        availability_status: 'AVAILABLE',
        rating: 5,
        consultation_fee: '150.00',
        reporting_time: '09:00:00',
        leaving_time: '17:00:00',
      },
    ]

    const mockSlots = [
      {
        id: 101,
        doctor_id: 1,
        date: '2026-06-15',
        start_time: '10:00:00',
        duration_minutes: 30,
        is_available: true,
      },
    ]

    apiClient.listDoctors.mockResolvedValue({ data: mockDoctors })
    apiClient.listSlots.mockResolvedValue({ data: mockSlots })
    apiClient.createAppointment.mockResolvedValue({ data: { id: 501 } })

    render(
      <MemoryRouter>
        <Doctors />
      </MemoryRouter>
    )

    // Wait for doctor to appear
    await waitFor(() => {
      expect(screen.getByText('Dr. John Doe')).toBeInTheDocument()
      expect(screen.getByText('Cardiology')).toBeInTheDocument()
    })

    // Doctor is AVAILABLE — "View Slots" button should exist
    const viewSlotsBtn = screen.getByRole('button', { name: /Book appointment with Dr. John Doe/i })
    fireEvent.click(viewSlotsBtn)

    // Modal should open with doctor name
    await waitFor(() => {
      // Modal header should show the doctor name
      expect(screen.getAllByText('Dr. John Doe').length).toBeGreaterThan(0)
      // Modal should show "Select a time slot"
      expect(screen.getByText(/Select a time slot/i)).toBeInTheDocument()
    })

    // Click a slot to book it
    await waitFor(() => {
      // The slot should appear (date formatted)
      expect(screen.getAllByRole('button').length).toBeGreaterThan(1)
    })

    // Verify listSlots was called with the doctor's ID
    expect(apiClient.listSlots).toHaveBeenCalledWith({ doctor_id: 1, available_only: true })
  })
})
