import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { onEvent } from '@renderer/lib/api'
import { ENTITY_INVALIDATION } from '@renderer/lib/queryKeys'

/** Mounted once in `App`: invalidates the affected query keys whenever main broadcasts `data:changed`. */
export const useDataChanged = (): void => {
  const client = useQueryClient()
  useEffect(
    () =>
      onEvent('data:changed', ({ entities }) => {
        const prefixes = new Set(entities.flatMap((entity) => ENTITY_INVALIDATION[entity] ?? []))
        prefixes.forEach((queryKey) => void client.invalidateQueries({ queryKey }))
      }),
    [client]
  )
}
