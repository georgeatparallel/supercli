import { createTui, destroyTui } from "./tui/renderer"
import { runInit } from "./commands/init"
import { runFind } from "./commands/find"
import { runList } from "./commands/list"
import { runAdd } from "./commands/add"
import { runRemove } from "./commands/remove"
import { runUpdate } from "./commands/update"

const VERSION = "0.1.0"

const HELP = `cortex-sdk — install and configure the cortex SDK

Usage:
  cortex-sdk init              Interactive setup: pick modules and providers
  cortex-sdk find              Browse providers and install them
  cortex-sdk list              Show installed modules and available units
  cortex-sdk add <unit>        Add a unit (e.g. gateway.openrouter)
  cortex-sdk remove <unit>     Remove an installed unit
  cortex-sdk update <unit>     Reconfigure an installed unit
  cortex-sdk --help            Show this help
  cortex-sdk --version         Show version

Units are named <module>.<provider>, e.g.:
  gateway.openrouter, gateway.mergedev, web-search.exa, voice.smallest
`

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes("--help") || args.includes("-h") || args[0] === "help") {
    console.log(HELP)
    return
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION)
    return
  }

  const [command, term] = args

  switch (command) {
    case "init":
      await runInit(await createTui())
      return
    case "find":
      await runFind(await createTui())
      return
    case "list":
      await runList()
      return
    case "add":
      if (!term) {
        console.log("Usage: cortex-sdk add <unit>")
        console.log("Run `cortex-sdk list` to see available units.")
        process.exitCode = 1
        return
      }
      await runAdd(await createTui(), term)
      return
    case "remove":
      if (!term) {
        console.log("Usage: cortex-sdk remove <unit>")
        process.exitCode = 1
        return
      }
      await runRemove(term)
      return
    case "update":
      if (!term) {
        console.log("Usage: cortex-sdk update <unit>")
        process.exitCode = 1
        return
      }
      await runUpdate(await createTui(), term)
      return
    default:
      console.log(`Unknown command: ${command}`)
      console.log("Run `cortex-sdk --help` for usage.")
      process.exitCode = 1
  }
}

main().catch(async (err) => {
  console.error("Error:", err?.message ?? err)
  process.exitCode = 1
})
