import { describe, expect, test } from "bun:test"

import { configureParallelMcp, PARALLEL_MCP_PRESET } from "./mcp"

function harness(config: Record<string, unknown>) {
  const saved: Record<string, unknown>[] = []
  const reconnected: Array<{ name: string; config: unknown }> = []

  return {
    saved,
    reconnected,
    dependencies: {
      getConfig: async () => config as never,
      saveConfig: async (next: unknown) => { saved.push(next as Record<string, unknown>) },
      reconnect: async (name: string, server: unknown) => { reconnected.push({ name, config: server }) },
    },
  }
}

describe("Parallel MCP preset", () => {
  test("uses the canonical Parallel MCP endpoint", () => {
    expect(PARALLEL_MCP_PRESET).toEqual({
      name: "parallel",
      config: { url: "https://search.parallel.ai/mcp" },
    })
  })

  test("preserves an existing Composio session when configuring Parallel", async () => {
    const state = harness({ composioSessionId: "session-123", mcpServers: { custom: { command: "custom" } } })

    expect(await configureParallelMcp(state.dependencies as never)).toBe("configured")
    expect(state.saved).toEqual([{
      composioSessionId: "session-123",
      mcpServers: {
        custom: { command: "custom" },
        parallel: { url: "https://search.parallel.ai/mcp" },
      },
    }])
    expect(state.reconnected).toEqual([{
      name: "parallel",
      config: { url: "https://search.parallel.ai/mcp" },
    }])
  })

  test("does not create Composio state when it is absent", async () => {
    const state = harness({ theme: "dark", mcpServers: {} })

    expect(await configureParallelMcp(state.dependencies as never)).toBe("configured")
    expect(state.saved).toEqual([{
      theme: "dark",
      mcpServers: { parallel: { url: "https://search.parallel.ai/mcp" } },
    }])
    expect(state.saved[0]).not.toHaveProperty("composioSessionId")
  })

  test("leaves a custom existing parallel server completely unchanged", async () => {
    const customParallel = {
      url: "https://private.example.test/mcp",
      headers: { Authorization: "Bearer user-token", "X-Custom": "keep-me" },
      credentials: { profile: "work" },
      settings: { timeout: 42 },
    }
    const original = { theme: "dark", mcpServers: { parallel: customParallel } }
    const state = harness(original)

    expect(await configureParallelMcp(state.dependencies as never)).toBe("already-configured")
    expect(original.mcpServers.parallel).toBe(customParallel)
    expect(original).toEqual({ theme: "dark", mcpServers: { parallel: customParallel } })
    expect(state.saved).toEqual([])
    expect(state.reconnected).toEqual([])
  })
})
