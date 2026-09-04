import { emptyRequestSchema, idRequestSchema, patchRequest } from '../../schemas/common'
import { createMilestoneInputSchema, updateMilestoneInputSchema } from '../../schemas/milestone'
import type { OkResponse } from '../../types/common'
import type { Milestone } from '../../types/milestone'
import { defineChannel } from '../defineChannel'

const updateRequestSchema = patchRequest(updateMilestoneInputSchema)

export const milestoneChannels = {
  'milestones:list': defineChannel<typeof emptyRequestSchema, Milestone[]>(
    'milestones:list',
    emptyRequestSchema
  ),
  'milestones:get': defineChannel<typeof idRequestSchema, Milestone>(
    'milestones:get',
    idRequestSchema
  ),
  'milestones:create': defineChannel<typeof createMilestoneInputSchema, Milestone>(
    'milestones:create',
    createMilestoneInputSchema
  ),
  'milestones:update': defineChannel<typeof updateRequestSchema, Milestone>(
    'milestones:update',
    updateRequestSchema
  ),
  'milestones:delete': defineChannel<typeof idRequestSchema, OkResponse>(
    'milestones:delete',
    idRequestSchema
  )
}
