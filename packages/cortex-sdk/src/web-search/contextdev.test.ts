import { describe, expect, test } from "bun:test"
import { SdkError } from "../core/errors"
import type { WebSearchConfig } from "./types"
import { createContextDevSearch } from "./contextdev"

type Options = Omit<WebSearchConfig, "provider">

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function makeContextDev(overrides: Partial<Options> = {}): ReturnType<typeof createContextDevSearch> {
  return createContextDevSearch({
    apiKey: "cd-key",
    fetch: (async () => jsonResponse({})) as Options["fetch"],
    ...overrides,
  })
}

describe("createContextDevSearch", () => {
  test("provider and listProviders are correct", () => {
    const client = makeContextDev()
    expect(client.provider).toBe("contextdev")
    expect(client.listProviders()).toEqual(["contextdev"])
  })

  test("isConnected is always true (REST, no session)", () => {
    const client = makeContextDev()
    expect(client.isConnected).toBe(true)
  })

  test("connect()/disconnect() are no-ops", async () => {
    const client = makeContextDev()
    await client.connect()
    expect(client.isConnected).toBe(true)
    await client.disconnect()
    expect(client.isConnected).toBe(true)
  })

  test("throws NOT_CONFIGURED when no apiKey", () => {
    expect(() => createContextDevSearch({})).toThrow(SdkError)
  })

  test("search() maps SDK results to SearchResult", async () => {
    const client = createContextDevSearch({
      apiKey: "cd-key",
      fetch: (async (url, init) => {
        expect(String(url)).toBe("https://api.context.dev/v1/web/search")
        const body = JSON.parse(String(init?.body)) as { query: string; numResults: number }
        expect(body).toEqual({ query: "bun", numResults: 2 })
        return jsonResponse({
          query: "bun",
          results: [
            { title: "Bun", url: "https://bun.sh", description: "fast JS", relevance: "high" },
          ],
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

  test("scrape() returns markdown from webScrapeMd", async () => {
    const client = createContextDevSearch({
      apiKey: "cd-key",
      fetch: (async (url) => {
        expect(String(url)).toBe(
          "https://api.context.dev/v1/web/scrape/markdown?url=https%3A%2F%2Fbun.sh",
        )
        return jsonResponse({ contentLength: 7, markdown: "# Bun" })
      }) as Options["fetch"],
    })
    const markdown = await client.scrape("https://bun.sh")
    expect(markdown).toBe("# Bun")
  })

  test("crawl() concatenates page markdown", async () => {
    const client = createContextDevSearch({
      apiKey: "cd-key",
      fetch: (async () =>
        jsonResponse({
          metadata: { numUrls: 2, numSucceeded: 2 },
          results: [
            { markdown: "Page A", metadata: {} },
            { markdown: "Page B", metadata: {} },
          ],
        })) as Options["fetch"],
    })
    const markdown = await client.crawl("https://bun.sh")
    expect(markdown).toBe("Page A\n\nPage B")
  })

  test("extract() returns structured data", async () => {
    const client = createContextDevSearch({
      apiKey: "cd-key",
      fetch: (async () =>
        jsonResponse({
          data: { title: "Bun" },
          metadata: { status: "success" },
        })) as Options["fetch"],
    })
    const data = await client.extract("https://bun.sh", {
      type: "object",
      properties: { title: { type: "string" } },
    })
    expect(data).toEqual({ title: "Bun" })
  })

  test("getBrand() maps brand fields", async () => {
    const client = createContextDevSearch({
      apiKey: "cd-key",
      fetch: (async () =>
        jsonResponse({
          brand: {
            domain: "bun.sh",
            description: "A fast JS runtime",
            logos: [{ url: "https://bun.sh/logo.png" }],
          },
        })) as Options["fetch"],
    })
    const brand = await client.getBrand("bun.sh")
    expect(brand).toEqual({
      domain: "bun.sh",
      name: "bun.sh",
      logo: "https://bun.sh/logo.png",
      description: "A fast JS runtime",
    })
  })

  test("createMonitor() posts page target", async () => {
    const client = createContextDevSearch({
      apiKey: "cd-key",
      fetch: (async (url, init) => {
        expect(String(url)).toBe("https://api.context.dev/v1/monitors")
        const body = JSON.parse(String(init?.body)) as { name: string; target: { type: string; url: string } }
        expect(body).toEqual({ name: "pricing", target: { type: "page", url: "https://acme.com/pricing" } })
        return jsonResponse({ id: "mon_1", created_at: "2024-01-01", change_detection: { type: "exact" } })
      }) as Options["fetch"],
    })
    const monitor = await client.createMonitor({
      name: "pricing",
      url: "https://acme.com/pricing",
    })
    expect(monitor).toMatchObject({ id: "mon_1" })
  })

  test("createMonitor() parses interval schedule", async () => {
    const client = createContextDevSearch({
      apiKey: "cd-key",
      fetch: (async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { schedule: { type: string; frequency: number; unit: string } }
        expect(body.schedule).toEqual({ type: "interval", frequency: 6, unit: "hours" })
        return jsonResponse({ id: "mon_1" })
      }) as Options["fetch"],
    })
    await client.createMonitor({
      name: "pricing",
      url: "https://acme.com/pricing",
      schedule: "6h",
    })
  })

  test("createMonitor() throws on invalid schedule", async () => {
    const client = makeContextDev()
    await expect(
      client.createMonitor({ name: "p", url: "https://a.com", schedule: "fortnightly" }),
    ).rejects.toBeInstanceOf(SdkError)
  })

  test("listMonitors() returns data array", async () => {
    const client = createContextDevSearch({
      apiKey: "cd-key",
      fetch: (async () =>
        jsonResponse({
          data: [{ id: "mon_1", name: "pricing" }],
          has_more: false,
        })) as Options["fetch"],
    })
    const monitors = await client.listMonitors()
    expect(monitors).toHaveLength(1)
    expect(monitors[0]).toMatchObject({ id: "mon_1" })
  })

  test("getTools() exposes all contextdev tools", async () => {
    const client = makeContextDev()
    const tools = await client.getTools()
    expect(Object.keys(tools).sort()).toEqual([
      "create_monitor",
      "get_brand",
      "web_crawl",
      "web_extract",
      "web_scrape",
      "web_search",
    ])
  })
})
