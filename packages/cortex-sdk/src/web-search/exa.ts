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

const EXA_MCP_URL = "https://mcp.exa.ai/mcp"
const EXA_API_URL = "https://api.exa.ai"

export type ExaSearchOptions = Omit<WebSearchConfig, "provider">

export function createExaSearch(options: ExaSearchOptions = {}): WebSearchClient {
  return new ExaSearchClient(options)
}

class ExaSearchClient implements WebSearchClient {
  readonly provider = "exa" as const

  private readonly apiKey?: string
  private readonly baseURL: string
  private readonly fetchImpl: FetchLike
  private readonly createMcpClient: (
    config: AgentHandlerTransportConfig,
  ) => Promise<McpClientLike>
  private mcpClient: McpClientLike | null = null

  constructor(options: ExaSearchOptions) {
    this.apiKey = options.apiKey ?? process.env.EXA_API_KEY
    this.baseURL = options.baseURL ?? EXA_API_URL
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init))
    this.createMcpClient =
      options.createMcpClient ??
      ((config) => createMCPClient(config as never) as unknown as Promise<McpClientLike>)
  }

  get isConnected(): boolean {
    return this.mcpClient !== null
  }

  listProviders(): WebSearchProvider[] {
    return ["exa"]
  }

  async connect(): Promise<void> {
    if (this.mcpClient) return
    if (!this.apiKey) {
      throw new SdkError("createExaSearch: EXA_API_KEY not configured", {
        code: "NOT_CONFIGURED",
      })
    }
    const config: AgentHandlerTransportConfig = {
      transport: {
        type: "http",
        url: EXA_MCP_URL,
        headers: { "x-api-key": this.apiKey },
      },
    }
    try {
      this.mcpClient = await this.createMcpClient(config)
    } catch (error) {
      throw new ConnectionError("createExaSearch: failed to connect to Exa MCP", {
        code: "EXA_MCP_CONNECT_FAILED",
        cause: error,
      })
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
      throw new SdkError("createExaSearch: EXA_API_KEY not configured", {
        code: "NOT_CONFIGURED",
      })
    }
    const res = await this.fetchImpl(`${this.baseURL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({ query, numResults: limit }),
    })
    if (!res.ok) {
      throw new SdkError(`createExaSearch: search failed (${res.status})`, {
        code: "EXA_SEARCH_FAILED",
      })
    }
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url: string; publishedDate?: string; text?: string }>
    }
    return (data.results ?? []).map((r) => ({
      title: r.title ?? r.url,
      url: r.url,
      snippet: r.text,
      publishedDate: r.publishedDate,
    }))
  }

  async scrape(url: string): Promise<string> {
    if (!this.apiKey) {
      throw new SdkError("createExaSearch: EXA_API_KEY not configured", {
        code: "NOT_CONFIGURED",
      })
    }
    const res = await this.fetchImpl(`${this.baseURL}/contents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({ urls: [url] }),
    })
    if (!res.ok) {
      throw new SdkError(`createExaSearch: scrape failed (${res.status})`, {
        code: "EXA_SCRAPE_FAILED",
      })
    }
    const data = (await res.json()) as {
      results?: Array<{ url: string; text?: string; title?: string }>
    }
    const hit = (data.results ?? []).find((r) => r.url === url) ?? (data.results ?? [])[0]
    return hit?.text ?? ""
  }
}
