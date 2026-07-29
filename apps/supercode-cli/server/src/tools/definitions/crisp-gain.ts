import { z } from "zod"

const gainSchema = z.object({
  scope: z
    .enum(["workspace", "file", "summary"])
    .optional()
    .default("summary")
    .describe("What scope to assess gain for."),
})

export type CrispGainArgs = z.infer<typeof gainSchema>

export const crispGainTool = {
  description:
    "Assess the impact of applying Supercode Crisp principles. " +
    "Measures complexity reduction, dependency savings, and code elimination opportunities. " +
    "Use this to report how much simpler the codebase could be.",
  parameters: gainSchema,
  execute: async (args: CrispGainArgs) => {
    return JSON.stringify({
      success: true,
      hint: "Assess crisp impact by running analysis on the workspace. Count total lines, dependencies, files, and estimate how much could be eliminated by applying each ladder rung.",
      scope: args.scope,
    })
  },
}
