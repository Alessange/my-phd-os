export interface LicenseEntry {
  name: string
  license: string
  url: string
}

/** Direct dependencies from package.json with their published licenses. */
export const OPEN_SOURCE_LICENSES: readonly LicenseEntry[] = [
  { name: 'Electron', license: 'MIT', url: 'https://github.com/electron/electron' },
  { name: 'electron-vite', license: 'MIT', url: 'https://github.com/alex8088/electron-vite' },
  {
    name: 'electron-builder',
    license: 'MIT',
    url: 'https://github.com/electron-userland/electron-builder'
  },
  { name: 'electron-log', license: 'MIT', url: 'https://github.com/megahertz/electron-log' },
  {
    name: '@electron-toolkit/utils',
    license: 'MIT',
    url: 'https://github.com/alex8088/electron-toolkit'
  },
  { name: 'React & React DOM', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'TypeScript', license: 'Apache-2.0', url: 'https://github.com/microsoft/TypeScript' },
  { name: 'Vite', license: 'MIT', url: 'https://github.com/vitejs/vite' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss' },
  { name: 'tw-animate-css', license: 'MIT', url: 'https://github.com/Wombosvideo/tw-animate-css' },
  { name: 'Radix UI primitives', license: 'MIT', url: 'https://github.com/radix-ui/primitives' },
  { name: 'cmdk', license: 'MIT', url: 'https://github.com/pacocoursey/cmdk' },
  { name: 'lucide-react', license: 'ISC', url: 'https://github.com/lucide-icons/lucide' },
  { name: 'sonner', license: 'MIT', url: 'https://github.com/emilkowalski/sonner' },
  {
    name: 'class-variance-authority',
    license: 'Apache-2.0',
    url: 'https://github.com/joe-bell/cva'
  },
  { name: 'clsx', license: 'MIT', url: 'https://github.com/lukeed/clsx' },
  { name: 'tailwind-merge', license: 'MIT', url: 'https://github.com/dcastil/tailwind-merge' },
  { name: 'FullCalendar', license: 'MIT', url: 'https://github.com/fullcalendar/fullcalendar' },
  { name: 'rrule', license: 'BSD-3-Clause', url: 'https://github.com/jkbrzt/rrule' },
  { name: 'ical.js', license: 'MPL-2.0', url: 'https://github.com/kewisch/ical.js' },
  { name: 'Luxon', license: 'MIT', url: 'https://github.com/moment/luxon' },
  { name: 'Recharts', license: 'MIT', url: 'https://github.com/recharts/recharts' },
  { name: 'Zod', license: 'MIT', url: 'https://github.com/colinhacks/zod' },
  { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
  { name: 'TanStack Query', license: 'MIT', url: 'https://github.com/TanStack/query' }
]
