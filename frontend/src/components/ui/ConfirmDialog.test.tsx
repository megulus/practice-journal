import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    title: 'Delete “Scales”?',
    message: 'This deletes the block “Scales”. This can’t be undone.',
    confirmLabel: 'Delete',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title, message, and both buttons', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Delete “Scales”?')).toBeInTheDocument()
    expect(
      screen.getByText('This deletes the block “Scales”. This can’t be undone.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('names the dialog by its title and describes it by its message', () => {
    render(<ConfirmDialog {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Delete “Scales”?')
    expect(dialog).toHaveAccessibleDescription(
      'This deletes the block “Scales”. This can’t be undone.',
    )
  })

  it('calls onConfirm — and only onConfirm — when the destructive button is clicked', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(defaultProps.onConfirm).toHaveBeenCalledOnce()
    expect(defaultProps.onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel — and never onConfirm — when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
    expect(defaultProps.onConfirm).not.toHaveBeenCalled()
  })

  it('cancels on Escape rather than confirming', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} />)

    await user.keyboard('{Escape}')
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
    expect(defaultProps.onConfirm).not.toHaveBeenCalled()
  })

  it('cancels on a backdrop click rather than confirming', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} />)

    // The backdrop is the flex container the panel sits inside.
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement
    await user.click(backdrop)
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
    expect(defaultProps.onConfirm).not.toHaveBeenCalled()
  })

  it('opens with focus on Cancel, so a stray Enter is the safe path', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('confirming takes intent — Enter on the opened dialog cancels', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} />)

    await user.keyboard('{Enter}')
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
    expect(defaultProps.onConfirm).not.toHaveBeenCalled()
  })

  it('restores focus to the trigger after the dialog closes', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Delete block</button>
          {open && (
            <ConfirmDialog
              {...defaultProps}
              onCancel={() => setOpen(false)}
              onConfirm={() => setOpen(false)}
            />
          )}
        </>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Delete block' })
    await user.click(trigger)

    await screen.findByRole('dialog')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(trigger).toHaveFocus()
  })

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button>Outside</button>
        <ConfirmDialog {...defaultProps} />
      </>,
    )

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Delete' })

    expect(cancel).toHaveFocus()
    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
  })

  it('uses the danger variant by default and the primary one when told to', () => {
    const { unmount } = render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      'bg-danger-text',
    )
    unmount()

    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Archive"
        confirmVariant="default"
      />,
    )
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveClass(
      'bg-primary',
    )
  })

  it('accepts a custom cancel label', () => {
    render(<ConfirmDialog {...defaultProps} cancelLabel="Keep going" />)
    expect(
      screen.getByRole('button', { name: 'Keep going' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('renders a ReactNode message', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        message={<p data-testid="custom-msg">Custom content</p>}
      />,
    )
    expect(screen.getByTestId('custom-msg')).toBeInTheDocument()
  })

  // Guards against the hardcoded `id="confirm-dialog-title"` this component
  // used to carry: as a shared primitive it can't assume it's the only one on
  // the page, or a second instance would silently steal the first's label.
  it('gives each instance its own label/description ids', () => {
    render(
      <>
        <ConfirmDialog {...defaultProps} />
        <ConfirmDialog {...defaultProps} title="Delete “Arpeggios”?" />
      </>,
    )

    const labels = screen
      .getAllByRole('dialog')
      .map((d) => d.getAttribute('aria-labelledby'))

    expect(labels).toHaveLength(2)
    expect(labels[0]).toBeTruthy()
    expect(labels[1]).not.toBe(labels[0])
  })
})
