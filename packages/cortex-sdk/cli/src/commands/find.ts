import type { TuiContext } from "../tui/renderer"
import { destroyTui } from "../tui/renderer"
import { MODULES, type ModuleId } from "../catalog"
import { promptSelect, type SelectOption } from "../tui/select"
import { promptMultiSelect } from "../tui/multiselect"
import { resolveModule, selectModules, collectConfig } from "./flow"
import { writeConfig, readConfig } from "../config"

export async function runFind(tui: TuiContext): Promise<number> {
  // 1. pick a unit (provider or module)
  const unitOptions: SelectOption[] = MODULES.flatMap((module) =>
    module.providers.map((p) => ({
      name: p.name,
      description: `${module.name} — ${p.description}`,
      value: `${module.id}.${p.id}`,
    })),
  )

  const pick = await promptSelect(tui, {
    title: "Find a provider",
    subtitle: "Search or scroll to choose what to install",
    options: unitOptions,
  })
  if (!pick) {
    await destroyTui(tui)
    console.log("Cancelled.")
    return 0
  }

  const [moduleId, providerId] = pick.split(".") as [ModuleId, string]

  // 2. ask which SDK modules to enable
  const modules = await selectModules(tui)
  if (!modules || modules.length === 0) {
    await destroyTui(tui)
    console.log("No modules selected — no changes made.")
    return 0
  }

  // 3. resolve the picked provider first, then the rest
  const entries = []
  const pickedEntry = await resolveProviderDirect(tui, moduleId, providerId)
  if (pickedEntry) entries.push(pickedEntry)

  for (const m of modules) {
    if (m === moduleId) continue
    const entry = await resolveModule(tui, m)
    if (entry) entries.push(entry)
  }

  await destroyTui(tui)

  if (entries.length === 0) {
    console.log("No modules configured — no changes made.")
    return 0
  }

  const result = await writeConfig(process.cwd(), entries, { append: true })
  const existing = await readConfig(process.cwd())
  console.log(`\nWrote ${result.path}`)
  console.log("")
  for (const [name, config] of Object.entries(existing.modules)) {
    console.log(`  export const ${name} = ${JSON.stringify(config)}`)
  }
  return 0
}

async function resolveProviderDirect(
  tui: TuiContext,
  moduleId: ModuleId,
  providerId: string,
): Promise<{ name: string; config: Record<string, unknown> } | undefined> {
  const module = MODULES.find((m) => m.id === moduleId)
  if (!module) return undefined
  const provider = module.providers.find((p) => p.id === providerId)
  if (!provider) return undefined

  if (moduleId === "voice") {
    // keep the voice flow (stt + tts) but pre-pick the chosen provider as stt
    return resolveModule(tui, moduleId)
  }

  return collectConfig(tui, moduleId, providerId, provider.needsKey, provider.defaultModel, provider.envKey)
}
