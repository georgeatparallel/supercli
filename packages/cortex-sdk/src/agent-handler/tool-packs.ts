import { ConnectionError, SdkError, ToolPackError } from "../core/errors"
import type { FetchLike } from "../core/types"
import type { ToolPackInfo } from "./types"

export const AH_API_BASE = "https://ah-api.merge.dev"

const AH_API_PATH = "/api/v1/tool-packs"

export const TOOL_PACK_PRESETS: ToolPackInfo[] = [
  {
    id: "web-search",
    name: "Web Search",
    tools: ["firecrawl_search", "firecrawl_scrape", "firecrawl_crawl", "firecrawl_map"],
  },
  {
    id: "exa-search",
    name: "Exa Search",
    tools: ["exa_search", "exa_web_fetch_exa"],
  },
]

export function mcpUrl(options: {
  apiUrl: string
  toolPackId: string
  registeredUserId: string
}): string {
  return `${options.apiUrl}${AH_API_PATH}/${options.toolPackId}/registered-users/${options.registeredUserId}/mcp`
}

export function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

export function mergePresets(discovered: ToolPackInfo[]): ToolPackInfo[] {
  const seen = new Set<string>()
  const merged: ToolPackInfo[] = []
  for (const pack of [...discovered, ...TOOL_PACK_PRESETS]) {
    if (!pack.id || seen.has(pack.id)) continue
    seen.add(pack.id)
    merged.push(pack)
  }
  return merged
}

export function toToolPackInfo(raw: unknown): ToolPackInfo | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id : typeof record.name === "string" ? record.name : ""
  if (!id) return null
  const name = typeof record.name === "string" ? record.name : id
  const tools = Array.isArray(record.tools)
    ? record.tools.filter((t): t is string => typeof t === "string")
    : []
  return { id, name, tools }
}

function extractPacks(body: unknown): ToolPackInfo[] {
  if (Array.isArray(body)) {
    return body.map(toToolPackInfo).filter((p): p is ToolPackInfo => p !== null)
  }
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>
    for (const key of ["data", "toolPacks", "results", "packs"]) {
      if (Array.isArray(record[key])) {
        return extractPacks(record[key])
      }
    }
  }
  return []
}

export async function listToolPacks(options: {
  apiUrl?: string
  apiKey?: string
  fetch?: FetchLike
}): Promise<ToolPackInfo[]> {
  const apiUrl = options.apiUrl ?? AH_API_BASE
  const fetchImpl = options.fetch ?? fetch
  try {
    const response = await fetchImpl(`${apiUrl}${AH_API_PATH}`, {
      method: "GET",
      headers: {
        ...authHeaders(options.apiKey),
        Accept: "application/json",
      },
    })
    if (!response.ok) {
      throw new SdkError(`listToolPacks: HTTP ${response.status} ${response.statusText}`)
    }
    const body = (await response.json()) as unknown
    const discovered = extractPacks(body)
    if (discovered.length === 0) {
      throw new SdkError("listToolPacks: no tool packs returned")
    }
    return mergePresets(discovered)
  } catch (error) {
    if (error instanceof ToolPackError) throw error
    if (error instanceof SdkError && error.code !== "SDK_ERROR") throw error
    if (error instanceof TypeError) {
      throw new ConnectionError("listToolPacks: network error", { cause: error })
    }
    if (error instanceof SdkError && error.code === "SDK_ERROR") {
      throw new ToolPackError(error.message, { cause: error })
    }
    throw new ToolPackError("listToolPacks: failed to discover tool packs", { cause: error })
  }
}