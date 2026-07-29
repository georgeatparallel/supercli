import chalk from "chalk"
import { execSync } from "node:child_process"
import { theme, frame } from "src/cli/utils/tui.ts"
import { getCrispModeSync } from "src/cli/crisp/index.ts"
import type { SlashCommandResult } from "./index.ts"

export async function crispAuditCommand(argsStr: string): Promise<SlashCommandResult> {
  const mode = getCrispModeSync()
  const focus = argsStr.trim() || "all"
  const modeLabel = mode === "off" ? "full" : mode

  let fileList = ""
  try {
    fileList = execSync(`fd -e ts -e tsx -e js -e jsx --exclude node_modules --exclude dist --exclude .git --max-depth 6 . ${process.cwd()}`, { encoding: "utf-8" })
  } catch {
    fileList = "(could not list files)"
  }

  const lines = fileList.split("\n").filter(Boolean)
  const sampleFiles = lines.slice(0, 30).join("\n")
  const totalFiles = lines.length

  const header =
    `Audit this workspace against the Crisp simplicity ladder (${modeLabel}). focus: ${focus}\n` +
    `Scan the whole tree. Rank findings biggest cut first.\n` +
    `One line per finding. Format: <tag> <what to cut>. <replacement>. [path]\n\n` +
    `Tags:\n` +
    `  delete:  dead code, unused flexibility, speculative feature. Replacement: nothing.\n` +
    `  stdlib:  hand-rolled thing the stdlib ships. Name the function.\n` +
    `  native:  dependency or code doing what the platform already does. Name the feature.\n` +
    `  yagni:   abstraction with one implementation, config nobody sets, layer with one caller.\n` +
    `  shrink:  same logic, fewer lines. Show the shorter form.\n\n` +
    `Prioritise: deps the stdlib or platform already ships, single-implementation interfaces, ` +
    `factories with one product, wrappers that only delegate, files exporting one thing, ` +
    `dead flags and config, hand-rolled stdlib.\n\n` +
    `End with: net: -<N> lines, -<M> deps possible.\n` +
    `If nothing to cut: "Lean already. Ship."\n\n` +
    `Found ${totalFiles} source files. Sample (${Math.min(totalFiles, 30)} of ${totalFiles}):\n` +
    sampleFiles

  console.log(
    frame(
      `${chalk.hex(theme.amber).bold("Supercode Crisp Audit")}  ${chalk.hex(theme.muted)(`mode: ${modeLabel} · focus: ${focus}`)}\n\n${chalk.hex(theme.greenDim)(`Scanning ${totalFiles} source files across the workspace...`)}`,
      { title: "crisp-audit", borderColor: theme.amber, padding: 0 },
    ),
  )

  return { type: "message", message: header }
}
