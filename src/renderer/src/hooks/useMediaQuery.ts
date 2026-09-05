import { useSyncExternalStore } from 'react'

const subscribe = (query: string) => (onChange: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => false
  )
