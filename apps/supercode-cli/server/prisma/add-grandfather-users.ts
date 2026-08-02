// apps/supercode-cli/server/prisma/add-grandfather-users.ts
// Run: bun run prisma/add-grandfather-users.ts
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL_TERMINAL || process.env.DATABASE_URL,
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Grandfathering existing users into Spark (Grandfathered)...")

  const sparkPlan = await prisma.plan.findFirst({
    where: { tier: "spark", active: true },
  })

  if (!sparkPlan) {
    console.error("Spark (Grandfathered) plan not found. Run seed first.")
    process.exit(1)
  }

  const users = await prisma.user.findMany({
    where: {
      subscriptions: { none: {} },
    },
  })

  console.log(`Found ${users.length} users without subscriptions.`)

  let count = 0
  for (const user of users) {
    const dodoSubId = `grandfathered-${user.id}-${Date.now()}`

    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: sparkPlan.id,
        dodoSubscriptionId: dodoSubId,
        status: "active",
        metadata: { grandfathered: true },
      },
    })

    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await prisma.creditBalance.upsert({
      where: {
        userId_planId: { userId: user.id, planId: sparkPlan.id },
      },
      update: {
        balanceCents: 500,
        totalCredits: 500,
        resetAt: periodEnd,
      },
      create: {
        userId: user.id,
        planId: sparkPlan.id,
        balanceCents: 500,
        totalCredits: 500,
        resetAt: periodEnd,
      },
    })

    count++
  }

  console.log(`Grandfathered ${count} users into Spark (10K req, 16K ctx).`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
