import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import CreateTemplateForm from './CreateTemplateForm'

describe('CreateTemplateForm', () => {
  const defaultProps = {
    onCreateTemplate: vi.fn().mockResolvedValue(42),
    onCreated: vi.fn(),
    onCancel: vi.fn(),
  }

  it('renders form fields', () => {
    render(<CreateTemplateForm {...defaultProps} />)
    expect(screen.getByPlaceholderText(/Weekly Practice Plan/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('3')).toBeInTheDocument() // default days count
    expect(screen.getByText('Create Template')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('submits form with entered values', async () => {
    const onCreateTemplate = vi.fn().mockResolvedValue(99)
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(
      <CreateTemplateForm
        onCreateTemplate={onCreateTemplate}
        onCreated={onCreated}
        onCancel={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText(/Weekly Practice Plan/), 'My Plan')
    await user.click(screen.getByText('Create Template'))

    await waitFor(() => {
      expect(onCreateTemplate).toHaveBeenCalledWith({
        name: 'My Plan',
        daysCount: 3,
        description: undefined,
      })
    })
    expect(onCreated).toHaveBeenCalledWith(99)
  })

  it('disables submit when name is empty', () => {
    render(<CreateTemplateForm {...defaultProps} />)
    expect(screen.getByText('Create Template')).toBeDisabled()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()

    render(<CreateTemplateForm {...defaultProps} onCancel={onCancel} />)
    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows error message on creation failure', async () => {
    const onCreateTemplate = vi.fn().mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()

    render(
      <CreateTemplateForm
        onCreateTemplate={onCreateTemplate}
        onCreated={() => {}}
        onCancel={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText(/Weekly Practice Plan/), 'Test')
    await user.click(screen.getByText('Create Template'))

    await waitFor(() => {
      expect(screen.getByText(/Failed to create template/)).toBeInTheDocument()
    })
  })

  it('shows "Creating..." while submitting', async () => {
    // Use a promise that doesn't resolve immediately
    let resolve: (v: number) => void
    const onCreateTemplate = vi.fn().mockImplementation(
      () => new Promise<number>((r) => { resolve = r })
    )
    const user = userEvent.setup()

    render(
      <CreateTemplateForm
        onCreateTemplate={onCreateTemplate}
        onCreated={() => {}}
        onCancel={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText(/Weekly Practice Plan/), 'Test')
    await user.click(screen.getByText('Create Template'))

    expect(screen.getByText('Creating...')).toBeInTheDocument()

    // Resolve to clean up
    resolve!(1)
  })
})
