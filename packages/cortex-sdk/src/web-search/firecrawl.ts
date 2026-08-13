import { createMCPClient } from "@ai-sdk/mcp"
import type { Tool } from "ai"
import { ConnectionError, SdkError } from "../core/errors"
import type { FetchLike } from "../core/types"
import type { AgentHandlerTransportConfig, McpClientLike } from "../agent-handler/types"
import type {
  SearchResult,
  WebSearchClient,
  WebSearchConfig,
  WebSearchProvider,
} from "./types"

const FIRECRAWL_MCP_URL = "https://mcp.firecrawl.dev/v2/mcp"
const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1"

export type FirecrawlSearchOptions = Omit<WebSearchConfig, "provider">

export function createFirecrawlSearch(options: FirecrawlSearchOptions = {}): WebSearchClient {
  return new FirecrawlSearchClient(options)
}

class FirecrawlSearchClient implements WebSearchClient {
  readonly provider = "firecrawl" as const

  private readonly apiKey?: string
  private readonly baseURL: string
  private readonly fetchImpl: FetchLike
  private readonly createMcpClient: (
    config: AgentHandlerTransportConfig,
  ) => Promise<McpClientLike>
  private mcpClient: McpClientLike | null = null

  constructor(options: FirecrawlSearchOptions) {
    this.apiKey = options.apiKey ?? process.env.FIRECRAWL_API_KEY
    this.baseURL = options.baseURL ?? FIRECRAWL_API_URL
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init))
    this.createMcpClient =
      options.createMcpClient ??
      ((config) => createMCPClient(config as never) as unknown as Promise<McpClientLike>)
  }

  get isConnected(): boolean {
    return this.mcpClient !== null
  }

  listProviders(): WebSearchProvider[] {
    return ["firecrawl"]
  }

  async connect(): Promise<void> {
    if (this.mcpClient) return
    if (!this.apiKey) {
      throw new SdkError("createFirecrawlSearch: FIRECRAWL_API_KEY not configured", {
        code: "NOT_CONFIGURED",
      })
    }
    const config: AgentHandlerTransportConfig = {
      transport: {
        type: "http",
        url: FIRECRAWL_MCP_URL,
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    }
    try {
      this.mcpClient = await this.createMcpClient(config)
    } catch (error) {
      throw new ConnectionError(
        "createFirecrawlSearch: failed to connect to Firecrawl MCP",
        { code: "FIRECRAWL_MCP_CONNECT_FAILED", cause: error },
      )
    }
  }

  async disconnect(): Promise<void> {
    const client = this.mcpClient
    this.mcpClient = null
    if (client) {
      await client.close()
    }
  }

  async getTools(): Promise<Record<string, Tool>> {
    if (!this.mcpClient) {
      await this.connect()
    }
    return await this.mcpClient!.tools()
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new SdkError("createFirecrawlSearch: FIRECRAWL_API_KEY not configured", {
        code: "NOT_CONFIGURED",
      })
    }
    const res = await this.fetchImpl(`${this.baseURL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query, limit }),
    })
    if (!res.ok) {
      throw new SdkError(`createFirecrawlSearch: search failed (${res.status})`, {
        code: "FIRECRAWL_SEARCH_FAILED",
      })
    }
    const data = (await res.json()) as {
      data?: Array<{ title?: string; url: string; description?: string }>
    }
    return (data.data ?? []).map((r) => ({
      title: r.title ?? r.url,
      url: r.url,
      snippet: r.description,
    }))
  }

  async scrape(url: string): Promise<string> {
    if (!this.apiKey) {
      throw new SdkError("createFirecrawlSearch: FIRECRAWL_API_KEY not configured", {
        code: "NOT_CONFIGURED",
      })
    }
    const res = await this.fetchImpl(`${this.baseURL}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    })
    if (!res.ok) {
      throw new SdkError(`createFirecrawlSearch: scrape failed (${res.status})`, {
        code: "FIRECRAWL_SCRAPE_FAILED",
      })
    }
    const data = (await res.json()) as { data?: { markdown?: string } }
    return data.data?.markdown ?? ""
  }
}
