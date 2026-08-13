import { SdkError } from "../core/errors"
import { createContextDevSearch } from "./contextdev"
import { createExaSearch } from "./exa"
import { createFirecrawlSearch } from "./firecrawl"
import type { WebSearchClient, WebSearchConfig, WebSearchProvider } from "./types"

export type {
  BrandInfo,
  ContextDevWebSearchClient,
  MonitorConfig,
  SearchResult,
  WebSearchClient,
  WebSearchConfig,
  WebSearchProvider,
} from "./types"
export { WEB_SEARCH_PROVIDERS } from "./types"
export { createContextDevSearch } from "./contextdev"
export { createExaSearch } from "./exa"
export { createFirecrawlSearch } from "./firecrawl"

export function createWebSearch(options: WebSearchConfig): WebSearchClient {
  switch (options.provider) {
    case "exa":
      return createExaSearch(options)
    case "firecrawl":
      return createFirecrawlSearch(options)
    case "contextdev":
      return createContextDevSearch(options)
    default:
      throw new SdkError(
        `createWebSearch: unknown provider "${(options as WebSearchConfig).provider}"`,
        { code: "UNKNOWN_PROVIDER" },
      )
  }
}
