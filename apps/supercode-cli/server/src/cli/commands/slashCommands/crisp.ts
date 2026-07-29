import chalk from "chalk"
import { CRISP_MODES, getCrispModeSync, setCrispMode, CRISP_MODE_LABELS } from "src/cli/crisp/index.ts"
import { theme, frame } from "src/cli/utils/tui.ts"
import type { SlashCommandResult } from "./index.ts"
import type { CrispMode } from "src/cli/crisp/config.ts"

export async function crispCommand(argsStr: string): Promise<SlashCommandResult> {
  const parts = argsStr.trim().split(/\s+/).filter(Boolean)
  const raw = parts[0] ?? ""

  if (raw === "lite" || raw === "full" || raw === "ultra" || raw === "off" || raw === "on") {
    const mode: CrispMode = raw === "on" ? "full" : raw
    await setCrispMode(mode)
    if (mode === "off") {
      console.log(` ${chalk.hex(theme.green)("✓")} ${chalk.hex(theme.muted)("Crisp disabled")}`)
    } else {
      console.log(
        frame(
          `${chalk.hex(theme.amber).bold(`Supercode Crisp: ${mode}`)}\n\n${chalk.hex(theme.muted)(CRISP_MODE_LABELS[mode])}\n\nThe simplicity ladder will be injected into every agent session.\nTry: /crisp status`,
          { title: `crisp:${mode}`, borderColor: theme.amber, padding: 0 },
        ),
      )
    }
    return { type: "help" }
  }

  // Default / "on" / "status" → show status
  const current = getCrispModeSync()
  const statusLines = [
    chalk.hex(theme.amber).bold(`Supercode Crisp: ${current}`),
    "",
    `${chalk.hex(theme.muted)("Usage:")} /crisp { lite | full | ultra | off | status }`,
    "",
    ...CRISP_MODES.map((m) => {
      const indicator = m === current ? chalk.hex(theme.green)("▸") : " "
      return ` ${indicator} ${chalk.hex(m === current ? theme.white : theme.muted)(`/${m}`).padEnd(18)} ${chalk.hex(m === current ? theme.green : theme.greenDim)(CRISP_MODE_LABELS[m])}`
    }),
  ].join("\n")

  console.log(
    frame(statusLines, {
      title: "crisp",
      borderColor: theme.amber,
      padding: 0,
    }),
  )
  return { type: "help" }
}
