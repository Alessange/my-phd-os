import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet'
import { Input } from './input'
import { AddRow, PropertyRow } from './property-row'
import { Row, RowList } from './row'
import { SegmentedControl } from './segmented-control'
import { Select, SelectTrigger, SelectValue } from './select'
import { Slider } from './slider'
import { Section } from './section'
import { StatusMark } from './status-mark'
import { Switch } from './switch'

describe('restyled primitives keep their semantics', () => {
  it('Button maps every legacy variant without a border or shadow class', () => {
    for (const variant of [
      'default',
      'secondary',
      'outline',
      'ghost',
      'destructive',
      'link'
    ] as const) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>)
      const button = screen.getByRole('button', { name: variant })
      expect(button.className).not.toMatch(/\bborder\b|shadow/)
      unmount()
    }
  })

  it('a disabled primary drops to the muted ground instead of a faded ink slab', () => {
    render(<Button disabled>Create</Button>)
    const { className } = screen.getByRole('button', { name: 'Create' })
    expect(className).toContain('disabled:bg-muted')
    expect(className).not.toContain('disabled:opacity-50')
  })

  it('PropertyRow and AddRow share one row height and hairline', () => {
    render(
      <>
        <PropertyRow label="Category" htmlFor="c">
          <input id="c" />
        </PropertyRow>
        <AddRow>Add description</AddRow>
      </>
    )
    expect(screen.getByLabelText('Category')).toBeInTheDocument()
    for (const el of [
      screen.getByText('Category').closest('[data-slot="property-row"]'),
      screen.getByRole('button', { name: 'Add description' })
    ]) {
      expect(el?.className).toContain('min-h-[50px]')
      expect(el?.className).toContain('border-b')
    }
  })

  it('Input is an underline field unless bare', () => {
    render(
      <>
        <Input aria-label="field" />
        <Input aria-label="bare" variant="bare" />
      </>
    )
    expect(screen.getByLabelText('field').className).toContain('field')
    expect(screen.getByLabelText('bare').className).not.toMatch(/\bfield\b/)
  })

  it('SegmentedControl keeps radiogroup semantics and arrow-key movement', async () => {
    function Harness(): React.JSX.Element {
      const [value, setValue] = useState<'a' | 'b'>('a')
      return (
        <SegmentedControl
          aria-label="View"
          value={value}
          onValueChange={setValue}
          options={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' }
          ]}
        />
      )
    }
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true')
    screen.getByRole('radio', { name: 'Alpha' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true')
    // Focus follows the selection: the focused radio is the checked one and the tab stop.
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('tabindex', '0')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus()
  })

  it('Switch toggles through role=switch', async () => {
    render(<Switch aria-label="Show passed" />)
    const toggle = screen.getByRole('switch', { name: 'Show passed' })
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })
})

describe('new primitives', () => {
  it('Row marks the selected state and RowList is a hairline list', () => {
    render(
      <RowList data-testid="list">
        <Row>one</Row>
        <Row selected>two</Row>
      </RowList>
    )
    expect(screen.getByTestId('list').className).toContain('divide-y')
    expect(screen.getByText('two')).toHaveAttribute('data-selected', 'true')
    expect(screen.getByText('one')).not.toHaveAttribute('data-selected')
  })

  it('StatusMark always prints the word', () => {
    render(<StatusMark label="Urgent" colorToken="status-urgent" glyph={<svg />} />)
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })

  it('Section renders its heading and actions', () => {
    render(
      <Section title="Following" count={7} actions={<button>Show passed</button>}>
        body
      </Section>
    )
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Following7')
    expect(screen.getByRole('button', { name: 'Show passed' })).toBeInTheDocument()
  })
})

describe('overlay Close', () => {
  it('stays in the accessibility tree but is not an invisible Tab stop (dialog and sheet)', () => {
    render(
      <>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
            <DialogDescription>Body</DialogDescription>
          </DialogContent>
        </Dialog>
        <Sheet open>
          <SheetContent>
            <SheetTitle>Sheet</SheetTitle>
            <SheetDescription>Body</SheetDescription>
          </SheetContent>
        </Sheet>
      </>
    )
    const closes = screen.getAllByRole('button', { name: 'Close', hidden: true })
    expect(closes).toHaveLength(2)
    for (const close of closes) expect(close).toHaveAttribute('tabindex', '-1')
  })
})

describe('overlay focus return', () => {
  function Harness({ kind }: { kind: 'dialog' | 'sheet' }): React.JSX.Element {
    const [open, setOpen] = useState(false)
    const Root = kind === 'dialog' ? Dialog : Sheet
    const Content = kind === 'dialog' ? DialogContent : SheetContent
    const Title = kind === 'dialog' ? DialogTitle : SheetTitle
    const Description = kind === 'dialog' ? DialogDescription : SheetDescription
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open it
        </button>
        <Root open={open} onOpenChange={setOpen}>
          <Content>
            <Title>Title</Title>
            <Description>Body</Description>
          </Content>
        </Root>
      </>
    )
  }

  it.each(['dialog', 'sheet'] as const)(
    'a controlled %s hands focus back to the control that opened it on Esc',
    async (kind) => {
      const user = userEvent.setup()
      render(<Harness kind={kind} />)
      const opener = screen.getByRole('button', { name: 'Open it' })
      opener.focus()
      await user.keyboard('{Enter}')
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(opener).toHaveFocus()
    }
  )
})

describe('focus indicators and names', () => {
  it('a bare Select trigger keeps the global focus ring (no outline-none)', () => {
    render(
      <Select>
        <SelectTrigger variant="bare" aria-label="Sort">
          <SelectValue placeholder="x" />
        </SelectTrigger>
      </Select>
    )
    expect(screen.getByRole('combobox', { name: 'Sort' }).className).not.toContain('outline-none')
  })

  it('the Slider thumb, the focusable role=slider element, carries the name', () => {
    render(<Slider value={[40]} aria-label="Work progress" />)
    expect(screen.getByRole('slider', { name: 'Work progress' })).toBeInTheDocument()
  })

  it('a selected Row hangs its rule into the gutter so text never touches it', () => {
    render(<Row selected>CVPR</Row>)
    const { className } = screen.getByText('CVPR')
    expect(className).toContain('after:-left-4')
    expect(className).toContain('before:-inset-x-4')
  })
})
