import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "gateway/index": "src/gateway/index.ts",
    "agent-handler/index": "src/agent-handler/index.ts",
    "composio/index": "src/composio/index.ts",
    "web-search/index": "src/web-search/index.ts",
    "mcp/index": "src/mcp/index.ts",
    "voice/index": "src/voice/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  outDir: "dist",
  external: [
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
