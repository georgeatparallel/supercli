import path from "path"
import type { NextConfig } from "next"

const API_SERVER = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3004"

const nextConfig: NextConfig = {
  transpilePackages: ["@super/db-terminal", "@super/auth-terminal"],
  turbopack: {
    root: path.resolve(__dirname, "../../.."),
  },
  async rewrites() {
    // Dev-only proxies: `next dev` ignores vercel.json, so route the
    // auth/billing API calls to the local CLI server. Production uses the
    // vercel.json rewrites against the Render server.
    return [
      { source: "/api/auth/:path*", destination: `${API_SERVER}/api/auth/:path*` },
      { source: "/api/billing/:path*", destination: `${API_SERVER}/api/billing/:path*` },
      { source: "/api/webhooks/:path*", destination: `${API_SERVER}/api/webhooks/:path*` },
    ]
  },
}

export default nextConfig;
