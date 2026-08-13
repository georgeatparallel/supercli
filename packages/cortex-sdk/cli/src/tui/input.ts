import { Input, InputRenderableEvents, Box, Text, type ProxiedVNode } from "@opentui/core"
import type { TuiContext } from "./renderer"
import { renderBanner } from "./banner"

export interface InputResult {
  value: string
  cancelled: boolean
}

export async function promptInput(
  tui: TuiContext,
  opts: {
    title: string
    subtitle?: string
    placeholder?: string
    secure?: boolean
    initialValue?: string
  },
): Promise<InputResult> {
  return new Promise(async (resolve) => {
    const input = Input({
      placeholder: opts.placeholder,
      value: opts.initialValue ?? "",
      maxLength: 512,
    })

    let settled = false

    const onEnter = (value: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve({ value, cancelled: false })
    }
    const onKey = (key: { name?: string; ctrl?: boolean }) => {
      if (settled) return
      if (key.name === "escape") {
        settled = true
        cleanup()
        resolve({ value: "", cancelled: true })
      }
      if (key.ctrl && key.name === "c") {
        settled = true
        cleanup()
        process.exit(130)
      }
    }
    const cleanup = () => {
      input.off(InputRenderableEvents.ENTER, onEnter)
      tui.renderer.keyInput.off("keypress", onKey)
    }

    input.on(InputRenderableEvents.ENTER, onEnter)
    tui.renderer.keyInput.on("keypress", onKey)

    const secureNote = opts.secure
      ? Text({ content: "(input hidden)", paddingLeft: 1, paddingBottom: 1 })
      : Text({ content: "", paddingBottom: 1 })
    const node = Box(
      { flexDirection: "column", width: "100%" },
      renderBanner(opts.title, opts.subtitle),
      secureNote,
      input as unknown as ProxiedVNode<any>,
    )
    await tui.screen(node)
    tui.focus()
  })
}
