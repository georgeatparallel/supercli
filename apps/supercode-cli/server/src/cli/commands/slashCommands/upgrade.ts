import chalk from "chalk"
import open from "open"
import prisma from "src/lib/prisma"
import { getStoredToken } from "src/lib/token"
import { theme, sectionHeader, heavyDivider } from "src/cli/utils/tui.ts"
import type { SlashCommandResult } from "./index.ts"

const STUDIO_URL =
  process.env.SUPERCODE_STUDIO_URL ??
  (process.env.CLIENT_URL
    ? `${process.env.CLIENT_URL.replace(/\/$/, "")}/studio`
    : "https://supercode-terminal.vercel.app/studio")

export async function upgradeCommand(): Promise<SlashCommandResult> {
  console.log()
  console.log(heavyDivider())
  console.log()
  console.log(sectionHeader("Upgrade Options", { accent: "green" }))
  console.log()

  const token = await getStoredToken()
  if (!token?.access_token) {
    console.log(` ${chalk.hex(theme.muted)("Not authenticated. Run /login first.")}`)
    console.log()
    console.log(heavyDivider())
    console.log()
    return { type: "message", message: "Log in first — run /login" }
  }

  const session = await prisma.session.findUnique({
    where: { token: token.access_token as string },
    include: { user: true },
  })
  if (!session || session.expiresAt < new Date()) {
    console.log(` ${chalk.hex(theme.muted)("Session expired. Please re-authenticate.")}`)
    console.log()
    console.log(heavyDivider())
    console.log()
    return { type: "message", message: "Session expired — run /login" }
  }

  // Detect current plan
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["active", "trialing"] },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  })

  const currentTier = subscription?.plan?.tier ?? "none"
  const isGrandfathered =
    (subscription?.metadata as Record<string, unknown> | null)?.grandfathered === true

  console.log(
    ` ${chalk.hex(theme.muted)("Current plan:")}  ${chalk.bold(
      currentTier === "none" ? "None" : subscription!.plan!.name,
    )}${isGrandfathered ? chalk.hex(theme.greenDim)(" (grandfathered)") : ""}`,
  )
  console.log()

  // Plan comparison
  console.log(` ${chalk.hex(theme.amber)("Plan comparison:")}`)
  console.log()
  console.log(`   ${chalk.hex(theme.greenGlow)("Spark")}${" ".repeat(12)}${chalk.hex(theme.muted)("10K req · 16K ctx · $5 credits · Open models")}`)
  console.log(`   ${chalk.hex(theme.greenGlow)("Spark Premium")}${" ".repeat(7)}${chalk.hex(theme.muted)("$1/mo · 15K req · 32K ctx · $10 credits")}`)
  console.log(`   ${chalk.hex(theme.amber)("Pro")}${" ".repeat(15)}${chalk.hex(theme.muted)("25K req · 128K ctx · +Premium models")}`)
  console.log(`   ${chalk.hex(theme.amber)("Ultra")}${" ".repeat(13)}${chalk.hex(theme.muted)("110K req · 1M ctx · All models")}`)
  console.log()

  // Upgrade path based on current tier
  if (currentTier === "spark" && isGrandfathered) {
    console.log(` ${chalk.hex(theme.greenGlow)("→")} ${chalk.hex(theme.greenDim)("Upgrade to Spark Premium for $1/month — 15K requests, 32K context, $10 credits.")}`)
    console.log(` ${chalk.hex(theme.amber)("✦")} ${chalk.hex(theme.amber)("Or upgrade to Pro ($9-12/mo) for premium models and higher limits.")}`)
  } else if (currentTier === "spark-premium") {
    console.log(` ${chalk.hex(theme.amber)("✦")} ${chalk.hex(theme.amber)("Upgrade to Pro ($9-12/mo) for premium models, 128K context, and 25K requests.")}`)
  } else if (currentTier === "pro") {
    console.log(` ${chalk.hex(theme.amber)("✦")} ${chalk.hex(theme.amber)("Upgrade to Ultra ($100/mo) for all models, 1M context, and 110K requests.")}`)
  } else if (currentTier === "none") {
    console.log(` ${chalk.hex(theme.greenGlow)("✦")} ${chalk.hex(theme.greenGlow)("Subscribe to Spark Premium ($1/mo) to get started with 15K requests and 32K context.")}`)
  } else {
    // Spark free (non-grandfathered) — show all upgrade paths
    console.log(` ${chalk.hex(theme.greenGlow)("→")} ${chalk.hex(theme.greenGlow)("Spark Premium")}  ${chalk.hex(theme.muted)("$1/mo — 15K req · 32K ctx · $10 credits")}`)
    console.log(` ${chalk.hex(theme.amber)("→")} ${chalk.hex(theme.amber)("Pro")}  ${chalk.hex(theme.muted)("$9-12/mo — 25K req · 128K ctx · Premium models")}`)
    console.log(` ${chalk.hex(theme.amber)("→")} ${chalk.hex(theme.amber)("Ultra")}  ${chalk.hex(theme.muted)("$100/mo — 110K req · 1M ctx · All models")}`)
  }

  console.log()
  console.log(` ${chalk.hex(theme.muted)("Opening billing studio in your browser...")}`)
  console.log()

  try {
    await open(STUDIO_URL)
  } catch {
    console.log(` ${chalk.hex(theme.muted)(`→ Visit ${STUDIO_URL} to manage your plan`)}`)
  }

  console.log(heavyDivider())
  console.log()

  return { type: "message", message: "Check the billing studio in your browser" }
}
