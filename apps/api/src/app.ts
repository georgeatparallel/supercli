import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { bodyLimit } from "hono/body-limit"
import { healthRoute } from "./routes/health"
import { authRoute } from "./routes/auth"
import { aiRoute } from "./routes/ai"
import type { AppEnv } from "./types"

export function createApp() {
  const app = new Hono<AppEnv>().basePath("/api")

  app.use("*", logger())
  app.use("*", cors())
  app.use("*", bodyLimit({
    maxSize: 10 * 1024 * 1024,
  }))

  app.onError((err, c) => {
    console.error("[API Error]", err)
    return c.json({ error: "Internal server error" }, 500)
  })

  app.route("/", healthRoute)
  app.route("/", authRoute)
  app.route("/", aiRoute)

  return app
}
