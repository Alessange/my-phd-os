import type { IcsFileInput } from '@shared/types/calendar'

const ICS_NAME = /\.(ics|ical|icalendar|ifb)$/i

/** Reads dropped `.ics` files in the renderer; only each file's name and text ever cross the bridge. */
export const readDroppedIcsFiles = async (
  list: FileList | readonly File[]
): Promise<IcsFileInput[]> => {
  const files = [...list].filter(
    (file) => ICS_NAME.test(file.name) || file.type === 'text/calendar'
  )
  return Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })))
}

/** True when a drag carries files (so the page can show its drop affordance). */
export const dragHasFiles = (transfer: DataTransfer | null): boolean =>
  transfer !== null && Array.from(transfer.types).includes('Files')
