import { describe, expect, test } from "bun:test"
import { ConnectionError, SdkError } from "../core/errors"
import type { McpClientLike } from "../agent-handler/types"
import type { WebSearchClient, WebSearchConfig } from "./types"
import { createExaSearch } from "./exa"
import { createFirecrawlSearch } from "./firecrawl"

function fakeMcpClient(tools: Record<string, unknown>): McpClientLike {
  return {
    tools: async () => tools as never,
    close: async () => {},
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status })
}

type Options = Omit<WebSearchConfig, "provider">

describe("createExaSearch", () => {
  test("provider and listProviders are correct", () => {
    const client = createExaSearch({ apiKey: "k" })
    expect(client.provider).toBe("exa")
    expect(client.listProviders()).toEqual(["exa"])
  })

  test("connect() opens MCP and getTools() returns tools", async () => {
    const seen: unknown[] = []
    const client = createExaSearch({
      apiKey: "k",
      createMcpClient: (config) => {
        seen.push(config)
        return Promise.resolve(fakeMcpClient({ exa_search: { type: "function" } }))
      },
    })
    await client.connect()
    expect(client.isConnected).toBe(true)
    const tools = await client.getTools()
    expect(Object.keys(tools)).toEqual(["exa_search"])
    expect(seen[0]).toMatchObject({
      transport: { type: "http", url: "https://mcp.exa.ai/mcp", headers: { "x-api-key": "k" } },
    })
  })

  test("connect() is idempotent", async () => {
    let count = 0
    const client = createExaSearch({
      apiKey: "k",
      createMcpClient: () => {
        count++
        return Promise.resolve(fakeMcpClient({}))
      },
    })
    await client.connect()
    await client.connect()
    expect(count).toBe(1)
  })

  test("connect() throws when apiKey missing", async () => {
    const client = createExaSearch({})
    await expect(client.connect()).rejects.toMatchObject({ code: "NOT_CONFIGURED" })
  })

  test("connect() maps MCP failures to ConnectionError", async () => {
    const client = createExaSearch({
      apiKey: "k",
      createMcpClient: async () => {
        throw new Error("boom")
      },
    })
    await expect(client.connect()).rejects.toBeInstanceOf(ConnectionError)
  })

  test("search() maps REST results to SearchResult", async () => {
    let requested = ""
    const client = createExaSearch({
      apiKey: "k",
      fetch: (async (url, init) => {
        requested = String(url)
        expect(JSON.parse(String(init?.body))).toEqual({ query: "bun", numResults: 3 })
        return jsonResponse({
          results: [
            { title: "Bun", url: "https://bun.sh", publishedDate: "2024-01-01", text: "fast" },
          ],
        })
      }) as Options["fetch"],
    })
    const results = await client.search("bun", 3)
    expect(requested).toBe("https://api.exa.ai/search")
    expect(results[0]).toEqual({
      title: "Bun",
      url: "https://bun.sh",
      snippet: "fast",
      publishedDate: "2024-01-01",
    })
  })

  test("search() throws SdkError on non-ok response", async () => {
    const client = createExaSearch({
      apiKey: "k",
      fetch: (async () => new Response("boom", { status: 500 })) as Options["fetch"],
    })
    await expect(client.search("bun")).rejects.toBeInstanceOf(SdkError)
  })

  test("scrape() fetches page contents", async () => {
    let requested = ""
    const client = createExaSearch({
      apiKey: "k",
      fetch: (async (url, init) => {
        requested = String(url)
        expect(JSON.parse(String(init?.body))).toEqual({ urls: ["https://bun.sh"] })
        return jsonResponse({
          results: [{ url: "https://bun.sh", text: "# Bun docs", title: "Bun" }],
        })
      }) as Options["fetch"],
    })
    const markdown = await client.scrape("https://bun.sh")
    expect(requested).toBe("https://api.exa.ai/contents")
    expect(markdown).toBe("# Bun docs")
  })

  test("disconnect() closes MCP client", async () => {
    let closed = 0
    const client = createExaSearch({
      apiKey: "k",
      createMcpClient: () =>
        Promise.resolve({
          tools: async () => ({}),
          close: async () => {
            closed++
          },
        }),
    })
    await client.connect()
    await client.disconnect()
    expect(closed).toBe(1)
    expect(client.isConnected).toBe(false)
  })
})

describe("createFirecrawlSearch", () => {
  test("provider and listProviders are correct", () => {
    const client = createFirecrawlSearch({ apiKey: "k" })
    expect(client.provider).toBe("firecrawl")
    expect(client.listProviders()).toEqual(["firecrawl"])
  })

  test("connect() uses Bearer auth against v2 MCP", async () => {
    const seen: unknown[] = []
    const client = createFirecrawlSearch({
      apiKey: "k",
      createMcpClient: (config) => {
        seen.push(config)
        return Promise.resolve(fakeMcpClient({}))
      },
    })
    await client.connect()
    expect(seen[0]).toMatchObject({
      transport: {
        type: "http",
        url: "https://mcp.firecrawl.dev/v2/mcp",
        headers: { Authorization: "Bearer k" },
      },
    })
  })

  test("connect() throws when apiKey missing", async () => {
    const client = createFirecrawlSearch({})
    await expect(client.connect()).rejects.toMatchObject({ code: "NOT_CONFIGURED" })
  })

  test("search() maps data to SearchResult", async () => {
    const client = createFirecrawlSearch({
      apiKey: "k",
      fetch: (async (url, init) => {
        expect(String(url)).toBe("https://api.firecrawl.dev/v1/search")
        expect(JSON.parse(String(init?.body))).toEqual({ query: "bun", limit: 2 })
        return jsonResponse({
          data: [{ title: "Bun", url: "https://bun.sh", description: "fast JS" }],
        })
      }) as Options["fetch"],
    })
    const results = await client.search("bun", 2)
    expect(results[0]).toEqual({
      title: "Bun",
      url: "https://bun.sh",
      snippet: "fast JS",
    })
  })

  test("search() throws SdkError on non-ok response", async () => {
    const client = createFirecrawlSearch({
      apiKey: "k",
      fetch: (async () => new Response("boom", { status: 400 })) as Options["fetch"],
    })
    await expect(client.search("bun")).rejects.toBeInstanceOf(SdkError)
  })

  test("scrape() returns markdown", async () => {
    const client = createFirecrawlSearch({
      apiKey: "k",
      fetch: (async (url, init) => {
        expect(String(url)).toBe("https://api.firecrawl.dev/v1/scrape")
        expect(JSON.parse(String(init?.body))).toEqual({
          url: "https://bun.sh",
          formats: ["markdown"],
        })
        return jsonResponse({ data: { markdown: "# Bun" } })
      }) as Options["fetch"],
    })
    const markdown = await client.scrape("https://bun.sh")
    expect(markdown).toBe("# Bun")
  })
})

describe("createWebSearch dispatcher", () => {
  test("dispatches to the right provider", async () => {
    const { createWebSearch } = await import("./index")
    const exa = createWebSearch({ provider: "exa", apiKey: "k" })
    expect(exa.provider).toBe("exa")
    const firecrawl = createWebSearch({ provider: "firecrawl", apiKey: "k" })
    expect(firecrawl.provider).toBe("firecrawl")
    const contextdev = createWebSearch({ provider: "contextdev", apiKey: "k" })
    expect(contextdev.provider).toBe("contextdev")
  })

  test("unknown provider throws SdkError", async () => {
    const { createWebSearch } = await import("./index")
    expect(() =>
      createWebSearch({ provider: "unknown" as never }),
    ).toThrow(SdkError)
  })
})
