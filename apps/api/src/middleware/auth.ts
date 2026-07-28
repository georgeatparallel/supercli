import { createMiddleware } from "hono/factory"
import prisma from "../lib/prisma"
import type { AppEnv } from "../types"

export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const token = authHeader.slice(7)
  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    c.set("user", session.user)
    c.set("session", session)
    await next()
  } catch {
    return c.json({ error: "Unauthorized" }, 401)
  }
})
