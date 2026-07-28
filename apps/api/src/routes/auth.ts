import { Hono } from "hono"
import { authenticate } from "../middleware/auth"
import type { AppEnv } from "../types"

export const authRoute = new Hono<AppEnv>()
  .get("/auth/me", authenticate, async (c) => {
    const user = c.get("user")
    return c.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    })
  })
  .post("/auth/sign-out", authenticate, async (c) => {
    const session = c.get("session")
    const { auth } = await import("../lib/auth")
    await auth.api.signOut({ headers: new Headers({ Authorization: `Bearer ${session.token}` }) })
    return c.json({ success: true })
  })
