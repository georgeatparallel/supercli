import prisma from "./prisma"

export async function recordUsage(opts: {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  costUsd: number
  durationMs: number
}) {
  try {
    await prisma.usageEvent.create({
      data: {
        provider: opts.provider,
        model: opts.model,
        inputTokens: opts.inputTokens,
        outputTokens: opts.outputTokens,
        cachedInputTokens: opts.cachedInputTokens ?? 0,
        costUsd: opts.costUsd,
        durationMs: opts.durationMs,
      },
    })
  } catch (e) {
    console.error("[track-usage] Failed to record usage event:", e)
  }
}
