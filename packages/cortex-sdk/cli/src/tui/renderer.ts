import {
  createCliRenderer,
  instantiate,
  type CliRenderer,
  type Renderable,
  type VNode,
  type ProxiedVNode,
} from "@opentui/core"

export interface TuiContext {
  renderer: CliRenderer
  mounted: Renderable[]
  screen(node: ProxiedVNode<any>): Promise<Renderable>
  focus(): void
  keypress(onKey: (key: { name?: string; sequence?: string; ctrl?: boolean }) => void): void
}

export async function createTui(): Promise<TuiContext> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    screenMode: "alternate-screen",
  })
  const mounted: Renderable[] = []

  async function screen(node: ProxiedVNode<any>): Promise<Renderable> {
    for (const child of mounted) {
      renderer.root.remove(child)
    }
    mounted.length = 0
    const renderable = instantiate(renderer, node as unknown as VNode)
    renderer.root.add(renderable)
    mounted.push(renderable)
    await new Promise((r) => setTimeout(r, 100))
    return renderable
  }

  return {
    renderer,
    mounted,
    screen,
    focus() {
      const findFocusable = (node: Renderable): Renderable | null => {
        if (node.focusable) return node
        const children = (node as unknown as { _childrenInLayoutOrder: Renderable[] })._childrenInLayoutOrder ?? []
        for (const child of children) {
          const found = findFocusable(child)
          if (found) return found
        }
        return null
      }
      for (const root of mounted) {
        const target = findFocusable(root)
        if (target) {
          target.focus()
          return
        }
      }
    },
    keypress(onKey) {
      renderer.keyInput.on("keypress", (key) => onKey(key))
    },
  }
}

export async function destroyTui(tui: TuiContext): Promise<void> {
  await tui.renderer.destroy()
}
