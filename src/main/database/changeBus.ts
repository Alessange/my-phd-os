import { EventEmitter } from 'node:events'
import type { EntityName } from '@shared/ipc/events'

export type ChangeListener = (payload: { entities: EntityName[] }) => void

const DEBOUNCE_MS = 30

/**
 * Collects entity names touched by repository mutations and, after a short debounce, notifies
 * subscribers once with the deduplicated list. `src/main/index.ts` subscribes the broadcaster that
 * sends `data:changed` to every BrowserWindow; tests subscribe directly.
 */
class ChangeBus {
  private readonly emitter = new EventEmitter()
  private pending = new Set<EntityName>()
  private timer: ReturnType<typeof setTimeout> | null = null

  emit(...entities: EntityName[]): void {
    for (const entity of entities) this.pending.add(entity)
    if (this.timer) return
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS)
  }

  /** Delivers pending changes immediately (used on shutdown and in tests). */
  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.pending.size === 0) return
    const entities = [...this.pending]
    this.pending = new Set()
    this.emitter.emit('change', { entities })
  }

  subscribe(listener: ChangeListener): () => void {
    this.emitter.on('change', listener)
    return () => this.emitter.off('change', listener)
  }

  get pendingEntities(): EntityName[] {
    return [...this.pending]
  }
}

export const changeBus = new ChangeBus()
