import type { DatabaseSync } from 'node:sqlite'
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { AppError, type IpcError } from '@shared/errors'
import type { ChannelHandlers, Contract } from '@shared/ipc/contract'
import { IPC_ERROR_KEY, isIpcErrorEnvelope, type IpcErrorEnvelope } from '@shared/ipc/envelope'
import { logAppError } from '../logging/logger'
import type { DataPaths } from '../filesystem/dataDirectory'

/** What every handler receives besides its validated payload. */
export interface HandlerContext {
  /** Throws `AppError` (`MIGRATION_FAILED` / `IO`) when the database is unavailable. */
  readonly db: DatabaseSync
  readonly window: BrowserWindow | null
  readonly paths: DataPaths
  /** Set when the database could not be opened or migrated at startup (or the last retry). */
  readonly dbError?: IpcError
  /** Re-attempts opening + migrating the database; afterwards `db`/`dbError` reflect the outcome. */
  reopenDatabase(): void
  now(): string
}

export type Handlers = ChannelHandlers<HandlerContext>

/** The error envelope is defined once in `src/shared/ipc/envelope.ts` and shared with the preload. */
export { IPC_ERROR_KEY, isIpcErrorEnvelope, type IpcErrorEnvelope }

export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown>
  ): void
}

export interface RegistryOptions {
  ipc?: IpcMainLike
  /** Defaults to "top frame of a BrowserWindow this process owns". */
  isTrustedSender?: (event: IpcMainInvokeEvent) => boolean
}

const defaultIsTrustedSender = (event: IpcMainInvokeEvent): boolean => {
  const frame = event.senderFrame
  if (!frame || frame.parent !== null) return false
  const window = BrowserWindow.fromWebContents(event.sender)
  return window !== null && !window.isDestroyed()
}

type AnyHandler = (request: unknown, ctx: HandlerContext) => unknown

/**
 * Registers one `ipcMain.handle` per contract channel: validates the payload with the channel's
 * Zod schema, checks the sender, runs the handler, and converts any thrown value into an
 * `IpcErrorEnvelope`. The preload turns the envelope back into a rejected promise.
 */
export const registerHandlers = (
  contract: Contract,
  handlers: Handlers,
  ctxFactory: () => HandlerContext,
  options: RegistryOptions = {}
): void => {
  const ipc: IpcMainLike = options.ipc ?? ipcMain
  const isTrusted = options.isTrustedSender ?? defaultIsTrustedSender
  const table = handlers as unknown as Record<string, AnyHandler>

  for (const definition of Object.values(contract)) {
    const handler = table[definition.name]
    if (typeof handler !== 'function') {
      throw new AppError('INTERNAL', `No IPC handler registered for "${definition.name}"`, {
        channel: definition.name
      })
    }
    ipc.handle(definition.name, async (event, payload) => {
      try {
        if (!isTrusted(event)) {
          throw new AppError('PERMISSION', 'IPC call from an untrusted sender was rejected', {
            channel: definition.name
          })
        }
        const parsed = definition.request.safeParse(payload)
        if (!parsed.success) {
          throw new AppError('VALIDATION', `Invalid request for ${definition.name}`, {
            channel: definition.name,
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
              code: issue.code
            }))
          })
        }
        return await handler(parsed.data, ctxFactory())
      } catch (error) {
        const envelope: IpcErrorEnvelope = {
          [IPC_ERROR_KEY]: logAppError(`ipc ${definition.name}`, error)
        }
        return envelope
      }
    })
  }
}
