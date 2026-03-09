import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import AnalyticsSummary from './AnalyticsSummary'

describe('AnalyticsSummary', () => {
  it('renders all three stat cards', () => {
    render(
      <AnalyticsSummary
        analytics={{ total_sessions: 12, total_minutes: 360, average_duration: 30, sessions_by_day: {} }}
      />
    )
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('360')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
    expect(screen.getByText('Total Minutes')).toBeInTheDocument()
    expect(screen.getByText('Avg Duration (min)')).toBeInTheDocument()
  })

  it('rounds average duration', () => {
    render(
      <AnalyticsSummary
        analytics={{ total_sessions: 3, total_minutes: 100, average_duration: 33.333, sessions_by_day: {} }}
      />
    )
    expect(screen.getByText('33')).toBeInTheDocument()
  })

  it('renders zeros for empty analytics', () => {
    render(
      <AnalyticsSummary
        analytics={{ total_sessions: 0, total_minutes: 0, average_duration: 0, sessions_by_day: {} }}
      />
    )
    expect(screen.getAllByText('0')).toHaveLength(3)
  })
})
