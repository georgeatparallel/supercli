import prisma from "./prisma"

/** Ordered tier levels for comparison: higher index = more access */
const TIER_ORDER = ["spark", "spark-premium", "pro", "ultra"] as const
type Tier = (typeof TIER_ORDER)[number]

let modelCache: Array<{ slug: string; minTier: string }> | null = null

async function ensureCache(): Promise<Array<{ slug: string; minTier: string }>> {
  if (!modelCache) {
    modelCache = await prisma.model.findMany({
      where: { active: true },
      select: { slug: true, minTier: true },
    })
  }
  return modelCache
}

export function tierIndex(tier: string): number {
  const i = TIER_ORDER.indexOf(tier as Tier)
  return i === -1 ? -1 : i
}

/**
 * Checks whether a model slug is allowed for the user's plan tier.
 * Model gating is backed by the `Model` table's `minTier` field.
 */
export async function isModelAllowedForTier(
  modelSlug: string,
  userTier: string,
): Promise<boolean> {
  try {
    const models = await ensureCache()
    const model = models.find(
      (m) => m.slug === modelSlug || modelSlug.includes(m.slug),
    )
    if (!model) return false
    return tierIndex(userTier) >= tierIndex(model.minTier)
  } catch (error) {
    console.error("[model-access] Failed to load model cache:", error)
    return false
  }
}

export function getUpgradeSuggestion(userTier: string): string {
  if (tierIndex(userTier) < tierIndex("pro")) {
    return "To access premium models, run /upgrade"
  }
  if (tierIndex(userTier) < tierIndex("ultra")) {
    return "To access all models unrestricted, run /upgrade"
  }
  return ""
}

/** Invalidate cache when the Model table changes (e.g. after seeding) */
export function invalidateModelCache(): void {
  modelCache = null
}
