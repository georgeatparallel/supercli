export interface ModelPricing {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-3-flash-preview": { input: 1, output: 4, cacheRead: 0.25, cacheWrite: 1 },
  "gemini-3-pro-preview": { input: 1.25, output: 10, cacheRead: 0.315, cacheWrite: 1.25 },
  "minimax-m3": { input: 0.15, output: 0.85, cacheRead: 0.015, cacheWrite: 0.15 },
  "nvidia/minimax-m3": { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
}

export function lookupPricing(model: string): ModelPricing {
  return (
    MODEL_PRICING[model] ?? {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    }
  )
}

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number
): number {
  const p = lookupPricing(model)
  const regularInput = inputTokens - cachedInputTokens
  const cost =
    (regularInput * p.input + cachedInputTokens * p.cacheRead + outputTokens * p.output) / 1_000_000
  return Math.round(cost * 1_000_000) / 1_000_000
}
