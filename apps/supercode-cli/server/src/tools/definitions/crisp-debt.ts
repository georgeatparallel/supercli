import { z } from "zod"

const debtSchema = z.object({
  path: z
    .string()
    .optional()
    .describe("Path to search for crisp: comments. Defaults to workspace root."),
})

export type CrispDebtArgs = z.infer<typeof debtSchema>

export const crispDebtTool = {
  description:
    "Find and report all [crisp:N] tagged comments in the workspace. " +
    "These are markers left by previous crisp reviews indicating code that should be simplified. " +
    "Returns each tag with its file location and surrounding context.",
  parameters: debtSchema,
  execute: async (args: CrispDebtArgs) => {
    return JSON.stringify({
      success: true,
      hint: "Use run_command to grep for [crisp: across the workspace. Group results by rung number and file path. Report totals per rung.",
      path: args.path ?? "(workspace root)",
    })
  },
}
