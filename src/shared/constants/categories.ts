import { CALENDAR_EVENT_CATEGORIES, type CalendarEventCategory } from '../types/calendar'
import { MILESTONE_CATEGORIES, type MilestoneCategory } from '../types/milestone'
import {
  PERSONAL_DEADLINE_CATEGORIES,
  type PersonalDeadlineCategory
} from '../types/personalDeadline'

export type CategoryId = CalendarEventCategory | PersonalDeadlineCategory | MilestoneCategory

export interface CategoryDefinition {
  id: CategoryId
  label: string
  /** Tailwind theme color token defined in `globals.css`, consumed as `bg-<token>` / `text-<token>`. */
  colorToken: string
  /** lucide-react component name. */
  icon: string
}

const define = (id: CategoryId, label: string, icon: string): CategoryDefinition => ({
  id,
  label,
  colorToken: `category-${id.replace('_', '-')}`,
  icon
})

/** Single palette shared by calendar events, personal deadlines and milestones (ids overlap on purpose). */
export const CATEGORIES: Readonly<Record<CategoryId, CategoryDefinition>> = {
  course: define('course', 'Course', 'GraduationCap'),
  coursework: define('coursework', 'Coursework', 'NotebookPen'),
  research: define('research', 'Research', 'FlaskConical'),
  meeting: define('meeting', 'Meeting', 'Users'),
  deadline: define('deadline', 'Deadline', 'AlarmClock'),
  work: define('work', 'Work', 'Briefcase'),
  health: define('health', 'Health', 'HeartPulse'),
  personal: define('personal', 'Personal', 'User'),
  rest: define('rest', 'Rest', 'Coffee'),
  paper: define('paper', 'Paper', 'FileText'),
  publication: define('publication', 'Publication', 'BookMarked'),
  scholarship: define('scholarship', 'Scholarship', 'Award'),
  internship: define('internship', 'Internship', 'Building2'),
  academic: define('academic', 'Academic', 'BookOpen'),
  administrative: define('administrative', 'Administrative', 'ClipboardList'),
  phd_progress: define('phd_progress', 'PhD progress', 'Milestone'),
  career: define('career', 'Career', 'Rocket'),
  other: define('other', 'Other', 'Tag')
}

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[]

export const getCategory = (id: CategoryId): CategoryDefinition => CATEGORIES[id]

export const CALENDAR_CATEGORY_OPTIONS: readonly CategoryDefinition[] =
  CALENDAR_EVENT_CATEGORIES.map(getCategory)
export const PERSONAL_DEADLINE_CATEGORY_OPTIONS: readonly CategoryDefinition[] =
  PERSONAL_DEADLINE_CATEGORIES.map(getCategory)
export const MILESTONE_CATEGORY_OPTIONS: readonly CategoryDefinition[] =
  MILESTONE_CATEGORIES.map(getCategory)
