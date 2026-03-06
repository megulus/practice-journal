import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import SuggestionCard from './SuggestionCard'
import type { Suggestion } from '@/lib/types'

const baseSuggestion: Suggestion = {
  key: 'exercise_1_tempo_increase',
  exercise_id: 1,
  exercise_text: 'G Major Scale',
  type: 'tempo_increase',
  message: 'Ready to try 100 BPM?',
  action: { exercise_id: 1, field: 'tempo_bpm', value: 100 },
}

describe('SuggestionCard', () => {
  it('renders suggestion message and exercise name', () => {
    render(<SuggestionCard suggestion={baseSuggestion} />)
    expect(screen.getByText('G Major Scale')).toBeInTheDocument()
    expect(screen.getByText('Ready to try 100 BPM?')).toBeInTheDocument()
  })

  it('hides exercise name when showExerciseName is false', () => {
    render(<SuggestionCard suggestion={baseSuggestion} showExerciseName={false} />)
    expect(screen.queryByText('G Major Scale')).not.toBeInTheDocument()
    expect(screen.getByText('Ready to try 100 BPM?')).toBeInTheDocument()
  })

  it('shows action buttons when handlers are provided', async () => {
    const onAccept = vi.fn()
    const onDismiss = vi.fn()
    const user = userEvent.setup()

    render(
      <SuggestionCard
        suggestion={baseSuggestion}
        onAccept={onAccept}
        onDismiss={onDismiss}
      />
    )

    await user.click(screen.getByText('Update exercise'))
    expect(onAccept).toHaveBeenCalledOnce()

    await user.click(screen.getByText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onNotYet when Not yet button is clicked', async () => {
    const onNotYet = vi.fn()
    const user = userEvent.setup()

    render(<SuggestionCard suggestion={baseSuggestion} onNotYet={onNotYet} />)

    await user.click(screen.getByText('Not yet'))
    expect(onNotYet).toHaveBeenCalledOnce()
  })

  it('shows action buttons in compact mode', async () => {
    const onAccept = vi.fn()
    const onDismiss = vi.fn()
    const user = userEvent.setup()

    render(
      <SuggestionCard
        suggestion={baseSuggestion}
        onAccept={onAccept}
        onDismiss={onDismiss}
        compact
      />
    )

    // Compact mode uses "Accept" instead of "Update exercise"
    await user.click(screen.getByText('Accept'))
    expect(onAccept).toHaveBeenCalledOnce()

    await user.click(screen.getByText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('hides accept button when suggestion has no action', () => {
    const noActionSuggestion: Suggestion = {
      ...baseSuggestion,
      action: undefined,
    }
    render(
      <SuggestionCard suggestion={noActionSuggestion} onAccept={vi.fn()} />
    )
    expect(screen.queryByText('Update exercise')).not.toBeInTheDocument()
  })

  it('renders compact variant', () => {
    render(<SuggestionCard suggestion={baseSuggestion} compact />)
    // Compact uses smaller text class
    const message = screen.getByText('Ready to try 100 BPM?')
    expect(message.className).toContain('text-sm')
  })

  it('uses correct style for each suggestion type', () => {
    const revisitSuggestion: Suggestion = {
      ...baseSuggestion,
      type: 'revisit',
    }
    const { container } = render(<SuggestionCard suggestion={revisitSuggestion} />)
    // revisit type uses purple styling
    const card = container.firstElementChild!
    expect(card.className).toContain('bg-purple-50')
    expect(card.className).toContain('border-purple-200')
  })
})
