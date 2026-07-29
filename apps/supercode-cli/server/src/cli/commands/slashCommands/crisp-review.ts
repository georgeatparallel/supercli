import chalk from "chalk"
import { execSync } from "node:child_process"
import { theme, frame } from "src/cli/utils/tui.ts"
import { getCrispModeSync } from "src/cli/crisp/index.ts"
import type { SlashCommandResult } from "./index.ts"

export async function crispReviewCommand(argsStr: string): Promise<SlashCommandResult> {
  const mode = getCrispModeSync()

  let diff: string
  try {
    const staged = execSync("git diff --cached", { encoding: "utf-8" })
    const unstaged = execSync("git diff", { encoding: "utf-8" })
    diff = staged || unstaged
    if (!diff) {
      console.log(
        frame(
          `${chalk.hex(theme.amber).bold("No changes to review")}\n\n${chalk.hex(theme.muted)("There are no staged or unstaged diffs. Make some changes first, then run /crisp-review.")}`,
          { title: "crisp-review", borderColor: theme.amber, padding: 0 },
        ),
      )
      return { type: "help" }
    }
  } catch {
    console.log(
      frame(
        `${chalk.hex(theme.red).bold("Git error")}\n\n${chalk.hex(theme.muted)("Could not read git diff. Are you in a git repository?")}`,
        { title: "crisp-review", borderColor: theme.red, padding: 0 },
      ),
    )
    return { type: "help" }
  }

  const modeLabel = mode === "off" ? "full" : mode
  const header =
    `Review this diff against the Crisp simplicity ladder (${modeLabel}).\n` +
    `One line per finding. Format: L<line>: <tag> <what>. <replacement>.\n\n` +
    `Tags:\n` +
    `  delete:  dead code, unused flexibility, speculative feature. Replacement: nothing.\n` +
    `  stdlib:  hand-rolled thing the stdlib ships. Name the function.\n` +
    `  native:  dependency or code doing what the platform already does. Name the feature.\n` +
    `  yagni:   abstraction with one implementation, config nobody sets, layer with one caller.\n` +
    `  shrink:  same logic, fewer lines. Show the shorter form.\n\n` +
    `End with: net: -<N> lines possible.\n` +
    `If nothing to cut: "Lean already. Ship."\n\n` +
    `${diff}`

  console.log(
    frame(
      `${chalk.hex(theme.amber).bold("Supercode Crisp Review")}  ${chalk.hex(theme.muted)(`mode: ${modeLabel}`)}\n\n${chalk.hex(theme.greenDim)("Diff loaded. Evaluating against simplicity ladder...")}`,
      { title: "crisp-review", borderColor: theme.amber, padding: 0 },
    ),
  )

  return { type: "message", message: header }
}
