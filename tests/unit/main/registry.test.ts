import type { IpcMainInvokeEvent } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, toIpcError } from '../../../src/shared/errors'
import { channels } from '../../../src/shared/ipc/contract'

const logAppError = vi.fn((_scope: string, error: unknown) => toIpcError(error))
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn(() => null) }
}))
vi.mock('../../../src/main/logging/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logAppError
}))

const { registerHandlers, isIpcErrorEnvelope, IPC_ERROR_KEY } =
  await import('../../../src/main/ipc/registry')
type Handlers = import('../../../src/main/ipc/registry').Handlers
type HandlerContext = import('../../../src/main/ipc/registry').HandlerContext

type Listener = (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown>

const fakeIpc = (): {
  handle: (name: string, listener: Listener) => void
  listeners: Map<string, Listener>
} => {
  const listeners = new Map<string, Listener>()
  return { listeners, handle: (name, listener) => listeners.set(name, listener) }
}

const fakeEvent = {} as IpcMainInvokeEvent
const ctx = { now: () => '2026-09-04T00:00:00.000Z' } as unknown as HandlerContext
const contract = {
  'milestones:get': channels['milestones:get'],
  'settings:get': channels['settings:get']
}
const noop = (): undefined => undefined

describe('registerHandlers', () => {
  beforeEach(() => logAppError.mockClear())

  it('returns a VALIDATION envelope with issues for a bad payload and never calls the handler', async () => {
    const ipc = fakeIpc()
    const handler = vi.fn()
    registerHandlers(
      contract,
      { 'milestones:get': handler, 'settings:get': noop } as unknown as Handlers,
      () => ctx,
      { ipc, isTrustedSender: () => true }
    )
    const result = await ipc.listeners.get('milestones:get')!(fakeEvent, { id: '' })
    expect(isIpcErrorEnvelope(result)).toBe(true)
    const error = (result as { [IPC_ERROR_KEY]: { code: string; details: { issues: unknown[] } } })[
      IPC_ERROR_KEY
    ]
    expect(error.code).toBe('VALIDATION')
    expect(error.details.issues.length).toBeGreaterThan(0)
    expect(handler).not.toHaveBeenCalled()
    expect(logAppError).toHaveBeenCalledTimes(1)
  })

  it('passes the parsed payload and context to the handler and returns its result', async () => {
    const ipc = fakeIpc()
    const handler = vi.fn((request: { id: string }, context: HandlerContext) => ({
      id: request.id,
      at: context.now()
    }))
    registerHandlers(
      contract,
      { 'milestones:get': handler, 'settings:get': noop } as unknown as Handlers,
      () => ctx,
      { ipc, isTrustedSender: () => true }
    )
    const result = await ipc.listeners.get('milestones:get')!(fakeEvent, { id: 'm1' })
    expect(result).toEqual({ id: 'm1', at: '2026-09-04T00:00:00.000Z' })
    expect(handler).toHaveBeenCalledWith({ id: 'm1' }, ctx)
  })

  it('accepts undefined for payload-less channels', async () => {
    const ipc = fakeIpc()
    registerHandlers(
      contract,
      { 'settings:get': () => ({ ok: true }), 'milestones:get': noop } as unknown as Handlers,
      () => ctx,
      { ipc, isTrustedSender: () => true }
    )
    expect(await ipc.listeners.get('settings:get')!(fakeEvent, undefined)).toEqual({ ok: true })
  })

  it('wraps thrown AppErrors and unknown errors', async () => {
    const ipc = fakeIpc()
    registerHandlers(
      contract,
      {
        'milestones:get': () => {
          throw new AppError('NOT_FOUND', 'Milestone not found', { id: 'x' })
        },
        'settings:get': () => {
          throw new TypeError('boom')
        }
      } as unknown as Handlers,
      () => ctx,
      { ipc, isTrustedSender: () => true }
    )
    expect(await ipc.listeners.get('milestones:get')!(fakeEvent, { id: 'x' })).toEqual({
      [IPC_ERROR_KEY]: { code: 'NOT_FOUND', message: 'Milestone not found', details: { id: 'x' } }
    })
    expect(await ipc.listeners.get('settings:get')!(fakeEvent, undefined)).toEqual({
      [IPC_ERROR_KEY]: { code: 'INTERNAL', message: 'boom' }
    })
  })

  it('rejects untrusted senders with PERMISSION', async () => {
    const ipc = fakeIpc()
    const handler = vi.fn()
    registerHandlers(
      contract,
      { 'milestones:get': handler, 'settings:get': noop } as unknown as Handlers,
      () => ctx,
      { ipc, isTrustedSender: () => false }
    )
    const result = await ipc.listeners.get('milestones:get')!(fakeEvent, { id: 'm1' })
    expect(result).toMatchObject({ [IPC_ERROR_KEY]: { code: 'PERMISSION' } })
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses to start when a contract channel has no handler', () => {
    expect(() =>
      registerHandlers(contract, {} as unknown as Handlers, () => ctx, { ipc: fakeIpc() })
    ).toThrowError(/No IPC handler registered/)
  })

  it('registers one handler per channel of the full contract', () => {
    const ipc = fakeIpc()
    const all = Object.fromEntries(
      Object.keys(channels).map((name) => [name, () => undefined])
    ) as unknown as Handlers
    registerHandlers(channels, all, () => ctx, { ipc })
    expect([...ipc.listeners.keys()].sort()).toEqual(Object.keys(channels).sort())
  })
})
