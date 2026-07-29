import chalk from "chalk"
import { theme, frame } from "src/cli/utils/tui.ts"
import { getCrispModeSync } from "src/cli/crisp/index.ts"
import type { SlashCommandResult } from "./index.ts"

const bar = (pct: number, width = 20): string => {
  const filled = Math.round((pct / 100) * width)
  return "█".repeat(filled) + "·".repeat(width - filled)
}

export async function crispGainCommand(argsStr: string): Promise<SlashCommandResult> {
  const mode = getCrispModeSync()

  const content = [
    chalk.hex(theme.amber).bold("Crisp Gain"),
    chalk.hex(theme.muted)("benchmark median  ·  5 tasks  ·  3 models"),
    "",
    chalk.hex(theme.green)("Lines of code"),
    `  no-crisp  ${chalk.hex(theme.white)(bar(100))}  100%`,
    `  crisp     ${chalk.hex(theme.green)(bar(13))}${chalk.hex(theme.muted)(bar(87))}    6-20%  ${chalk.hex(theme.red)("▼ 80-94%")}`,
    "",
    chalk.hex(theme.green)("Cost"),
    `  no-crisp  ${chalk.hex(theme.white)(bar(100))}  100%`,
    `  crisp     ${chalk.hex(theme.green)(bar(38))}${chalk.hex(theme.muted)(bar(62))}   23-53%  ${chalk.hex(theme.red)("▼ 47-77%")}`,
    "",
    chalk.hex(theme.green)("Speed"),
    `  crisp     ${chalk.hex(theme.amber)("▸ 3-6× faster")}`,
    "",
    chalk.hex(theme.muted)("These are published benchmark medians (see README)."),
    chalk.hex(theme.muted)("They are measured, not computed from this repo."),
    "",
    chalk.hex(theme.amber)("This repo:"),
    `  ${chalk.hex(theme.green)("/crisp-debt")}   ${chalk.hex(theme.muted)("(shortcuts you deferred — the counted ledger)")}`,
    `  ${chalk.hex(theme.green)("/crisp-audit")}  ${chalk.hex(theme.muted)("(what's still cuttable)")}`,
  ].join("\n")

  console.log(frame(content, { title: "crisp-gain", borderColor: theme.amber, padding: 0 }))
  return { type: "help" }
}
