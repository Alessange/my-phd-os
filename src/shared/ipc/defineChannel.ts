import type { z } from 'zod'

export interface ChannelDefinition<Req extends z.ZodType = z.ZodType, Res = unknown> {
  readonly name: string
  readonly request: Req
  /** Phantom response type; never holds a value. */
  readonly _res: Res
}

/** Pairs a channel name with its Zod request schema and a phantom response type. */
export const defineChannel = <Req extends z.ZodType, Res>(
  name: string,
  request: Req
): ChannelDefinition<Req, Res> => ({
  name,
  request,
  _res: undefined as unknown as Res
})

export type Contract = Record<string, ChannelDefinition>
