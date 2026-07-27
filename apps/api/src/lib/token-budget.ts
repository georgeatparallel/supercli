import prisma from "./prisma"

const DAILY_TOKEN_LIMIT = 128_000
const DAILY_QUERY_LIMIT = 20

export async function checkDailyTokenBudget(userId: string): Promise<{
  allowed: boolean
  used: number
  limit: number
  remaining: number
  queriesUsed: number
  queriesRemaining: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const events = await prisma.usageEvent.findMany({
    where: {
      createdAt: { gte: today, lt: tomorrow },
    },
    select: {
      inputTokens: true,
      outputTokens: true,
      cachedInputTokens: true,
    },
  })

  const totalTokens = events.reduce(
    (sum, e) => sum + e.inputTokens + e.outputTokens + (e.cachedInputTokens ?? 0),
    0
  )

  const queriesUsed = events.length
  const remaining = DAILY_TOKEN_LIMIT - totalTokens
  const queriesRemaining = DAILY_QUERY_LIMIT - queriesUsed

  return {
    allowed: remaining > 0 && queriesRemaining > 0,
    used: totalTokens,
    limit: DAILY_TOKEN_LIMIT,
    remaining: Math.max(0, remaining),
    queriesUsed,
    queriesRemaining: Math.max(0, queriesRemaining),
  }
}
