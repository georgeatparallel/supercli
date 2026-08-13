import { Select, SelectRenderableEvents, Box, type ProxiedVNode } from "@opentui/core"
import type { TuiContext } from "./renderer"
import { renderBanner } from "./banner"

export interface SelectOption {
  name: string
  description: string
  value?: string
}

export async function promptSelect(
  tui: TuiContext,
  opts: {
    title: string
    subtitle?: string
    options: SelectOption[]
    defaultIndex?: number
  },
): Promise<string | undefined> {
  return new Promise(async (resolve) => {
    const select = Select({
      options: opts.options.map((o) => ({ name: o.name, description: o.description, value: o.value })),
      selectedIndex: opts.defaultIndex ?? 0,
      showDescription: true,
      showScrollIndicator: true,
      height: Math.min(opts.options.length, 8) * 2 + 1,
    })

    let settled = false

    const onSelect = (_index: number, option: { name: string; value?: string }) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(option.value ?? option.name)
    }
    const onKey = (key: { name?: string; ctrl?: boolean }) => {
      if (settled) return
      if (key.name === "escape") {
        settled = true
        cleanup()
        resolve(undefined)
      }
      if (key.ctrl && key.name === "c") {
        settled = true
        cleanup()
        process.exit(130)
      }
    }

    const cleanup = () => {
      select.off(SelectRenderableEvents.ITEM_SELECTED, onSelect)
      tui.renderer.keyInput.off("keypress", onKey)
    }

    select.on(SelectRenderableEvents.ITEM_SELECTED, onSelect)
    tui.renderer.keyInput.on("keypress", onKey)

    const node = Box(
      { flexDirection: "column", width: "100%" },
      renderBanner(opts.title, opts.subtitle),
      select as unknown as ProxiedVNode<any>,
    )
    await tui.screen(node)
    tui.focus()
  })
}
