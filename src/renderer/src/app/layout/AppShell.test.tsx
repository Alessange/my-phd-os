import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useNavigation } from '@renderer/app/navigation'
import { useShell } from '@renderer/app/shell'
import { PageAction } from '@renderer/components/common/PageAction'
import { Button } from '@renderer/components/ui/button'
import { renderWithProviders } from '@renderer/test/renderWithProviders'
import { AppShell } from './AppShell'

const reset = (page: 'calendar' | 'deadlines' | 'settings' = 'calendar'): void => {
  useNavigation.setState({ page, params: {}, hydrated: false })
  useShell.setState({ sidebarCollapsed: false, hydrated: false })
}

describe('AppShell anatomy (DESIGN.md section 7)', () => {
  beforeEach(() => reset())

  it('keeps the Primary nav contract: five buttons, label in the first span, aria-current on the active one', async () => {
    renderWithProviders(<AppShell>content</AppShell>)
    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    const buttons = within(nav).getAllByRole('button')
    expect(buttons.map((button) => button.querySelector('span')?.textContent)).toEqual([
      'Calendar',
      'Deadlines',
      'Timeline',
      'Habits',
      'Settings'
    ])
    expect(buttons[0]).toHaveAttribute('aria-current', 'page')
    expect(buttons[1]).not.toHaveAttribute('aria-current')
  })

  it('puts the page label, the dateline, Search and one create button in the banner strip', async () => {
    renderWithProviders(<AppShell>content</AppShell>)
    const banner = await screen.findByRole('banner')
    expect(within(banner).getByText('Calendar', { exact: true })).toBeInTheDocument()
    // Label in Name (WCAG 2.5.3): the accessible name is the visible text, so it starts with "Search".
    const search = within(banner).getByRole('button', { name: /^Search/ })
    expect(search).toHaveTextContent('Search')
    expect(search).not.toHaveAttribute('aria-label')
    expect(search).toHaveAttribute('title', 'Open command palette')
    const create = within(banner).getByRole('button', { name: /Add event/ })
    expect(create).toHaveTextContent('Add event')
    // Label in Name (WCAG 2.5.3): the accessible name starts with the visible text.
    expect(create.getAttribute('aria-label')).toMatch(/^Add event \(.+N\)$/)
    expect(banner.querySelector('time')).not.toBeNull()
  })

  it('names the create button after the active Deadlines tab', async () => {
    reset('deadlines')
    useNavigation.setState({ params: { tab: 'personal' } })
    renderWithProviders(<AppShell>content</AppShell>)
    expect(await screen.findByRole('button', { name: /Add personal deadline/ })).toHaveTextContent(
      'Add personal deadline'
    )
  })

  it('shows no create button on Settings', async () => {
    reset('settings')
    renderWithProviders(<AppShell>content</AppShell>)
    await screen.findByRole('banner')
    expect(
      within(screen.getByRole('banner')).queryByRole('button', { name: /\((⌘|Ctrl\+)N\)/ })
    ).not.toBeInTheDocument()
  })

  it('collapses to icon-only items with accessible names and a labelled toggle', async () => {
    renderWithProviders(<AppShell>content</AppShell>)
    await userEvent.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).getByRole('button', { name: 'Deadlines' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('moves the page action into the strip and hides the default create button', async () => {
    renderWithProviders(
      <AppShell>
        <PageAction>
          <Button>Add from page</Button>
        </PageAction>
      </AppShell>
    )
    const banner = await screen.findByRole('banner')
    expect(await within(banner).findByRole('button', { name: 'Add from page' })).toBeInTheDocument()
    expect(within(banner).queryByRole('button', { name: /Add event/ })).not.toBeInTheDocument()
  })

  it('offers the Appearance menu with Light, Dark and System in the sidebar footer', async () => {
    renderWithProviders(<AppShell>content</AppShell>)
    await userEvent.click(await screen.findByRole('button', { name: /Appearance/ }))
    for (const label of ['Light', 'Dark', 'System']) {
      expect(await screen.findByRole('menuitemradio', { name: label })).toBeInTheDocument()
    }
  })
})

describe('PageAction without a shell', () => {
  it('renders inline so page tests can click the page-level button', () => {
    renderWithProviders(
      <PageAction>
        <Button>Add event</Button>
      </PageAction>
    )
    expect(screen.getByRole('button', { name: 'Add event' })).toBeInTheDocument()
  })
})
