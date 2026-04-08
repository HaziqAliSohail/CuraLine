import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SeverityBadge from '../components/SeverityBadge'

describe('SeverityBadge', () => {
  it('renders score 1 as Routine', () => {
    render(<SeverityBadge score={1} />)
    expect(screen.getByText(/Routine/)).toBeInTheDocument()
    expect(screen.getByText(/1\/5/)).toBeInTheDocument()
  })

  it('renders score 3 as Moderate', () => {
    render(<SeverityBadge score={3} />)
    expect(screen.getByText(/Moderate/)).toBeInTheDocument()
  })

  it('renders score 5 as Critical', () => {
    render(<SeverityBadge score={5} />)
    expect(screen.getByText(/Critical/)).toBeInTheDocument()
  })

  it('falls back to Routine for unknown score', () => {
    render(<SeverityBadge score={99} />)
    expect(screen.getByText(/Routine/)).toBeInTheDocument()
  })

  it('applies correct color classes for high severity', () => {
    const { container } = render(<SeverityBadge score={4} />)
    const badge = container.querySelector('span')
    expect(badge.className).toContain('bg-orange-100')
  })
})
