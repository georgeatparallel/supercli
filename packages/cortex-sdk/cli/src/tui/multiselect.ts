import { Select, SelectRenderableEvents, Box, Text, type ProxiedVNode } from "@opentui/core"
import type { TuiContext } from "./renderer"
import { renderBanner } from "./banner"

export interface MultiSelectOption {
  name: string
  description: string
  value?: string
}

export interface MultiSelectResult {
  selected: string[]
  cancelled: boolean
}

export async function promptMultiSelect(
  tui: TuiContext,
  opts: {
    title: string
    subtitle?: string
    options: MultiSelectOption[]
    defaults?: string[]
  },
): Promise<MultiSelectResult> {
  const state = new Map<string, boolean>()
  for (const opt of opts.options) {
    state.set(opt.value ?? opt.name, opts.defaults?.includes(opt.value ?? opt.name) ?? false)
  }

  return new Promise(async (resolve) => {
    const select = Select({
      options: [],
      selectedIndex: 0,
      showDescription: true,
      showScrollIndicator: true,
      height: Math.min(opts.options.length, 8) * 2 + 1,
    })

    let currentValue: string | undefined = opts.options[0] ? opts.options[0].value ?? opts.options[0].name : undefined
    let resolved = false

    const labelFor = (opt: MultiSelectOption): string => {
      const v = opt.value ?? opt.name
      const checked = state.get(v) ? "[x]" : "[ ]"
      return `${checked} ${opt.name}`
    }

    const applyOptions = () => {
      select.options = opts.options.map((o) => ({
        name: labelFor(o),
        description: o.description,
        value: o.value ?? o.name,
      }))
    }

    const onSelectionChanged = (_index: number, option: { name: string; value?: string }) => {
      currentValue = option.value ?? option.name
    }
    const onKey = (key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        cleanup()
        process.exit(130)
      }
    }
    const onToggleKey = (key: { name?: string; ctrl?: boolean }) => {
      if (key.name === "space") {
        if (!currentValue) return
        state.set(currentValue, !(state.get(currentValue) ?? false))
        applyOptions()
      }
      if (key.name === "return") {
        if (resolved) return
        resolved = true
        cleanup()
        const selected = opts.options
          .filter((o) => state.get(o.value ?? o.name))
          .map((o) => o.value ?? o.name)
        resolve({ selected, cancelled: false })
      }
      if (key.name === "escape") {
        if (resolved) return
        resolved = true
        cleanup()
        resolve({ selected: [], cancelled: true })
      }
    }

    const cleanup = () => {
      select.off(SelectRenderableEvents.SELECTION_CHANGED, onSelectionChanged)
      tui.renderer.keyInput.off("keypress", onKey)
      tui.renderer.keyInput.off("keypress", onToggleKey)
    }

    select.on(SelectRenderableEvents.SELECTION_CHANGED, onSelectionChanged)
    tui.renderer.keyInput.on("keypress", onKey)
    tui.renderer.keyInput.on("keypress", onToggleKey)

    const node = Box(
      { flexDirection: "column", width: "100%" },
      renderBanner(opts.title, opts.subtitle),
      Text({ content: "↑/↓ move • space toggle • enter done • esc cancel", paddingLeft: 1, paddingBottom: 1 }),
      select as unknown as ProxiedVNode<any>,
    )
    applyOptions()
    await tui.screen(node)
    tui.focus()
  })
}
