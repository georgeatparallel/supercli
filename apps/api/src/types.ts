import type { Hono } from "hono"

type Bindings = {}
type Variables = {
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  session: {
    id: string
    token: string
    expiresAt: Date
    userId: string
  }
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}

export type App = Hono<AppEnv>
