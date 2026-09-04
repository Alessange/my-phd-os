import type { z } from 'zod'
import { appChannels } from './channels/app'
import { calendarChannels } from './channels/calendar'
import { conferenceChannels } from './channels/conferences'
import { dataChannels } from './channels/data'
import { habitChannels } from './channels/habits'
import { milestoneChannels } from './channels/milestones'
import { personalDeadlineChannels } from './channels/personalDeadlines'
import { settingsChannels } from './channels/settings'
import type { Contract } from './defineChannel'
import type { EventName, EventPayload } from './events'

export { defineChannel, type ChannelDefinition, type Contract } from './defineChannel'

export const channels = {
  ...appChannels,
  ...settingsChannels,
  ...calendarChannels,
  ...personalDeadlineChannels,
  ...conferenceChannels,
  ...milestoneChannels,
  ...habitChannels,
  ...dataChannels
} satisfies Contract

export type Channels = typeof channels
export type ChannelName = keyof Channels

/** Validated request payload as seen by a handler. */
export type RequestOf<N extends ChannelName> = z.output<Channels[N]['request']>
/** Request payload as written by the renderer (before defaults are applied). */
export type RequestInputOf<N extends ChannelName> = z.input<Channels[N]['request']>
export type ResponseOf<N extends ChannelName> = Channels[N]['_res']

export const channelNames = Object.keys(channels) as ChannelName[]

export const isChannelName = (value: unknown): value is ChannelName =>
  typeof value === 'string' && Object.hasOwn(channels, value)

/** Handler map the main-process registry must implement in full (TS enforces completeness). */
export type ChannelHandlers<Ctx> = {
  [N in ChannelName]: (request: RequestOf<N>, ctx: Ctx) => Promise<ResponseOf<N>> | ResponseOf<N>
}

/** Payload argument tuple: optional for channels whose request schema accepts `undefined`. */
export type InvokeArgs<N extends ChannelName> =
  undefined extends RequestInputOf<N> ? [payload?: RequestInputOf<N>] : [payload: RequestInputOf<N>]

/** The one object the preload exposes as `window.api`. */
export interface WindowApi {
  invoke<N extends ChannelName>(channel: N, ...args: InvokeArgs<N>): Promise<ResponseOf<N>>
  /** Subscribes to a push event; returns an unsubscribe function. */
  on<E extends EventName>(event: E, listener: (payload: EventPayload<E>) => void): () => void
  off<E extends EventName>(event: E, listener: (payload: EventPayload<E>) => void): void
}
