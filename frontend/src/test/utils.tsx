import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'

/**
 * Custom render function that wraps components with any providers needed.
 * Currently a pass-through since Clerk is globally mocked in setup.ts,
 * but this is the place to add providers as needed.
 */
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { ...options })
}

export { customRender as render }
export { screen, within, waitFor } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
