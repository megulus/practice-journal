import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, userEvent } from '@/test/utils'
import { Dialog, Sheet } from './Dialog'

describe('Dialog', () => {
  it('renders children in a labelled modal dialog', () => {
    render(
      <Dialog onClose={() => {}} aria-label="Demo dialog">
        <button>Inside</button>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Demo dialog')
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })

  it('moves initial focus to the first focusable element', () => {
    render(
      <Dialog onClose={() => {}} aria-label="d">
        <button>First</button>
        <button>Second</button>
      </Dialog>,
    )
    expect(screen.getByText('First')).toHaveFocus()
  })

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Dialog onClose={onClose} aria-label="d">
        <button>X</button>
      </Dialog>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('dismisses on backdrop click but not on panel click', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Dialog onClose={onClose} aria-label="d">
        <button>X</button>
      </Dialog>,
    )
    await user.click(screen.getByText('X'))
    expect(onClose).not.toHaveBeenCalled()

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('traps Tab focus within the dialog', async () => {
    const user = userEvent.setup()
    render(
      <Dialog onClose={() => {}} aria-label="d">
        <button>First</button>
        <button>Second</button>
      </Dialog>,
    )
    const first = screen.getByText('First')
    const second = screen.getByText('Second')

    expect(first).toHaveFocus()
    await user.tab()
    expect(second).toHaveFocus()
    await user.tab() // wraps forward to first
    expect(first).toHaveFocus()
    await user.tab({ shift: true }) // wraps backward to last
    expect(second).toHaveFocus()
  })

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = render(
      <Dialog onClose={() => {}} aria-label="d">
        <button>X</button>
      </Dialog>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('restores focus to the trigger on close', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Trigger</button>
          {open && (
            <Dialog onClose={() => setOpen(false)} aria-label="d">
              <button>Inside</button>
            </Dialog>
          )}
        </>
      )
    }
    render(<Harness />)
    const trigger = screen.getByText('Trigger')

    await user.click(trigger)
    expect(screen.getByText('Inside')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })
})

describe('Sheet', () => {
  it('renders a bottom-anchored dialog', () => {
    render(
      <Sheet onClose={() => {}} aria-label="Demo sheet">
        <button>Inside</button>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Demo sheet')
    // Bottom placement anchors the panel to the end of the cross axis.
    expect(dialog.parentElement).toHaveClass('items-end')
  })
})
