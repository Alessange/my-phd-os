import * as milestones from '../../database/repositories/milestones'
import type { Handlers } from '../registry'
import { OK } from './shared'

export const milestoneHandlers = {
  'milestones:list': (_request, ctx) => milestones.listMilestones(ctx.db),
  'milestones:get': ({ id }, ctx) => milestones.getMilestone(ctx.db, id),
  'milestones:create': (input, ctx) => milestones.createMilestone(ctx.db, input),
  'milestones:update': ({ id, patch }, ctx) => milestones.updateMilestone(ctx.db, id, patch),
  'milestones:delete': ({ id }, ctx) => {
    milestones.deleteMilestone(ctx.db, id)
    return OK
  }
} satisfies Partial<Handlers>
