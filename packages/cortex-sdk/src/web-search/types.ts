import type { Tool } from "ai"
import type { FetchLike } from "../core/types"
import type { AgentHandlerTransportConfig, McpClientLike } from "../agent-handler/types"

export type WebSearchProvider = "exa" | "firecrawl" | "contextdev"

export interface SearchResult {
  title: string
  url: string
  snippet?: string
  publishedDate?: string
}

export interface WebSearchConfig {
  provider: WebSearchProvider
  apiKey?: string
  baseURL?: string
  fetch?: FetchLike
  createMcpClient?: (config: AgentHandlerTransportConfig) => Promise<McpClientLike>
}

export interface WebSearchClient {
  search(query: string, limit?: number): Promise<SearchResult[]>
  scrape(url: string): Promise<string>
  getTools(): Promise<Record<string, Tool>>
  listProviders(): WebSearchProvider[]
  connect(): Promise<void>
  disconnect(): Promise<void>
  readonly provider: WebSearchProvider
  readonly isConnected: boolean
}

export interface BrandInfo {
  domain: string
  name?: string
  logo?: string
  description?: string
}

export interface MonitorConfig {
  name: string
  url: string
  schedule?: string
}

export interface ContextDevWebSearchClient extends WebSearchClient {
  crawl(url: string): Promise<string>
  extract(url: string, schema: Record<string, unknown>): Promise<unknown>
  getBrand(domain: string): Promise<BrandInfo>
  listMonitors(): Promise<unknown[]>
  createMonitor(config: MonitorConfig): Promise<unknown>
}

export const WEB_SEARCH_PROVIDERS: readonly WebSearchProvider[] = [
  "exa",
  "firecrawl",
  "contextdev",
]
