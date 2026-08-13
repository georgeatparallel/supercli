import ContextDev from "context.dev"
import { tool, type Tool } from "ai"
import { z } from "zod"
import { SdkError } from "../core/errors"
import type { FetchLike } from "../core/types"
import type {
  BrandInfo,
  ContextDevWebSearchClient,
  MonitorConfig,
  SearchResult,
  WebSearchConfig,
  WebSearchProvider,
} from "./types"

export type ContextDevSearchOptions = Omit<WebSearchConfig, "provider">

export function createContextDevSearch(
  options: ContextDevSearchOptions = {},
): ContextDevWebSearchClient {
  return new ContextDevSearchClient(options)
}

class ContextDevSearchClient implements ContextDevWebSearchClient {
  readonly provider = "contextdev" as const

  private readonly client: ContextDev

  constructor(options: ContextDevSearchOptions) {
    const apiKey =
      options.apiKey ??
      process.env.CONTEXTDEV_API_KEY ??
      process.env.CONTEXT_DEV_API_KEY
    if (!apiKey) {
      throw new SdkError(
        "createContextDevSearch: CONTEXTDEV_API_KEY not configured",
        { code: "NOT_CONFIGURED" },
      )
    }
    const opts: ConstructorParameters<typeof ContextDev>[0] = { apiKey }
    if (options.baseURL) opts.baseURL = options.baseURL
    if (options.fetch) opts.fetch = options.fetch as FetchLike
    this.client = new ContextDev(opts)
  }

  get isConnected(): boolean {
    return true
  }

  listProviders(): WebSearchProvider[] {
    return ["contextdev"]
  }

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const res = await this.client.web.search({ query, numResults: limit })
    return res.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }))
  }

  async scrape(url: string): Promise<string> {
    const res = await this.client.web.webScrapeMd({ url })
    return res.markdown
  }

  async crawl(url: string): Promise<string> {
    const res = await this.client.web.webCrawlMd({ url })
    return res.results
      .map((r) => (r.markdown ?? "").trim())
      .filter(Boolean)
      .join("\n\n")
  }

  async extract(url: string, schema: Record<string, unknown>): Promise<unknown> {
    const res = await this.client.web.extract({ url, schema })
    return res.data
  }

  async getBrand(domain: string): Promise<BrandInfo> {
    const res = await this.client.brand.retrieve({ type: "by_domain", domain })
    const brand = res.brand
    return {
      domain: brand?.domain ?? domain,
      name: brand?.slogan ?? brand?.domain ?? domain,
      logo: brand?.logos?.[0]?.url,
      description: brand?.description,
    }
  }

  async listMonitors(): Promise<unknown[]> {
    const res = await this.client.monitors.list()
    return res.data
  }

  async createMonitor(config: MonitorConfig): Promise<unknown> {
    return this.client.monitors.create({
      name: config.name,
      target: { type: "page", url: config.url },
      ...(config.schedule ? { schedule: parseSchedule(config.schedule) } : {}),
    })
  }

  async getTools(): Promise<Record<string, Tool>> {
    return {
      web_search: tool({
        description: "Search the web with Context.dev and return ranked results.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().positive().default(5),
        }),
        execute: async ({ query, limit }) => this.search(query, limit),
      }),
      web_scrape: tool({
        description: "Scrape a URL into GitHub-Flavored Markdown with Context.dev.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => this.scrape(url),
      }),
      web_crawl: tool({
        description: "Crawl a site starting from a URL and return page Markdown with Context.dev.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => this.crawl(url),
      }),
      web_extract: tool({
        description:
          "Extract structured data from a URL against a JSON schema with Context.dev.",
        inputSchema: z.object({
          url: z.string().url(),
          schema: z.record(z.any()),
        }),
        execute: async ({ url, schema }) => this.extract(url, schema),
      }),
      get_brand: tool({
        description: "Fetch brand info (name, logo, description) for a domain with Context.dev.",
        inputSchema: z.object({ domain: z.string() }),
        execute: async ({ domain }) => this.getBrand(domain),
      }),
      create_monitor: tool({
        description: "Create a change-detection monitor for a page with Context.dev.",
        inputSchema: z.object({
          name: z.string(),
          url: z.string().url(),
          schedule: z.string().optional(),
        }),
        execute: async (args) => this.createMonitor(args),
      }),
    }
  }
}

function parseSchedule(schedule: string): {
  type: "interval"
  frequency: number
  unit: "minutes" | "hours" | "days"
} {
  const match = /^(\d+)\s*(min|minute|minutes|h|hr|hour|hours|d|day|days)?$/.exec(
    schedule.trim(),
  )
  if (!match) {
    throw new SdkError(
      `createMonitor: unsupported schedule "${schedule}" (expected e.g. "30m", "6h", "2d")`,
      { code: "INVALID_SCHEDULE" },
    )
  }
  const frequency = Number(match[1])
  const unitRaw = (match[2] ?? "h").toLowerCase()
  const unit =
    unitRaw.startsWith("min") ? "minutes"
    : unitRaw.startsWith("d") ? "days"
    : "hours"
  return { type: "interval", frequency, unit }
}
