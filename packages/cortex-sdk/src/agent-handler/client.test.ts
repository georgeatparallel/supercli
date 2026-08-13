import { describe, expect, test } from "bun:test"
import { ConnectionError, SdkError, ToolPackError } from "../core/errors"
import type { AgentHandlerClientOptions, McpClientLike } from "./types"
import { AgentHandlerClientImpl } from "./client"
import { listToolPacks, TOOL_PACK_PRESETS } from "./tool-packs"

function fakeMcpClient(tools: Record<string, unknown>): McpClientLike {
  return {
    tools: async () => tools as never,
    close: async () => {},
  }
}

function makeOptions(overrides: Partial<AgentHandlerClientOptions> = {}): AgentHandlerClientOptions {
  const created: Array<{ config: { transport: { type: string; url: string } } }> = []
  const options: AgentHandlerClientOptions = {
    apiKey: "sk-test",
    registeredUserId: "user-42",
    createMcpClient: (config) => {
      created.push(config as never)
      return Promise.resolve(fakeMcpClient({}))
    },
    fetch: async () => new Response(JSON.stringify(TOOL_PACK_PRESETS), { status: 200 }),
    ...overrides,
  }
  return options
}

describe("AgentHandlerClientImpl", () => {
  test("connect() requires at least one selected pack", async () => {
    const handler = new AgentHandlerClientImpl(makeOptions({ toolPacks: [] }))
    await expect(handler.connect()).rejects.toBeInstanceOf(SdkError)
    expect(handler.isConnected).toBe(false)
  })

  test("connect() throws MISSING_REGISTERED_USER_ID without registeredUserId", async () => {
    const handler = new AgentHandlerClientImpl(
      makeOptions({ toolPacks: ["web-search"], registeredUserId: undefined }),
    )
    await expect(handler.connect()).rejects.toThrow(/registeredUserId/)
  })

  test("connect() and getTools() merge tools from selected packs", async () => {
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        toolPacks: ["web-search"],
        createMcpClient: () =>
          Promise.resolve(fakeMcpClient({ firecrawl_search: { type: "function" } })),
      }),
    )
    await handler.connect()
    expect(handler.isConnected).toBe(true)
    const tools = await handler.getTools()
    expect(Object.keys(tools)).toEqual(["firecrawl_search"])
  })

  test("disconnect() closes clients and clears connection", async () => {
    let closed = 0
    const trackingClient: McpClientLike = {
      tools: async () => ({}),
      close: async () => {
        closed++
      },
    }
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        toolPacks: ["web-search"],
        createMcpClient: () => Promise.resolve(trackingClient),
      }),
    )
    await handler.connect()
    expect(handler.isConnected).toBe(true)
    await handler.disconnect()
    expect(closed).toBe(1)
    expect(handler.isConnected).toBe(false)
  })

  test("getTools() auto-connects when disconnected", async () => {
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        toolPacks: ["web-search"],
        createMcpClient: () =>
          Promise.resolve(fakeMcpClient({ exa_search: { type: "function" } })),
      }),
    )
    const tools = await handler.getTools()
    expect(Object.keys(tools)).toEqual(["exa_search"])
  })

  test("getTools() wraps pack tool failure in ToolPackError", async () => {
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        toolPacks: ["web-search"],
        createMcpClient: () =>
          Promise.resolve({
            tools: async () => {
              throw new Error("mcp down")
            },
            close: async () => {},
          }),
      }),
    )
    await expect(handler.getTools()).rejects.toBeInstanceOf(ToolPackError)
  })

  test("selectPacks() validates ids against known packs", async () => {
    const handler = new AgentHandlerClientImpl(makeOptions())
    await expect(handler.selectPacks(["nope"])).rejects.toBeInstanceOf(ToolPackError)
  })

  test("selectPacks() returns matching pack info", async () => {
    const handler = new AgentHandlerClientImpl(makeOptions())
    await handler.selectPacks(["web-search"])
    expect(handler.selectedPacks).toEqual(["web-search"])
    const selected = await handler.selectPacks(["web-search", "exa-search"])
    expect(selected.map((p) => p.id)).toEqual(["web-search", "exa-search"])
    expect(selected[0]?.name).toBeDefined()
  })

  test("selectPacks() reconnects when already connected", async () => {
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        toolPacks: ["web-search"],
        createMcpClient: () => Promise.resolve(fakeMcpClient({})),
      }),
    )
    await handler.connect()
    expect(handler.isConnected).toBe(true)
    await handler.selectPacks(["web-search", "exa-search"])
    expect(handler.isConnected).toBe(true)
    expect(handler.selectedPacks).toEqual(["web-search", "exa-search"])
  })

  test("selectPacks() falls back to presets when discovery API fails", async () => {
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        createMcpClient: () => Promise.resolve(fakeMcpClient({})),
        fetch: async () => {
          throw new TypeError("network down")
        },
      }),
    )
    const selected = await handler.selectPacks(["web-search"])
    expect(selected.map((p) => p.id)).toEqual(["web-search"])
    expect(handler.selectedPacks).toEqual(["web-search"])
  })

  test("listToolPacks() caches discovery results", async () => {
    let fetchCount = 0
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        fetch: async () => {
          fetchCount++
          return new Response(JSON.stringify(TOOL_PACK_PRESETS), { status: 200 })
        },
      }),
    )
    const first = await handler.listToolPacks()
    const second = await handler.listToolPacks()
    expect(first.length).toBeGreaterThan(0)
    expect(second).toEqual(first)
    expect(fetchCount).toBe(1)
  })

  test("clearToolPackCache() forces re-discovery", async () => {
    let fetchCount = 0
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        fetch: async () => {
          fetchCount++
          return new Response(JSON.stringify(TOOL_PACK_PRESETS), { status: 200 })
        },
      }),
    )
    await handler.listToolPacks()
    handler.clearToolPackCache()
    await handler.listToolPacks()
    expect(fetchCount).toBe(2)
  })

  test("selectPacks() throws for unknown id even when API fails", async () => {
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        fetch: async () => {
          throw new TypeError("network down")
        },
      }),
    )
    await expect(handler.selectPacks(["nope"])).rejects.toBeInstanceOf(ToolPackError)
  })

  test("listToolPacks() returns discovered packs", async () => {
    const handler = new AgentHandlerClientImpl(makeOptions())
    const packs = await handler.listToolPacks()
    expect(packs.length).toBeGreaterThan(0)
  })
})

describe("createClient auth failure", () => {
  test("maps 401 message to ConnectionError with AUTH_ERROR code", async () => {
    const handler = new AgentHandlerClientImpl(
      makeOptions({
        toolPacks: ["web-search"],
        createMcpClient: () => Promise.reject(new Error("401 Unauthorized")),
      }),
    )
    await expect(handler.connect()).rejects.toMatchObject({ code: "AUTH_ERROR" })
    await expect(handler.connect()).rejects.toBeInstanceOf(ConnectionError)
  })
})

describe("listToolPacks integration", () => {
  test("uses provided fetch and returns presets", async () => {
    const packs = await listToolPacks({
      fetch: async () => new Response(JSON.stringify(TOOL_PACK_PRESETS), { status: 200 }),
    })
    expect(packs.length).toBeGreaterThan(0)
  })
})
