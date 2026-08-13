import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    "cli/index": "cli/src/index.ts",
  },
  format: ["esm"],
  dts: false,
  clean: false,
  sourcemap: false,
  treeshake: true,
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env bun",
  },
  external: [
    "@opentui/core",
    "ai",
    "@ai-sdk/openai-compatible",
    "@ai-sdk/google",
    "@ai-sdk/mcp",
    "@ai-sdk/provider",
    "vercel-minimax-ai-provider",
    "context.dev",
    "zod",
    "@composio/core",
    "@modelcontextprotocol/sdk",
  ],
})
