import { useEffect, useRef, useState } from 'react'
import { SETTINGS_SECTIONS, type SettingsSectionId } from '@renderer/app/commands'
import { useNavigation } from '@renderer/app/navigation'
import { PageHeader } from '@renderer/components/common/PageHeader'
import { AboutSection } from '@renderer/features/settings/components/AboutSection'
import { ConferenceSubscriptionsSection } from '@renderer/features/settings/components/ConferenceSubscriptionsSection'
import { DataSection } from '@renderer/features/settings/components/DataSection'
import { GeneralSection } from '@renderer/features/settings/components/GeneralSection'
import { RefreshSettings } from '@renderer/features/settings/components/RefreshSettings'
import { cn } from '@renderer/lib/utils'

const isSectionId = (value: unknown): value is SettingsSectionId =>
  typeof value === 'string' && SETTINGS_SECTIONS.some((section) => section.id === value)

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
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-4 rounded-lg border bg-card px-5 py-4 shadow-xs"
    >
      <h2 id={`${id}-heading`} className="mb-2 text-base font-semibold">
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
  const contentRef = useRef<HTMLDivElement>(null)

  const scrollTo = (id: SettingsSectionId): void => {
    setActive(id)
    contentRef.current?.querySelector<HTMLElement>(`#${id}`)?.scrollIntoView({ block: 'start' })
  }

  useEffect(() => {
    if (requested)
      contentRef.current
        ?.querySelector<HTMLElement>(`#${requested}`)
        ?.scrollIntoView({ block: 'start' })
  }, [requested])

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Settings"
        subtitle="Preferences are saved immediately and stay on this computer."
      />
      <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-0 lg:self-start">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {SETTINGS_SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  aria-current={active === section.id ? 'location' : undefined}
                  onClick={() => scrollTo(section.id)}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                    active === section.id
                      ? 'bg-accent font-medium text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div ref={contentRef} className="flex min-w-0 flex-col gap-4">
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
      </div>
    </div>
  )
}
