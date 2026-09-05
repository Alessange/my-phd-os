import { QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ThemeProvider } from '@renderer/app/layout/ThemeProvider'
import { queryClient } from '@renderer/app/queryClient'
import { TooltipProvider } from '@renderer/components/ui/tooltip'

/**
 * Test render with the app's real QueryClient (cleared first so tests never share cache),
 * ThemeProvider and TooltipProvider. Import only from `*.test.tsx` files.
 */
export const renderWithProviders = (ui: ReactElement): RenderResult => {
  queryClient.clear()
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    )
  })
}
