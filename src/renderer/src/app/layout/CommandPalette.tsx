import { groupCommands, useCommandPalette, useCommands, type Command } from '@renderer/app/commands'
import { useNavigation } from '@renderer/app/navigation'
import { KeyboardHint } from '@renderer/components/common/KeyboardHint'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@renderer/components/ui/command'
import { logError } from '@renderer/lib/log'
import { toastError } from '@renderer/lib/toast'

export function CommandPalette(): React.JSX.Element {
  const open = useCommandPalette((state) => state.open)
  const setOpen = useCommandPalette((state) => state.setOpen)
  const commands = useCommands()
  const page = useNavigation((state) => state.page)
  const navigate = useNavigation((state) => state.navigate)

  const run = async (command: Command): Promise<void> => {
    setOpen(false)
    try {
      await command.run({ page, navigate, close: () => setOpen(false) })
    } catch (error) {
      logError(`Command "${command.id}" failed`, error)
      toastError(error, { retry: () => run(command) })
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" aria-label="Search commands" />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {groupCommands(commands).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((command) => (
              <CommandItem
                key={command.id}
                value={command.title}
                keywords={[command.id, group, ...(command.keywords ?? [])]}
                onSelect={() => void run(command)}
              >
                {command.icon && <command.icon aria-hidden="true" />}
                <span className="truncate">{command.title}</span>
                {command.shortcut && (
                  <CommandShortcut>
                    <KeyboardHint shortcut={command.shortcut} />
                  </CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
