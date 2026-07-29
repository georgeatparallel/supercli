import chalk from "chalk"
import { theme, frame } from "src/cli/utils/tui.ts"
import { getCrispModeSync } from "src/cli/crisp/index.ts"
import type { SlashCommandResult } from "./index.ts"

export async function crispHelpCommand(): Promise<SlashCommandResult> {
  const current = getCrispModeSync()

  const content = [
    chalk.hex(theme.amber).bold("Supercode Crisp — Simplicity Ladder Commands"),
    "",
    chalk.hex(theme.amber).bold("Levels"),
    `  ${chalk.hex(theme.green)("/crisp")}             ${chalk.hex(theme.muted)("Show current mode")}`,
    `  ${chalk.hex(theme.green)("/crisp full")}        ${chalk.hex(theme.muted)("Ladder enforced. Every abstraction must be justified. Default.")}`,
    `  ${chalk.hex(theme.green)("/crisp lite")}        ${chalk.hex(theme.muted)("Build what's asked, name the lazier alternative. User picks.")}`,
    `  ${chalk.hex(theme.green)("/crisp ultra")}       ${chalk.hex(theme.muted)("YAGNI extremist. Deletion before addition. Challenges requirements.")}`,
    `  ${chalk.hex(theme.green)("/crisp off")}         ${chalk.hex(theme.muted)("Disable crisp mode.")}`,
    "",
    chalk.hex(theme.amber).bold("Skills (one-shot)"),
    `  ${chalk.hex(theme.green)("/crisp-review")}   ${chalk.hex(theme.muted)("Over-engineering review: L42: yagni: factory, one product. Inline.")}`,
    `  ${chalk.hex(theme.green)("/crisp-audit")}    ${chalk.hex(theme.muted)("Whole-repo over-engineering audit: ranked list of what to delete.")}`,
    `  ${chalk.hex(theme.green)("/crisp-debt")}     ${chalk.hex(theme.muted)("Harvest [crisp:N] tags and crisp: shortcut comments.")}`,
    `  ${chalk.hex(theme.green)("/crisp-gain")}     ${chalk.hex(theme.muted)("Measured-impact scoreboard: less code, less cost, more speed.")}`,
    `  ${chalk.hex(theme.green)("/crisp-help")}     ${chalk.hex(theme.muted)("This card.")}`,
    "",
    chalk.hex(theme.amber).bold("The ladder"),
    "  1. YAGNI — don't build what you don't need",
    "  2. Reuse what exists — stdlib > library > new code",
    "  3. Standard library first — built-in APIs > third-party",
    "  4. Native platform APIs — platform > framework > userland",
    "  5. Dependencies are debt — every dep is a liability",
    "  6. One line > many — single expression > temp var chain",
    "  7. Minimum code to satisfy the spec — delete everything else",
    "",
    chalk.hex(theme.amber).bold("Deactivate"),
    `  ${chalk.hex(theme.green)('"stop crisp"')}   ${chalk.hex(theme.muted)("or")}  ${chalk.hex(theme.green)("normal mode")}  ${chalk.hex(theme.muted)("revert to normal. Resume anytime with /crisp.")}`,
    "",
    chalk.hex(theme.amber).bold("Configure default"),
    chalk.hex(theme.muted)("Environment variable (highest priority):"),
    `  ${chalk.hex(theme.greenDim)("export CRISP_DEFAULT_MODE=ultra")}`,
    chalk.hex(theme.muted)("Config file (~/.config/supercode/crisp.json):"),
    `  ${chalk.hex(theme.greenDim)('{"defaultMode": "lite"}')}`,
    "",
    chalk.hex(theme.greenDim)(`Current mode: ${chalk.hex(theme.amber)(current)}`),
  ].join("\n")

  console.log(frame(content, { title: "crisp-help", borderColor: theme.amber, padding: 0 }))
  return { type: "help" }
}
