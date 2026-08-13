import { describe, expect, test } from "bun:test"
import { ConnectionError, SdkError, ToolPackError } from "../core/errors"
import type { FetchLike } from "../core/types"
import { authHeaders, listToolPacks, mergePresets, mcpUrl, TOOL_PACK_PRESETS } from "./tool-packs"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function jsonFetch(body: unknown, status = 200): FetchLike {
  return async () => jsonResponse(body, status)
}

describe("mcpUrl", () => {
  test("builds the MCP endpoint URL", () => {
    const url = mcpUrl({
      apiUrl: "https://ah-api.merge.dev",
      toolPackId: "web-search",
      registeredUserId: "user-42",
    })
    expect(url).toBe(
      "https://ah-api.merge.dev/api/v1/tool-packs/web-search/registered-users/user-42/mcp",
    )
  })
})

describe("authHeaders", () => {
  test("adds bearer token when apiKey provided", () => {
    expect(authHeaders("sk-test")).toEqual({ Authorization: "Bearer sk-test" })
  })

  test("returns empty headers without apiKey", () => {
    expect(authHeaders()).toEqual({})
  })
})

describe("mergePresets", () => {
  test("deduplicates discovered packs against presets by id", () => {
    const merged = mergePresets([
      { id: "web-search", name: "Web Search", tools: ["firecrawl_search"] },
    ])
    expect(merged.map((p) => p.id)).toEqual(["web-search", "exa-search"])
    expect(merged[0]?.tools).toEqual(["firecrawl_search"])
  })

  test("preserves discovered pack order", () => {
    const merged = mergePresets([
      { id: "custom", name: "Custom", tools: ["x"] },
      { id: "web-search", name: "Web Search", tools: [] },
    ])
    expect(merged.map((p) => p.id)).toEqual(["custom", "web-search", "exa-search"])
  })
})

describe("listToolPacks", () => {
  test("parses an array body and merges presets", async () => {
    const packs = await listToolPacks({
      apiKey: "sk-test",
      fetch: jsonFetch([{ id: "exa-search", name: "Exa Search", tools: ["exa_search"] }]),
    })
    expect(packs.map((p) => p.id)).toEqual(["exa-search", "web-search"])
    expect(packs[0]?.tools).toEqual(["exa_search"])
  })

  test("parses data/toolPacks/results/packs shapes", async () => {
    const packs = await listToolPacks({
      fetch: jsonFetch({ toolPacks: [{ id: "web-search", name: "Web Search", tools: [] }] }),
    })
    expect(packs.map((p) => p.id)).toContain("web-search")
  })

  test("sends bearer auth and Accept header", async () => {
    let captured: RequestInit | undefined
    const fetchImpl: FetchLike = async (_input, init) => {
      captured = init
      return jsonResponse([{ id: "p1", name: "P1", tools: ["t"] }])
    }
    await listToolPacks({ apiKey: "sk-test", fetch: fetchImpl })
    expect(captured?.method).toBe("GET")
    const headers = captured?.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer sk-test")
    expect(headers.Accept).toBe("application/json")
  })

  test("throws ToolPackError on non-OK response", async () => {
    await expect(
      listToolPacks({ fetch: jsonFetch({ error: "down" }, 500) }),
    ).rejects.toBeInstanceOf(ToolPackError)
  })

  test("throws ToolPackError when no packs returned", async () => {
    await expect(listToolPacks({ fetch: jsonFetch([]) })).rejects.toBeInstanceOf(ToolPackError)
  })

  test("throws ConnectionError on network failure", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError("fetch failed")
    }
    await expect(listToolPacks({ fetch: fetchImpl })).rejects.toBeInstanceOf(ConnectionError)
  })

  test("SdkError and ToolPackError are instanceof SdkError", async () => {
    expect(TOOL_PACK_PRESETS.length).toBeGreaterThan(0)
    const err = new SdkError("boom", { code: "SDK_ERROR" })
    expect(err).toBeInstanceOf(SdkError)
  })
})
