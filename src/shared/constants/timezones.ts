export interface TimezoneOption {
  /** Value accepted by `resolveZone`. */
  id: string
  label: string
}

export interface TimezoneOptionGroup {
  group: string
  options: readonly TimezoneOption[]
}

const iana = (id: string, label = id.split('/').pop()!.replace(/_/g, ' ')): TimezoneOption => ({
  id,
  label
})

const fixedOffsets: TimezoneOption[] = []
for (let h = -12; h <= 14; h += 1) {
  const id = `UTC${h < 0 ? '-' : '+'}${String(Math.abs(h)).padStart(2, '0')}:00`
  fixedOffsets.push({ id, label: id })
}

/** Curated selector list. `system` must always be first. */
export const TIMEZONE_OPTIONS: readonly TimezoneOptionGroup[] = [
  {
    group: 'Common',
    options: [
      { id: 'system', label: 'System timezone' },
      { id: 'UTC', label: 'UTC' },
      { id: 'AoE', label: 'AoE (Anywhere on Earth, UTC−12)' },
      { id: 'PT', label: 'PT (Pacific, America/Los_Angeles)' },
      { id: 'ET', label: 'ET (Eastern, America/New_York)' }
    ]
  },
  {
    group: 'North America',
    options: [
      iana('America/Los_Angeles'),
      iana('America/Denver'),
      iana('America/Phoenix'),
      iana('America/Chicago'),
      iana('America/New_York'),
      iana('America/Toronto'),
      iana('America/Vancouver'),
      iana('America/Anchorage'),
      iana('Pacific/Honolulu'),
      iana('America/Mexico_City')
    ]
  },
  {
    group: 'South America',
    options: [
      iana('America/Sao_Paulo'),
      iana('America/Buenos_Aires'),
      iana('America/Bogota'),
      iana('America/Santiago')
    ]
  },
  {
    group: 'Europe',
    options: [
      iana('Europe/London'),
      iana('Europe/Dublin'),
      iana('Europe/Lisbon'),
      iana('Europe/Paris'),
      iana('Europe/Berlin'),
      iana('Europe/Madrid'),
      iana('Europe/Rome'),
      iana('Europe/Amsterdam'),
      iana('Europe/Zurich'),
      iana('Europe/Stockholm'),
      iana('Europe/Helsinki'),
      iana('Europe/Athens'),
      iana('Europe/Istanbul'),
      iana('Europe/Moscow')
    ]
  },
  {
    group: 'Africa & Middle East',
    options: [
      iana('Africa/Cairo'),
      iana('Africa/Johannesburg'),
      iana('Africa/Lagos'),
      iana('Africa/Nairobi'),
      iana('Asia/Dubai'),
      iana('Asia/Jerusalem')
    ]
  },
  {
    group: 'Asia',
    options: [
      iana('Asia/Kolkata'),
      iana('Asia/Karachi'),
      iana('Asia/Dhaka'),
      iana('Asia/Bangkok'),
      iana('Asia/Jakarta'),
      iana('Asia/Singapore'),
      iana('Asia/Hong_Kong'),
      iana('Asia/Shanghai'),
      iana('Asia/Taipei'),
      iana('Asia/Seoul'),
      iana('Asia/Tokyo')
    ]
  },
  {
    group: 'Oceania',
    options: [
      iana('Australia/Perth'),
      iana('Australia/Adelaide'),
      iana('Australia/Brisbane'),
      iana('Australia/Sydney'),
      iana('Pacific/Auckland')
    ]
  },
  { group: 'Fixed offsets', options: fixedOffsets }
]

export const TIMEZONE_OPTION_IDS: readonly string[] = TIMEZONE_OPTIONS.flatMap((g) =>
  g.options.map((o) => o.id)
)
