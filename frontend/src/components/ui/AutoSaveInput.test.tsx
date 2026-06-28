import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { AutoSaveInput, AutoSaveTextarea } from './AutoSaveInput'
import { useAutoSaveField } from './useAutoSaveField'

describe('AutoSaveInput', () => {
  it('renders the initial value', () => {
    render(<AutoSaveInput value="hello" onCommit={vi.fn()} aria-label="f" />)
    expect(screen.getByLabelText('f')).toHaveValue('hello')
  })

  it('commits the trimmed value on blur when it changed', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<AutoSaveInput value="old" onCommit={onCommit} aria-label="f" />)
    const input = screen.getByLabelText('f')

    await user.clear(input)
    await user.type(input, '  new  ')
    await user.tab() // blur

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('new')
    expect(input).toHaveValue('new') // display normalized to the trimmed value
  })

  it('does not commit when the value is unchanged', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<AutoSaveInput value="same" onCommit={onCommit} aria-label="f" />)
    const input = screen.getByLabelText('f')

    await user.click(input)
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('rolls back to the original value when emptied (default)', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<AutoSaveInput value="keep" onCommit={onCommit} aria-label="f" />)
    const input = screen.getByLabelText('f')

    await user.clear(input)
    await user.tab()

    expect(onCommit).not.toHaveBeenCalled()
    expect(input).toHaveValue('keep')
  })

  it('commits an empty value when trim and rollback are disabled', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(
      <AutoSaveInput
        value="focus"
        onCommit={onCommit}
        trim={false}
        rollbackWhenEmpty={false}
        aria-label="f"
      />,
    )
    const input = screen.getByLabelText('f')

    await user.clear(input)
    await user.tab()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('')
  })

  it('re-syncs to a new value prop when not editing', () => {
    const { rerender } = render(
      <AutoSaveInput value="a" onCommit={vi.fn()} aria-label="f" />,
    )
    const input = screen.getByLabelText('f')
    expect(input).toHaveValue('a')

    rerender(<AutoSaveInput value="b" onCommit={vi.fn()} aria-label="f" />)
    expect(input).toHaveValue('b')
  })

  it('preserves the in-flight draft when the value prop changes mid-edit', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AutoSaveInput value="server" onCommit={vi.fn()} aria-label="f" />,
    )
    const input = screen.getByLabelText('f')

    await user.clear(input)
    await user.type(input, 'typing') // focused → editing

    // A background refresh arrives while the user is mid-edit.
    rerender(<AutoSaveInput value="updated" onCommit={vi.fn()} aria-label="f" />)

    expect(input).toHaveValue('typing') // draft preserved, not clobbered
  })
})

describe('AutoSaveTextarea', () => {
  it('commits the trimmed value on blur', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<AutoSaveTextarea value="" onCommit={onCommit} aria-label="note" />)
    const area = screen.getByLabelText('note')

    await user.type(area, ' a note ')
    await user.tab()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('a note')
  })
})

describe('useAutoSaveField (numeric)', () => {
  function NumberField({
    value,
    onCommit,
  }: {
    value: number
    onCommit: (n: number) => void
  }) {
    const field = useAutoSaveField<number>({
      value,
      onCommit,
      parse: (s) => Math.max(0, parseInt(s, 10) || 0),
      rollbackWhenEmpty: false,
    })
    return (
      <input
        type="number"
        aria-label="n"
        value={field.value}
        onChange={field.onChange}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
      />
    )
  }

  it('parses, clamps, and normalizes the display on blur', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<NumberField value={30} onCommit={onCommit} />)
    const input = screen.getByLabelText('n')

    await user.clear(input)
    await user.type(input, '07')
    await user.tab()

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(7)
    expect(input).toHaveValue(7) // "07" normalized to "7"
  })

  it('commits 0 when emptied (no rollback)', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<NumberField value={5} onCommit={onCommit} />)
    const input = screen.getByLabelText('n')

    await user.clear(input)
    await user.tab()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(0)
  })
})
