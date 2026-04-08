import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge from '../components/StatusBadge'

describe('StatusBadge', () => {
  it('renders SCHEDULED status', () => {
    render(<StatusBadge status="SCHEDULED" />)
    expect(screen.getByText('SCHEDULED')).toBeInTheDocument()
  })

  it('renders COMPLETED status', () => {
    render(<StatusBadge status="COMPLETED" />)
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
  })

  it('renders CANCELLED status', () => {
    render(<StatusBadge status="CANCELLED" />)
    expect(screen.getByText('CANCELLED')).toBeInTheDocument()
  })

  it('renders NO_SHOW status', () => {
    render(<StatusBadge status="NO_SHOW" />)
    expect(screen.getByText('NO_SHOW')).toBeInTheDocument()
  })

  it('applies blue for SCHEDULED', () => {
    const { container } = render(<StatusBadge status="SCHEDULED" />)
    expect(container.querySelector('span').className).toContain('bg-blue-100')
  })

  it('applies green for COMPLETED', () => {
    const { container } = render(<StatusBadge status="COMPLETED" />)
    expect(container.querySelector('span').className).toContain('bg-green-100')
  })

  it('handles unknown status gracefully', () => {
    const { container } = render(<StatusBadge status="UNKNOWN" />)
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
    expect(container.querySelector('span').className).toContain('bg-gray-100')
  })
})
