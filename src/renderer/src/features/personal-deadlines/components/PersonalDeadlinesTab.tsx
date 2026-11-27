import { ChevronDown } from 'lucide-react'
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
import { CREATE_LABELS, useNavigation } from '@renderer/app/navigation'
import { DEADLINES_QUICK_CREATE } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { PageAction } from '@renderer/components/common/PageAction'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
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
        title={copy.title}
        description={copy.description}
        actions={[{ label: copy.actions[0], onClick: openCreate }]}
      />
    )
  } else {
    const activeFilters = [filters.category, filters.priority, filters.status, filters.tag].filter(
      (value) => value !== undefined
    ).length
    body = (
      <div className="flex flex-col gap-6">
        <PageAction>
          <Button size="sm" onClick={openCreate}>
            {CREATE_LABELS.personalDeadline}
          </Button>
        </PageAction>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-ink">
          <SegmentedControl
            aria-label="Show"
            size="md"
            value={filters.scope}
            onValueChange={(scope) => setFilters((f) => ({ ...f, scope }))}
            options={SCOPE_OPTIONS}
            className="gap-x-7"
          />
          <div className="flex flex-wrap items-center gap-x-4">
            <span className="tabular text-meta text-ink-3" data-testid="deadline-count">
              {visible.length} of {deadlines.length} deadlines
            </span>
            {filtersActive && visible.length > 0 && (
              <button
                type="button"
                className="link-quiet app-no-drag"
                onClick={() => setFilters(DEFAULT_DEADLINE_FILTERS)}
              >
                Clear filters
              </button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 px-2">
                  Filters
                  {activeFilters > 0 && <span className="tabular text-ink-3">{activeFilters}</span>}
                  <ChevronDown className="size-4 text-ink-3" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-80 flex-col gap-5 p-5">
                <FilterSelect
                  label="Category"
                  ariaLabel="Filter by category"
                  value={filters.category ?? ALL}
                  allLabel="All categories"
                  onChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      category: v === ALL ? undefined : (v as PersonalDeadlineCategory)
                    }))
                  }
                  options={PERSONAL_DEADLINE_CATEGORIES.map((id) => ({
                    value: id,
                    label: getCategory(id).label
                  }))}
                />
                <FilterSelect
                  label="Priority"
                  ariaLabel="Filter by priority"
                  value={filters.priority ?? ALL}
                  allLabel="All priorities"
                  onChange={(v) =>
                    setFilters((f) => ({ ...f, priority: v === ALL ? undefined : (v as Priority) }))
                  }
                  options={Object.values(PRIORITY_DEFINITIONS).map((def) => ({
                    value: def.id,
                    label: def.label
                  }))}
                />
                <FilterSelect
                  label="Status"
                  ariaLabel="Filter by status"
                  value={filters.status ?? ALL}
                  allLabel="All statuses"
                  onChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      status: v === ALL ? undefined : (v as DeadlineStatus)
                    }))
                  }
                  options={Object.values(DEADLINE_STATUS_DEFINITIONS).map((def) => ({
                    value: def.id,
                    label: def.label
                  }))}
                />
                {tags.length > 0 && (
                  <FilterSelect
                    label="Tag"
                    ariaLabel="Filter by tag"
                    value={filters.tag ?? ALL}
                    allLabel="All tags"
                    onChange={(v) => setFilters((f) => ({ ...f, tag: v === ALL ? undefined : v }))}
                    options={tags.map((tag) => ({ value: tag, label: `#${tag}` }))}
                  />
                )}
                {filtersActive && (
                  <button
                    type="button"
                    className="link-quiet self-start"
                    onClick={() => setFilters(DEFAULT_DEADLINE_FILTERS)}
                  >
                    Clear filters
                  </button>
                )}
              </PopoverContent>
            </Popover>
            <Select value={sort} onValueChange={(v) => setSort(v as DeadlineSort)}>
              <SelectTrigger size="sm" variant="bare" aria-label="Sort deadlines">
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
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-line-strong" />
            <SegmentedControl
              aria-label="Deadline view"
              size="md"
              value={ui.personalDeadlinesView}
              onValueChange={(view) => void updateUi({ personalDeadlinesView: view })}
              options={VIEW_OPTIONS}
              className="gap-x-4"
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            variant="compact"
            title="No deadlines match these filters."
            actions={[
              { label: 'Clear filters', onClick: () => setFilters(DEFAULT_DEADLINE_FILTERS) }
            ]}
          />
        ) : ui.personalDeadlinesView === 'list' ? (
          <PersonalDeadlineList items={visible} onOpen={openDetails} grouped={sort === 'nearest'} />
        ) : ui.personalDeadlinesView === 'timeline' ? (
          <PersonalDeadlineTimeline items={visible} nowIso={nowIso} onOpen={openDetails} />
        ) : (
          <div
            className="grid gap-x-16 min-[1100px]:grid-cols-2"
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

interface FilterSelectProps {
  label: string
  ariaLabel: string
  value: string
  allLabel: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}

/** One labelled underline select of the Filters popover; `All ...` clears that filter. */
function FilterSelect({
  label,
  ariaLabel,
  value,
  allLabel,
  onChange,
  options
}: FilterSelectProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full" aria-label={ariaLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
