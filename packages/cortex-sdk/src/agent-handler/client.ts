import { createMCPClient, type MCPClientConfig } from "@ai-sdk/mcp"
import type { Tool } from "ai"
import { ConnectionError, SdkError, ToolPackError } from "../core/errors"
import { authHeaders, listToolPacks, mcpUrl, TOOL_PACK_PRESETS } from "./tool-packs"
import type { AgentHandlerClient, AgentHandlerClientOptions, McpClientLike, ToolPackInfo } from "./types"

export class AgentHandlerClientImpl implements AgentHandlerClient {
  private readonly options: AgentHandlerClientOptions
  private readonly clients = new Map<string, McpClientLike>()
  private selected: string[]
  private discovered: ToolPackInfo[] | null = null

  constructor(options: AgentHandlerClientOptions) {
    this.options = options
    this.selected = options.toolPacks ?? []
  }

  get isConnected(): boolean {
    return this.clients.size > 0
  }

  get selectedPacks(): string[] {
    return [...this.selected]
  }

  async connect(): Promise<void> {
    if (this.selected.length === 0) {
      throw new SdkError("connect: no tool packs selected. Call selectPacks() first", {
        code: "NO_TOOL_PACKS",
      })
    }
    for (const packId of this.selected) {
      if (this.clients.has(packId)) continue
      const client = await this.createClient(packId)
      this.clients.set(packId, client)
    }
  }

  async disconnect(): Promise<void> {
    const clients = [...this.clients.values()]
    this.clients.clear()
    await Promise.allSettled(clients.map((client) => client.close()))
  }

  async reconnect(): Promise<void> {
    await this.disconnect()
    await this.connect()
  }

  async getTools(): Promise<Record<string, Tool>> {
    if (!this.isConnected) {
      await this.connect()
    }
    const tools: Record<string, Tool> = {}
    for (const [packId, client] of this.clients) {
      try {
        Object.assign(tools, await client.tools())
      } catch (error) {
        throw new ToolPackError(`getTools: pack "${packId}" failed to return tools`, { cause: error })
      }
    }
    return tools
  }

  async listToolPacks(): Promise<ToolPackInfo[]> {
    if (this.discovered) {
      return this.discovered
    }
    const packs = await listToolPacks({
      apiUrl: this.options.apiUrl,
      apiKey: this.options.apiKey,
      fetch: this.options.fetch,
    })
    this.discovered = packs
    return packs
  }

  clearToolPackCache(): void {
    this.discovered = null
  }

  async selectPacks(ids: string[]): Promise<ToolPackInfo[]> {
    let known: ToolPackInfo[]
    try {
      known = await this.listToolPacks()
    } catch {
      known = this.discovered ?? TOOL_PACK_PRESETS
    }
    const knownIds = new Set(known.map((pack) => pack.id))
    for (const id of ids) {
      if (!knownIds.has(id)) {
        throw new ToolPackError(`selectPacks: unknown tool pack "${id}"`, { code: "UNKNOWN_TOOL_PACK" })
      }
    }
    if (this.isConnected) {
      await this.disconnect()
      this.selected = ids
      await this.connect()
    } else {
      this.selected = ids
    }
    return known.filter((pack) => ids.includes(pack.id))
  }

  private async createClient(packId: string): Promise<McpClientLike> {
    const transport = this.options.transport ?? "http"
    const apiUrl = this.options.apiUrl ?? "https://ah-api.merge.dev"
    const registeredUserId = this.options.registeredUserId
    if (!registeredUserId) {
      throw new SdkError("createAgentHandler: registeredUserId is required", {
        code: "MISSING_REGISTERED_USER_ID",
      })
    }
    const config = {
      transport: {
        type: transport,
        url: mcpUrl({ apiUrl, toolPackId: packId, registeredUserId }),
        headers: authHeaders(this.options.apiKey),
      },
    }
    try {
      const createClient =
        this.options.createMcpClient ??
        ((c) => createMCPClient(c as MCPClientConfig) as unknown as Promise<McpClientLike>)
      return await createClient(config)
    } catch (error) {
      if (error instanceof SdkError) throw error
      if (error instanceof Error && error.message.includes("401")) {
        throw new ConnectionError(`connect: authentication failed for pack "${packId}"`, {
          code: "AUTH_ERROR",
          cause: error,
        })
      }
      throw new ConnectionError(`connect: failed to connect to pack "${packId}"`, { cause: error })
    }
  }
}