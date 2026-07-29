import chalk from "chalk"
import { execSync } from "node:child_process"
import { theme, frame } from "src/cli/utils/tui.ts"
import type { SlashCommandResult } from "./index.ts"

export async function crispDebtCommand(argsStr: string): Promise<SlashCommandResult> {
  let tagCounts: Record<string, number> = {}
  let rawMatches = ""
  let crispCommentMatches = ""
  try {
    rawMatches = execSync("rg -n '\\[crisp:\\d+\\]' --type ts --type tsx --type js --type jsx -g '!node_modules' -g '!dist'", { encoding: "utf-8" })
    const matches = rawMatches.split("\n").filter(Boolean)
    for (const m of matches) {
      const tag = m.match(/\[crisp:(\d+)\]/)
      if (tag) {
        const rung = tag[1]!
        tagCounts[rung] = (tagCounts[rung] ?? 0) + 1
      }
    }
  } catch {
    rawMatches = ""
  }
  try {
    crispCommentMatches = execSync("rg -n '(//|#|--)\\s*crisp:' --type ts --type tsx --type js --type jsx -g '!node_modules' -g '!dist'", { encoding: "utf-8" })
  } catch {
    crispCommentMatches = ""
  }

  const totalTags = Object.values(tagCounts).reduce((a, b) => a + b, 0)

  const rungLabels: Record<string, string> = {
    "1": "YAGNI",
    "2": "Reuse what exists",
    "3": "Standard library first",
    "4": "Native platform APIs",
    "5": "Dependencies are debt",
    "6": "One line > many",
    "7": "Minimum code to satisfy the spec",
  }

  const summaryLines = Object.entries(rungLabels)
    .map(([rung, label]) => {
      const count = tagCounts[rung] ?? 0
      const color = count > 0 ? theme.green : theme.muted
      return `  ${chalk.hex(color)(`[crisp:${rung}]`)} ${chalk.hex(color)(label.padEnd(28))} ${count > 0 ? chalk.hex(theme.amber)(`${count} tags`) : chalk.hex(theme.muted)("—")}`
    })
    .join("\n")

  const detailLines = rawMatches
    .split("\n")
    .filter(Boolean)
    .slice(0, 40)
    .map((line) => {
      const idx = line.indexOf(":")
      if (idx > 0) {
        const file = line.slice(0, idx)
        const rest = line.slice(idx + 1)
        return `  ${chalk.hex(theme.greenDim)(file)}:${chalk.hex(theme.muted)(rest.slice(0, 80))}`
      }
      return `  ${chalk.hex(theme.muted)(line.slice(0, 80))}`
    })
    .join("\n")

  const crispComments = crispCommentMatches
    .split("\n")
    .filter(Boolean)
    .slice(0, 20)

  const commentLines = crispComments.map((line) => {
    const idx = line.indexOf(":")
    if (idx > 0) {
      const file = line.slice(0, idx)
      const rest = line.slice(idx + 1)
      const hasUpgrade = /\b(upgrade|when|if|once|until|trigger|todo)\b/i.test(rest)
      const triggerTag = hasUpgrade ? "" : chalk.hex(theme.red)(" no-trigger")
      return `  ${chalk.hex(theme.greenDim)(file)}:${chalk.hex(theme.muted)(rest.slice(0, 80))}${triggerTag}`
    }
    return `  ${chalk.hex(theme.muted)(line.slice(0, 80))}`
  }).join("\n")

  const noTriggerCount = crispComments.filter((l) => !/\b(upgrade|when|if|once|until|trigger|todo)\b/i.test(l)).length

  const sections: string[] = [
    chalk.hex(theme.amber).bold("Crisp Debt Ledger"),
    "",
    `${chalk.hex(theme.muted)(`[crisp:N] tag ledger: ${totalTags} markers`)}`,
    "",
    ...(totalTags > 0
      ? [summaryLines, "", detailLines]
      : [`${chalk.hex(theme.greenDim)("No [crisp:N] tags found. Clean — or crisp hasn't been applied yet.")}`]),
  ]

  if (crispComments.length > 0) {
    sections.push(
      "",
      chalk.hex(theme.amber).bold(`Deliberate shortcuts (crisp: comments)`),
      "",
      commentLines,
      "",
      `${chalk.hex(theme.muted)(`${crispComments.length} shortcuts, ${noTriggerCount} with no upgrade trigger`)}`,
    )
  }

  console.log(frame(sections.join("\n"), { title: "crisp-debt", borderColor: theme.amber, padding: 0 }))
  return { type: "help" }
}
