import { MODULES, configKey } from "../catalog"
import { readConfig } from "../config"

export async function runList(): Promise<number> {
  const config = await readConfig(process.cwd())

  console.log("Installed SDK modules")
  console.log("")
  const installed = Object.entries(config.modules)
  if (installed.length === 0) {
    console.log("  (none — run `cortex-sdk init` or `cortex-sdk find` to install)")
  } else {
    for (const [name, cfg] of installed) {
      const summary = JSON.stringify(cfg)
      console.log(`  ${name}: ${summary}`)
    }
  }

  console.log("")
  console.log("Available units")
  console.log("")
  for (const module of MODULES) {
    for (const provider of module.providers) {
      const installedMark = config.modules[configKey(module.id)]?.provider === provider.id ? " • installed" : ""
      console.log(`  ${module.id}.${provider.id}  ${provider.name}  (${provider.description})${installedMark}`)
    }
  }
  return 0
}
