import { Router } from "express"
import prisma from "../../lib/prisma"

const router = Router()

router.get("/", async (req, res) => {
  try {
    const isGrandfathered = req.query.isGrandfathered === "true"

    const where: Record<string, unknown> = { active: true }

    // Grandfathered users see all plans including Spark (Free)
    // Non-grandfathered users see Spark Premium + Pro + Ultra (no free plan)
    if (!isGrandfathered) {
      where.tier = { not: "spark" }
    }

    // All regional variants (Indian + International) and null-variant plans
    // (Spark Premium, Ultra) are always returned — the studio shows every plan.

    const plans = await prisma.plan.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        tier: true,
        name: true,
        description: true,
        variant: true,
        interval: true,
        priceCents: true,
        currency: true,
        requestLimit: true,
        contextLimit: true,
        modelAccess: true,
        creditAmountCents: true,
        dodoProductId: true,
        sortOrder: true,
      },
    })

    res.json({ plans })
  } catch (error) {
    console.error("[billing/plans] Failed to fetch plans:", error)
    res.status(500).json({ error: "Failed to fetch plans" })
  }
})

export default router
