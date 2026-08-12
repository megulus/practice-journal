import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor, within } from '@/test/utils'
import { SessionHistoryCard } from './SessionHistoryCard'
import type {
  BlockLog,
  HistoryItem,
  PracticeLog,
  SectionLog,
} from '@/lib/types'

const { mockGetHistoryDetail, mockApi } = vi.hoisted(() => {
  const mockGetHistoryDetail = vi.fn()
  return { mockGetHistoryDetail, mockApi: { getHistoryDetail: mockGetHistoryDetail } }
})

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

function makeItem(o: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 42,
    practice_date: '2026-07-21',
    instrument_name: 'Violin',
    session_name: 'Technique focus',
    template_name: 'Learn the Bruch concerto',
    rotation_label: 'session 2 of 7',
    total_duration_minutes: 22,
    exercise_count: 4,
    is_freeform: false,
    ...o,
  }
}

let nextBlockId = 1
function makeBlock(o: Partial<BlockLog> = {}): BlockLog {
  return {
    id: nextBlockId++,
    block_id: null,
    spot_id: null,
    block_name: 'Open string warm-up',
    rating: 1,
    notes: null,
    completed: true,
    display_order: 0,
    tempo_bpm: null,
    last_tempo_bpm: null,
    piece_name: null,
    ...o,
  }
}

function makeSection(blocks: BlockLog[], o: Partial<SectionLog> = {}): SectionLog {
  return {
    id: 1,
    section_id: 1,
    section_type: 'warmup',
    section_name: 'Warm-up',
    planned_duration_minutes: 5,
    actual_duration_minutes: 5,
    display_order: 0,
    completed: true,
    skipped: false,
    block_logs: blocks,
    ...o,
  }
}

function makeLog(
  sections: SectionLog[],
  o: Partial<PracticeLog> = {},
): PracticeLog {
  return {
    id: 42,
    user_id: 1,
    instrument_id: 1,
    template_id: 1,
    template_session_id: 1,
    status: 'completed',
    practice_date: '2026-07-21',
    total_duration_minutes: 22,
    notes: null,
    reflection_prompt: null,
    reflection_response: null,
    created_at: '2026-07-21T10:00:00',
    instrument_name: 'Violin',
    template_name: 'Learn the Bruch concerto',
    session_name: 'Technique focus',
    section_logs: sections,
    ...o,
  }
}

describe('SessionHistoryCard', () => {
  beforeEach(() => {
    nextBlockId = 1
    mockGetHistoryDetail.mockReset()
  })

  it('renders the collapsed row without fetching the detail', () => {
    render(<SessionHistoryCard item={makeItem()} />)

    expect(screen.getByText('Technique focus')).toBeInTheDocument()
    expect(
      screen.getByText('Learn the Bruch concerto · session 2 of 7'),
    ).toBeInTheDocument()
    expect(screen.getByText('22 min')).toBeInTheDocument()
    expect(screen.getByText('4 exercises')).toBeInTheDocument()
    expect(screen.getByText('expand')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    expect(mockGetHistoryDetail).not.toHaveBeenCalled()
  })

  it('shows the practice date on every row', () => {
    render(<SessionHistoryCard item={makeItem({ practice_date: '2026-03-21' })} />)
    // Weekday + month/day, per the History design.
    expect(screen.getByText(/Mar 21/)).toBeInTheDocument()
  })

  it('singularizes a one-exercise session', () => {
    render(<SessionHistoryCard item={makeItem({ exercise_count: 1 })} />)
    expect(screen.getByText('1 exercise')).toBeInTheDocument()
  })

  it('expands to the exercise list with rating labels, then collapses again', async () => {
    const user = userEvent.setup()
    mockGetHistoryDetail.mockResolvedValue(
      makeLog([
        makeSection([
          makeBlock({ block_name: 'Open string warm-up', rating: 1 }),
          makeBlock({ block_name: 'G major scale', rating: 0 }),
          makeBlock({ block_name: 'mm. 17–32, slow tempo', rating: -1 }),
          makeBlock({ block_name: 'Cool-down stretches', completed: false, rating: null }),
        ]),
      ]),
    )
    render(<SessionHistoryCard item={makeItem()} />)

    await user.click(screen.getByRole('button', { name: /Technique focus/ }))

    expect(await screen.findByText('Open string warm-up')).toBeInTheDocument()
    expect(screen.getByText('Step forward')).toBeInTheDocument()
    expect(screen.getByText('Steady')).toBeInTheDocument()
    expect(screen.getByText('Step back')).toBeInTheDocument()
    expect(screen.getByText('Skipped')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Technique focus/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('collapse')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Technique focus/ }))
    await waitFor(() =>
      expect(screen.queryByText('Open string warm-up')).not.toBeInTheDocument(),
    )
    // Re-expanding reuses the already-fetched detail.
    await user.click(screen.getByRole('button', { name: /Technique focus/ }))
    expect(await screen.findByText('Open string warm-up')).toBeInTheDocument()
    expect(mockGetHistoryDetail).toHaveBeenCalledTimes(1)
  })

  it('shows exercise notes, session notes and the reflection response', async () => {
    const user = userEvent.setup()
    mockGetHistoryDetail.mockResolvedValue(
      makeLog(
        [
          makeSection([
            makeBlock({
              block_name: 'G major scale',
              notes: 'Intonation still shaky up top.',
            }),
          ]),
        ],
        {
          notes: 'Short session, tired.',
          reflection_prompt: 'What clicked today?',
          reflection_response: 'Slower is faster.',
        },
      ),
    )
    render(<SessionHistoryCard item={makeItem()} />)
    await user.click(screen.getByRole('button', { name: /Technique focus/ }))

    expect(
      await screen.findByText('Intonation still shaky up top.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Session notes')).toBeInTheDocument()
    expect(screen.getByText('Short session, tired.')).toBeInTheDocument()
    expect(screen.getByText('What clicked today?')).toBeInTheDocument()
    expect(screen.getByText('Slower is faster.')).toBeInTheDocument()
  })

  it('nests repertoire spots under their piece', async () => {
    const user = userEvent.setup()
    mockGetHistoryDetail.mockResolvedValue(
      makeLog([
        makeSection([
          makeBlock({
            block_id: 7,
            spot_id: 1,
            block_name: 'Bruch concerto — mm. 1–16',
            rating: 1,
          }),
          makeBlock({
            block_id: 7,
            spot_id: 2,
            block_name: 'Bruch concerto — mm. 17–32',
            rating: -1,
          }),
        ]),
      ]),
    )
    render(<SessionHistoryCard item={makeItem()} />)
    await user.click(screen.getByRole('button', { name: /Technique focus/ }))

    expect(await screen.findByText('Bruch concerto')).toBeInTheDocument()
    // Spot rows drop the redundant piece prefix.
    const detail = screen.getByTestId('session-detail-42')
    expect(within(detail).getByText('mm. 1–16')).toBeInTheDocument()
    expect(within(detail).getByText('mm. 17–32')).toBeInTheDocument()
    expect(
      within(detail).queryByText('Bruch concerto — mm. 1–16'),
    ).not.toBeInTheDocument()
  })

  it('renders a piece title containing " — " in full (#274)', async () => {
    const user = userEvent.setup()
    mockGetHistoryDetail.mockResolvedValue(
      makeLog([
        makeSection([
          makeBlock({
            block_id: 7,
            spot_id: 1,
            block_name: 'Sonata — No. 2 — mm. 1–8',
            piece_name: 'Sonata — No. 2',
            rating: 1,
          }),
        ]),
      ]),
    )
    render(<SessionHistoryCard item={makeItem()} />)
    await user.click(screen.getByRole('button', { name: /Technique focus/ }))

    const detail = await screen.findByTestId('session-detail-42')
    expect(within(detail).getByText('Sonata — No. 2')).toBeInTheDocument()
    // …and the spot row still drops the (full) piece prefix.
    expect(within(detail).getByText('mm. 1–8')).toBeInTheDocument()
  })

  it('leaves a spot name intact when it lacks the piece prefix', async () => {
    const user = userEvent.setup()
    mockGetHistoryDetail.mockResolvedValue(
      makeLog([
        makeSection([
          makeBlock({
            block_id: 7,
            spot_id: 1,
            // Renamed out of band, so it no longer carries "Piece — ".
            block_name: 'Bruch concerto — mm. 1–16',
            rating: 1,
          }),
          makeBlock({
            block_id: 7,
            spot_id: 2,
            block_name: 'Coda, from the top — slowly',
            rating: 0,
          }),
        ]),
      ]),
    )
    render(<SessionHistoryCard item={makeItem()} />)
    await user.click(screen.getByRole('button', { name: /Technique focus/ }))

    const detail = await screen.findByTestId('session-detail-42')
    // Prefixed name is stripped; unprefixed one is preserved whole rather
    // than being chopped at its own " — ".
    expect(within(detail).getByText('mm. 1–16')).toBeInTheDocument()
    expect(
      within(detail).getByText('Coda, from the top — slowly'),
    ).toBeInTheDocument()
    expect(within(detail).queryByText('slowly')).not.toBeInTheDocument()
  })

  it('pairs aria-expanded with the panel it controls', async () => {
    const user = userEvent.setup()
    mockGetHistoryDetail.mockResolvedValue(
      makeLog([makeSection([makeBlock()])]),
    )
    render(<SessionHistoryCard item={makeItem()} />)

    const toggle = screen.getByRole('button', { name: /Technique focus/ })
    // Collapsed: nothing to point at, so no dangling reference.
    expect(toggle).not.toHaveAttribute('aria-controls')

    await user.click(toggle)
    await screen.findByTestId('session-detail-42')
    expect(toggle).toHaveAttribute('aria-controls', 'session-detail-42')
    expect(document.getElementById('session-detail-42')).toBeInTheDocument()
  })

  it('reports a detail load failure inside the expanded row', async () => {
    const user = userEvent.setup()
    mockGetHistoryDetail.mockRejectedValue(new Error('nope'))
    render(<SessionHistoryCard item={makeItem()} />)

    await user.click(screen.getByRole('button', { name: /Technique focus/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('nope')
  })
})
