import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import EditableText from './EditableText'

describe('EditableText', () => {
  it('renders value as text', () => {
    render(<EditableText value="My Template" onSave={() => {}} />)
    expect(screen.getByText('My Template')).toBeInTheDocument()
  })

  it('enters edit mode on click', async () => {
    const user = userEvent.setup()
    render(<EditableText value="My Template" onSave={() => {}} />)

    await user.click(screen.getByText('My Template'))
    expect(screen.getByRole('textbox')).toHaveValue('My Template')
  })

  it('saves on Enter', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(<EditableText value="Old Name" onSave={onSave} />)
    await user.click(screen.getByText('Old Name'))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'New Name{Enter}')

    expect(onSave).toHaveBeenCalledWith('New Name')
  })

  it('saves on blur', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(<EditableText value="Old Name" onSave={onSave} />)
    await user.click(screen.getByText('Old Name'))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'New Name')
    await user.tab() // blur

    expect(onSave).toHaveBeenCalledWith('New Name')
  })

  it('cancels on Escape without saving', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(<EditableText value="Original" onSave={onSave} />)
    await user.click(screen.getByText('Original'))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Changed{Escape}')

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Original')).toBeInTheDocument()
  })

  it('does not save if text is unchanged', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(<EditableText value="Same" onSave={onSave} />)
    await user.click(screen.getByText('Same'))
    await user.keyboard('{Enter}')

    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not save empty text', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(<EditableText value="Has Value" onSave={onSave} />)
    await user.click(screen.getByText('Has Value'))
    await user.clear(screen.getByRole('textbox'))
    await user.keyboard('{Enter}')

    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows placeholder when value is empty', () => {
    render(<EditableText value="" onSave={() => {}} placeholder="Click to edit" />)
    expect(screen.getByText('Click to edit')).toBeInTheDocument()
  })
})
