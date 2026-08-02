import { Router } from "express"
import prisma from "../../lib/prisma"
import { DodoPayments } from "dodopayments"

const router = Router()

function getDodo(): DodoPayments | null {
  const key = process.env.DODO_PAYMENTS_API_KEY
  if (!key) return null
  return new DodoPayments({ bearerToken: key })
}

function studioUrl(path: string): string {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000"
  return `${clientUrl.replace(/\/$/, "")}${path}`
}

router.post("/", async (req, res) => {
  try {
    const userId = req.body.userId as string | undefined
    const planId = req.body.planId as string | undefined
    const variant = req.body.variant as string | undefined

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    if (!planId) {
      res.status(400).json({ error: "planId is required" })
      return
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId, active: true },
    })

    if (!plan) {
      res.status(404).json({ error: "Plan not found" })
      return
    }

    // Don't allow checkout for the grandfathered Spark plan (free, no Dodo product)
    if (!plan.dodoProductId) {
      res.status(400).json({ error: "This plan cannot be purchased" })
      return
    }

    const dodo = getDodo()
    if (!dodo) {
      console.error("[billing/checkout] DODO_PAYMENTS_API_KEY not configured")
      res.status(503).json({ error: "Payments are not configured yet" })
      return
    }

    // Create or reuse a Dodo customer for this user
    let dodoCustomerId: string | null = null
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user?.dodoCustomerId) {
      dodoCustomerId = user.dodoCustomerId
    }

    const resolvedVariant = variant ?? plan.variant

    const customer: Record<string, unknown> = dodoCustomerId
      ? { customer_id: dodoCustomerId }
      : { email: user?.email ?? `${userId}@supercode.local`, name: user?.name ?? "Supercode User" }

    const checkoutSession = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: plan.dodoProductId, quantity: 1 }],
      customer: customer as never,
      metadata: {
        userId,
        planId: plan.id,
        tier: plan.tier,
        variant: resolvedVariant ?? "global",
      },
      return_url:
        process.env.DODO_RETURN_URL ?? studioUrl("/studio?success=true"),
      cancel_url:
        process.env.DODO_CANCEL_URL ?? studioUrl("/studio?cancelled=true"),
    })

    res.json({
      checkout_url: checkoutSession.checkout_url,
      session_id: checkoutSession.session_id,
    })
  } catch (error) {
    console.error("[billing/checkout] Checkout creation failed:", error)
    res.status(500).json({ error: "Failed to create checkout session" })
  }
})

export default router
