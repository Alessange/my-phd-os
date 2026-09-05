import { Plus, Timer, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { getCategory } from '@shared/constants/categories'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { DEADLINE_STATUS_DEFINITIONS, PRIORITY_DEFINITIONS } from '@shared/constants/statuses'
import {
  DEADLINE_SCOPE_LABELS,
  DEADLINE_SCOPES,
  DEADLINE_SORT_LABELS,
  DEADLINE_SORTS,
  DEFAULT_DEADLINE_FILTERS,
  collectTags,
  describeDeadlines,
  filterDeadlines,
  sortDeadlines,
  type DeadlineFilters,
  type DeadlineScope,
  type DeadlineSort
} from '@shared/personal-deadlines/views'
import {
  PERSONAL_DEADLINE_CATEGORIES,
  type DeadlineStatus,
  type PersonalDeadline,
  type PersonalDeadlineCategory,
  type Priority
} from '@shared/types/personalDeadline'
import type { PersonalDeadlinesView } from '@shared/types/settings'
import { useCommandListener } from '@renderer/app/commandBus'
import { useNavigation } from '@renderer/app/navigation'
import { DEADLINES_QUICK_CREATE } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { Button } from '@renderer/components/ui/button'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useNow } from '@renderer/hooks/useNow'
import { useSettings } from '@renderer/hooks/useSettings'
import { usePersonalDeadlines } from '../api'
import { PersonalDeadlineCard } from './PersonalDeadlineCard'
import { PersonalDeadlineDetails } from './PersonalDeadlineDetails'
import { PersonalDeadlineForm } from './PersonalDeadlineForm'
import { PersonalDeadlineList } from './PersonalDeadlineList'
import { PersonalDeadlineTimeline } from './PersonalDeadlineTimeline'

const ALL = 'all'
const NO_DEADLINES: PersonalDeadline[] = []

const VIEW_OPTIONS: readonly { value: PersonalDeadlinesView; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'list', label: 'List' },
  { value: 'timeline', label: 'Timeline' }
]
const SCOPE_OPTIONS: readonly { value: DeadlineScope; label: string }[] = DEADLINE_SCOPES.map(
  (scope) => ({ value: scope, label: DEADLINE_SCOPE_LABELS[scope] })
)

/**
 * Personal Deadlines tab (spec §13.3): cards / list / timeline views (persisted in
 * `ui.personalDeadlinesView`), scope and attribute filters, six sort orders, the details drawer
 * and the editor. Quick-create arrives over the command bus from the Deadlines page; deep links
 * are `{ tab: 'personal', id }` (open details) and `{ tab: 'personal', create }` (open the editor).
 */
export function PersonalDeadlinesTab(): React.JSX.Element {
  const { ui, updateUi } = useSettings()
  const nowIso = useNow({ precision: 'minute' })
  const params = useNavigation((state) => state.params)
  const navigate = useNavigation((state) => state.navigate)
  const query = usePersonalDeadlines({ includeCompleted: true })
  const deadlines = query.data ?? NO_DEADLINES

  const [filters, setFilters] = useState<DeadlineFilters>(DEFAULT_DEADLINE_FILTERS)
  const [sort, setSort] = useState<DeadlineSort>('nearest')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalDeadline | undefined>()
  const [detailsId, setDetailsId] = useState<string | undefined>()

  const openCreate = useCallback(() => {
    setEditing(undefined)
    setFormOpen(true)
  }, [])
  useCommandListener(DEADLINES_QUICK_CREATE.personal, openCreate)

  // Deep links, derived during render (see SettingsPage); each tracks the param's current value.
  const [lastCreate, setLastCreate] = useState<string | undefined>()
  if (params.create !== lastCreate) {
    setLastCreate(params.create)
    if (params.create !== undefined) {
      setEditing(undefined)
      setFormOpen(true)
    }
  }
  const [lastId, setLastId] = useState<string | undefined>()
  if (params.id !== lastId) {
    const exists = params.id !== undefined && deadlines.some((d) => d.id === params.id)
    // An unknown id is ignored; one that arrives before the list has loaded is retried next render.
    if (params.id === undefined || exists) {
      setLastId(params.id)
      if (exists) setDetailsId(params.id)
    }
  }
  const clearDeepLink = (): void => {
    if (params.create !== undefined || params.id !== undefined)
      navigate('deadlines', { tab: 'personal' })
  }

  const described = useMemo(() => describeDeadlines(deadlines, nowIso), [deadlines, nowIso])
  const visible = useMemo(
    () => sortDeadlines(filterDeadlines(described, filters), sort),
    [described, filters, sort]
  )
  const tags = useMemo(() => collectTags(deadlines), [deadlines])
  const detailsItem = detailsId ? described.find((i) => i.deadline.id === detailsId) : undefined
  const filtersActive =
    filters.scope !== DEFAULT_DEADLINE_FILTERS.scope ||
    filters.category !== undefined ||
    filters.priority !== undefined ||
    filters.status !== undefined ||
    filters.tag !== undefined

  const openDetails = useCallback((deadline: PersonalDeadline) => setDetailsId(deadline.id), [])
  const openEdit = (deadline: PersonalDeadline): void => {
    setEditing(deadline)
    setFormOpen(true)
  }

  let body: React.ReactNode
  if (query.isPending) {
    body = <LoadingState label="Loading deadlines…" />
  } else if (query.isError) {
    body = (
      <ErrorState
        error={query.error}
        title="Could not load your deadlines"
        onRetry={() => void query.refetch()}
      />
    )
  } else if (deadlines.length === 0) {
    const copy = EMPTY_STATES.personalDeadlines
    body = (
      <EmptyState
        icon={Timer}
        title={copy.title}
        description={copy.description}
        actions={[{ label: copy.actions[0], onClick: openCreate, icon: Plus }]}
      />
    )
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              aria-label="Deadline view"
              size="sm"
              value={ui.personalDeadlinesView}
              onValueChange={(view) => void updateUi({ personalDeadlinesView: view })}
              options={VIEW_OPTIONS}
            />
            <SegmentedControl
              aria-label="Show"
              size="sm"
              value={filters.scope}
              onValueChange={(scope) => setFilters((f) => ({ ...f, scope }))}
              options={SCOPE_OPTIONS}
            />
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden="true" />
            Add Personal Deadline
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.category ?? ALL}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                category: v === ALL ? undefined : (v as PersonalDeadlineCategory)
              }))
            }
          >
            <SelectTrigger size="sm" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {PERSONAL_DEADLINE_CATEGORIES.map((id) => (
                <SelectItem key={id} value={id}>
                  {getCategory(id).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.priority ?? ALL}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, priority: v === ALL ? undefined : (v as Priority) }))
            }
          >
            <SelectTrigger size="sm" aria-label="Filter by priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All priorities</SelectItem>
              {Object.values(PRIORITY_DEFINITIONS).map((def) => (
                <SelectItem key={def.id} value={def.id}>
                  {def.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status ?? ALL}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, status: v === ALL ? undefined : (v as DeadlineStatus) }))
            }
          >
            <SelectTrigger size="sm" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {Object.values(DEADLINE_STATUS_DEFINITIONS).map((def) => (
                <SelectItem key={def.id} value={def.id}>
                  {def.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tags.length > 0 && (
            <Select
              value={filters.tag ?? ALL}
              onValueChange={(v) => setFilters((f) => ({ ...f, tag: v === ALL ? undefined : v }))}
            >
              <SelectTrigger size="sm" aria-label="Filter by tag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    #{tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sort} onValueChange={(v) => setSort(v as DeadlineSort)}>
            <SelectTrigger size="sm" aria-label="Sort deadlines">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEADLINE_SORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {DEADLINE_SORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button size="sm" variant="ghost" onClick={() => setFilters(DEFAULT_DEADLINE_FILTERS)}>
              <X aria-hidden="true" />
              Clear filters
            </Button>
          )}
          <span
            className="tabular ml-auto text-xs text-muted-foreground"
            data-testid="deadline-count"
          >
            {visible.length} of {deadlines.length} deadlines
          </span>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={Timer}
            title="No deadlines match these filters."
            actions={[
              {
                label: 'Clear filters',
                onClick: () => setFilters(DEFAULT_DEADLINE_FILTERS),
                variant: 'outline'
              }
            ]}
          />
        ) : ui.personalDeadlinesView === 'list' ? (
          <PersonalDeadlineList items={visible} onOpen={openDetails} />
        ) : ui.personalDeadlinesView === 'timeline' ? (
          <PersonalDeadlineTimeline items={visible} nowIso={nowIso} onOpen={openDetails} />
        ) : (
          <div
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            role="list"
            aria-label="Personal deadlines"
          >
            {visible.map((item) => (
              <div key={item.deadline.id} role="listitem">
                <PersonalDeadlineCard item={item} onOpen={openDetails} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {body}
      <PersonalDeadlineDetails
        item={detailsItem}
        open={detailsItem !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsId(undefined)
            clearDeepLink()
          }
        }}
        onEdit={openEdit}
      />
      <PersonalDeadlineForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditing(undefined)
            if (params.create !== undefined) clearDeepLink()
          }
        }}
        deadline={editing}
      />
    </>
  )
}
