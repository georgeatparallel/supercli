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
 *
 * Tier ladder: spark < spark-premium < pro < ultra
 * Open models use minTier "spark" so both Spark and Spark Premium get them.
 * Spark Premium is the paid open-models tier (higher limits/credits, same catalog).
 */
export async function isModelAllowedForTier(
  modelSlug: string,
  userTier: string,
): Promise<boolean> {
  try {
    const models = await ensureCache()
    const normalized = modelSlug.trim().toLowerCase()
    const model = models.find((m) => {
      const slug = m.slug.toLowerCase()
      return (
        slug === normalized ||
        normalized === slug ||
        normalized.endsWith(`/${slug}`) ||
        normalized.includes(slug) ||
        slug.includes(normalized)
      )
    })
    if (!model) return false
    return tierIndex(userTier) >= tierIndex(model.minTier)
  } catch (error) {
    console.error("[model-access] Failed to load model cache:", error)
    return false
  }
}

export function getUpgradeSuggestion(userTier: string): string {
  if (tierIndex(userTier) < tierIndex("spark-premium")) {
    return "To access more open models and higher limits, run /upgrade (Spark Premium)"
  }
  if (tierIndex(userTier) < tierIndex("pro")) {
    return "To access premium models (Claude, GPT, etc.), run /upgrade"
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
