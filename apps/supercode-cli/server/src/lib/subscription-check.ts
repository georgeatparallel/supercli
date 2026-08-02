import prisma from "./prisma"

export interface PlanInfo {
  tier: "spark" | "spark-premium" | "pro" | "ultra"
  name: string
  requestLimit: number
  contextLimit: number
  modelAccess: "open" | "premium" | "all"
  creditAmountCents: number
  isGrandfathered: boolean
  currentPeriodEnd: Date | null
}

function isGrandfathered(sub: { metadata: unknown }): boolean {
  return (sub.metadata as Record<string, unknown> | null)?.grandfathered === true
}

/**
 * Reads the user's active subscription plan directly from the CLI server DB.
 * Grandfathered users always fall back to Spark (10K/16K) — never fully locked.
 * Returns null if the user has no active subscription (new user without a plan).
 */
export async function getSubscriptionPlan(userId: string): Promise<PlanInfo | null> {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "trialing"] },
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    })

    if (!subscription?.plan) return null

    const grandfathered = isGrandfathered(subscription)

    // Paid plans expire at period end; grandfathered Spark never expires
    if (
      !grandfathered &&
      subscription.plan.tier !== "spark" &&
      subscription.currentPeriodEnd &&
      new Date() > subscription.currentPeriodEnd
    ) {
      const fallback = await prisma.subscription.findFirst({
        where: {
          userId,
          plan: { tier: "spark" },
          status: "active",
        },
        include: { plan: true },
      })
      if (fallback?.plan) {
        return {
          tier: "spark",
          name: fallback.plan.name,
          requestLimit: fallback.plan.requestLimit,
          contextLimit: fallback.plan.contextLimit,
          modelAccess: "open",
          creditAmountCents: fallback.plan.creditAmountCents,
          isGrandfathered: true,
          currentPeriodEnd: fallback.currentPeriodEnd,
        }
      }
      return null
    }

    return {
      tier: subscription.plan.tier as PlanInfo["tier"],
      name: subscription.plan.name,
      requestLimit: subscription.plan.requestLimit,
      contextLimit: subscription.plan.contextLimit,
      modelAccess: subscription.plan.modelAccess as PlanInfo["modelAccess"],
      creditAmountCents: subscription.plan.creditAmountCents,
      isGrandfathered: grandfathered,
      currentPeriodEnd: subscription.currentPeriodEnd,
    }
  } catch (error) {
    console.error("[subscription-check] DB error:", error)
    return null
  }
}
