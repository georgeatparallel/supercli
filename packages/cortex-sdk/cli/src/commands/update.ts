import type { TuiContext } from "../tui/renderer"
import { destroyTui } from "../tui/renderer"
import { findUnit, configKey } from "../catalog"
import { collectConfig } from "./flow"
import { readConfig, writeConfig } from "../config"

export async function runUpdate(tui: TuiContext, term: string): Promise<number> {
  const unit = findUnit(term)
  if (!unit) {
    await destroyTui(tui)
    console.log(`Unknown unit: ${term}`)
    console.log("Run `cortex-sdk list` to see available units.")
    return 1
  }

  const { module, provider } = unit
  const key = configKey(module.id)
  const existing = await readConfig(process.cwd())
  const current = existing.modules[key] ?? {}

  const entry = await collectConfig(
    tui,
    module.id,
    provider.id,
    provider.needsKey,
    (current.model as string) || provider.defaultModel,
    provider.envKey,
  )
  await destroyTui(tui)

  if (!entry) {
    console.log("Cancelled.")
    return 0
  }

  const merged = { ...current, ...entry.config }
  await writeConfig(process.cwd(), [{ name: key, config: merged }], { append: true })
  console.log(`\nUpdated ${key} in cortex.config.ts`)
  return 0
}
