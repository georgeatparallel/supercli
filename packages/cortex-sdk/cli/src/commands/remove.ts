import { findUnit, configKey } from "../catalog"
import { readConfig, writeConfig } from "../config"

export async function runRemove(term: string): Promise<number> {
  const unit = findUnit(term)
  if (!unit) {
    console.log(`Unknown unit: ${term}`)
    console.log("Run `cortex-sdk list` to see available units.")
    return 1
  }

  const key = configKey(unit.module.id)
  const config = await readConfig(process.cwd())
  if (!config.modules[key]) {
    console.log(`${key} is not installed — nothing to remove.`)
    return 0
  }

  delete config.modules[key]
  const entries = Object.entries(config.modules).map(([name, cfg]) => ({ name, config: cfg }))
  await writeConfig(process.cwd(), entries, { append: false })
  console.log(`Removed ${key} from cortex.config.ts`)
  return 0
}
