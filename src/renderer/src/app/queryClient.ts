import { QueryClient } from '@tanstack/react-query'

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: 0
      }
    }
  })

/** The application-wide client; non-hook code (commands, event handlers) may use it directly. */
export const queryClient = createQueryClient()
