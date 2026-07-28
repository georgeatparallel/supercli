import { serve } from "bun"
import { createApp } from "./app"

const PORT = Number(process.env.PORT) || 4000

serve({
  fetch: createApp().fetch,
  port: PORT,
  development: {
    hmr: true,
  },
})

console.log(`[API] Server running on http://localhost:${PORT}`)
