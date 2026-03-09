import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import ExerciseRow from './ExerciseRow'

describe('ExerciseRow', () => {
  it('renders exercise text', () => {
    render(<ExerciseRow exerciseId={1} text="G Major Scale" onUpdate={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('G Major Scale')).toBeInTheDocument()
  })

  it('enters edit mode on click', async () => {
    const user = userEvent.setup()
    render(<ExerciseRow exerciseId={1} text="G Major Scale" onUpdate={() => {}} onDelete={() => {}} />)

    await user.click(screen.getByText('G Major Scale'))
    expect(screen.getByRole('textbox')).toHaveValue('G Major Scale')
  })

  it('calls onUpdate with new text on Enter', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()

    render(<ExerciseRow exerciseId={42} text="Old text" onUpdate={onUpdate} onDelete={() => {}} />)
    await user.click(screen.getByText('Old text'))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'New text{Enter}')

    expect(onUpdate).toHaveBeenCalledWith(42, 'New text')
  })

  it('cancels edit on Escape', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()

    render(<ExerciseRow exerciseId={1} text="Original" onUpdate={onUpdate} onDelete={() => {}} />)
    await user.click(screen.getByText('Original'))
    await user.type(screen.getByRole('textbox'), ' changed{Escape}')

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('Original')).toBeInTheDocument()
  })

  it('calls onDelete with exercise id', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()

    render(<ExerciseRow exerciseId={42} text="To delete" onUpdate={() => {}} onDelete={onDelete} />)
    await user.click(screen.getByTitle('Delete exercise'))

    expect(onDelete).toHaveBeenCalledWith(42)
  })

  it('does not call onUpdate when text is unchanged', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()

    render(<ExerciseRow exerciseId={1} text="Same" onUpdate={onUpdate} onDelete={() => {}} />)
    await user.click(screen.getByText('Same'))
    await user.keyboard('{Enter}')

    expect(onUpdate).not.toHaveBeenCalled()
  })
})
