import type { TuiContext } from "../tui/renderer"
import { destroyTui } from "../tui/renderer"
import { selectModules, resolveModule } from "./flow"
import { writeConfig, readConfig, configPath } from "../config"

export async function runInit(tui: TuiContext): Promise<number> {
  const modules = await selectModules(tui)
  if (!modules || modules.length === 0) {
    await destroyTui(tui)
    console.log("Nothing selected — no changes made.")
    return 0
  }

  const entries = []
  for (const moduleId of modules) {
    const entry = await resolveModule(tui, moduleId)
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
  console.log("")
  console.log("Next: import the config in your app and pass each export to the matching SDK factory:")
  for (const entry of entries) {
    if (entry.name === "gateway") console.log(`  import { createGateway } from "supercode-cortex/gateway"`)
    if (entry.name === "web-search") console.log(`  import { createWebSearch } from "supercode-cortex/web-search"`)
    if (entry.name === "voice") console.log(`  import { createVoice } from "supercode-cortex/voice"`)
    if (entry.name === "composio") console.log(`  import { createComposio } from "supercode-cortex/composio"`)
    if (entry.name === "agent-handler") console.log(`  import { createAgentHandler } from "supercode-cortex/agent-handler"`)
  }
  return 0
}
