import type { TuiContext } from "../tui/renderer"
import { destroyTui } from "../tui/renderer"
import { findUnit, type ModuleId } from "../catalog"
import { collectConfig } from "./flow"
import { writeConfig, readConfig } from "../config"

export async function runAdd(tui: TuiContext, term: string): Promise<number> {
  const unit = findUnit(term)
  if (!unit) {
    await destroyTui(tui)
    console.log(`Unknown unit: ${term}`)
    console.log("Run `cortex-sdk list` to see available units.")
    return 1
  }

  const { module, provider } = unit
  const entry = await collectConfig(tui, module.id, provider.id, provider.needsKey, provider.defaultModel, provider.envKey)
  await destroyTui(tui)

  if (!entry) {
    console.log("Cancelled.")
    return 0
  }

  const result = await writeConfig(process.cwd(), [entry], { append: true })
  console.log(`\nAdded ${module.id}.${provider.id} → ${result.path}`)
  return 0
}
