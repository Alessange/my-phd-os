import { useCallback, useEffect, useRef, useState } from 'react'
import { SETTINGS_SECTIONS, type SettingsSectionId } from '@renderer/app/commands'
import { useNavigation } from '@renderer/app/navigation'
import { Page } from '@renderer/components/common/Page'
import { PageHeader } from '@renderer/components/common/PageHeader'
import { AboutSection } from '@renderer/features/settings/components/AboutSection'
import { ConferenceSubscriptionsSection } from '@renderer/features/settings/components/ConferenceSubscriptionsSection'
import { DataSection } from '@renderer/features/settings/components/DataSection'
import { GeneralSection } from '@renderer/features/settings/components/GeneralSection'
import { RefreshSettings } from '@renderer/features/settings/components/RefreshSettings'
import { cn } from '@renderer/lib/utils'

const isSectionId = (value: unknown): value is SettingsSectionId =>
  typeof value === 'string' && SETTINGS_SECTIONS.some((section) => section.id === value)

/** How far below the top of the scroller a section must start to count as "current" (sticky nav + air). */
const SPY_OFFSET = 120
/** Scroll events fired by our own `scrollIntoView` must not fight the section the user just chose. */
const SPY_LOCK_MS = 700

function Section({
  id,
  title,
  children
}: {
  id: SettingsSectionId
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-16 flex flex-col gap-3">
      <h2 id={`${id}-heading`} className="text-title text-ink">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Settings with an in-page section nav. Deep link: `navigate('settings', { section })`. */
export default function SettingsPage(): React.JSX.Element {
  const params = useNavigation((state) => state.params)
  const requested = isSectionId(params.section) ? params.section : undefined
  const [active, setActive] = useState<SettingsSectionId>(requested ?? 'general')
  // A later deep link while already on Settings (menu › About, palette › Settings: Data) must move
  // the nav highlight too; derive it during render (no setState-in-effect).
  const [lastRequested, setLastRequested] = useState(requested)
  if (requested !== lastRequested) {
    setLastRequested(requested)
    if (requested) setActive(requested)
  }
  const contentRef = useRef<HTMLDivElement>(null)
  const lockUntil = useRef(0)

  const jumpTo = useCallback((id: SettingsSectionId): void => {
    lockUntil.current = Date.now() + SPY_LOCK_MS
    contentRef.current?.querySelector<HTMLElement>(`#${id}`)?.scrollIntoView({ block: 'start' })
  }, [])

  const scrollTo = (id: SettingsSectionId): void => {
    setActive(id)
    jumpTo(id)
  }

  useEffect(() => {
    if (requested) jumpTo(requested)
  }, [requested, jumpTo])

  // Scroll-spy: the nav highlight follows the section under the top of the scroller.
  useEffect(() => {
    const scroller = contentRef.current?.closest('main')
    if (!scroller) return
    const onScroll = (): void => {
      if (Date.now() < lockUntil.current) return
      const top = scroller.getBoundingClientRect().top
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
      let current: SettingsSectionId = SETTINGS_SECTIONS[0].id
      for (const section of SETTINGS_SECTIONS) {
        const element = contentRef.current?.querySelector<HTMLElement>(`#${section.id}`)
        if (element && element.getBoundingClientRect().top - top <= SPY_OFFSET) current = section.id
      }
      if (atBottom) current = SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1].id
      setActive(current)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <Page>
      <PageHeader
        title="Settings"
        subtitle="Preferences are saved immediately and stay on this computer."
      />
      <nav
        aria-label="Settings sections"
        className="sticky top-0 z-10 -mt-1 border-b border-line-strong bg-background"
      >
        <ul className="flex flex-wrap gap-x-7">
          {SETTINGS_SECTIONS.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                aria-current={active === section.id ? 'location' : undefined}
                onClick={() => scrollTo(section.id)}
                className={cn(
                  'relative -mb-px h-10 text-sm whitespace-nowrap transition-colors duration-100 hover:text-ink',
                  'after:absolute after:inset-x-0 after:bottom-0 after:h-[1.5px] after:bg-ink after:opacity-0',
                  active === section.id ? 'text-ink after:opacity-100' : 'text-ink-3'
                )}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div ref={contentRef} className="flex max-w-[780px] min-w-0 flex-col gap-12">
        <Section id="general" title="General">
          <GeneralSection />
        </Section>
        <Section id="subscriptions" title="Conference Subscriptions">
          <div className="flex flex-col gap-4">
            <ConferenceSubscriptionsSection />
            <RefreshSettings />
          </div>
        </Section>
        <Section id="data" title="Data">
          <DataSection />
        </Section>
        <Section id="about" title="About">
          <AboutSection />
        </Section>
      </div>
    </Page>
  )
}
