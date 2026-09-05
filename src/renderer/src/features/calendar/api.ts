// Query hooks and mutations for the calendar feature (TanStack Query over lib/api).
// Expected by the shell / other features:
//   useCalendarEvents(filter) -> calendar:listEvents (key: queryKeys.calendar.events(filter))
//   useCalendarSources()      -> calendar:listSources
//   useCreateEvent / useUpdateEvent / useDeleteEvent mutations
//   useIcsImport (pickIcsFiles -> previewIcsImport -> commitIcsImport)
//   useExportIcs(scope)
export {}
