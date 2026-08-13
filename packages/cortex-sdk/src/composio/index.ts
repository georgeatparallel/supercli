import { createMCPClient } from "@ai-sdk/mcp"
import type { Tool } from "ai"
import { AuthError, ConnectionError, SdkError } from "../core/errors"
import type { ComposioConfig } from "../core/types"
import type { AgentHandlerTransportConfig } from "../agent-handler/types"
import { ComposioAppManager } from "./apps"
import { closeClient, recreateSession } from "./oauth"
import {
  ComposioSessionManager,
  COMPOSIO_DEFAULT_SERVER_URL,
} from "./session"
import type {
  AppInfo,
  ComposioClient,
  ComposioClientOptions,
  ConnectAppResult,
  McpClientLike,
} from "./types"

export type { ComposioConfig } from "../core/types"
export type {
  AppInfo,
  ComposioClient,
  ComposioClientOptions,
  ComposioSessionInfo,
  ConnectAppResult,
  McpClientLike,
} from "./types"

export class ComposioClientImpl implements ComposioClient {
  private readonly options: ComposioClientOptions
  private readonly sessionManager: ComposioSessionManager
  private readonly apps: ComposioAppManager
  private mcpClient: McpClientLike | null = null

  constructor(options: ComposioConfig = {}) {
    this.options = options as ComposioClientOptions

    const fetch = this.options.fetch
    const loadComposio = this.options.loadComposio
    const serverUrl = this.options.serverUrl ?? COMPOSIO_DEFAULT_SERVER_URL
    const accessToken = this.options.accessToken
    const apiKey = this.options.apiKey

    this.sessionManager = new ComposioSessionManager({
      apiKey,
      serverUrl,
      accessToken,
      userId: this.options.userId,
      fetch,
      loadComposio,
    })

    this.apps = new ComposioAppManager({
      session: this.sessionManager,
      openBrowser: this.options.openBrowser,
    })
  }

  get isConnected(): boolean {
    return this.mcpClient !== null
  }

  async connect(): Promise<void> {
    if (this.mcpClient) return
    const info = await this.getSessionInfo()
    this.mcpClient = await this.createMcpClient(info.url, info.headers)
  }

  async disconnect(): Promise<void> {
    const client = this.mcpClient
    this.mcpClient = null
    await closeClient(client)
    this.sessionManager.resetSession()
  }

  async getTools(): Promise<Record<string, Tool>> {
    if (!this.mcpClient) {
      await this.connect()
    }
    return await this.mcpClient!.tools()
  }

  async listApps(): Promise<AppInfo[]> {
    return this.apps.listApps()
  }

  async connectApp(slug: string): Promise<ConnectAppResult> {
    if (this.sessionManager.mode === "proxied") {
      throw new AuthError(
        "createComposio.connectApp: proxied mode does not support toolkits.authorize; connect via the dashboard or use apiKey mode",
        { code: "PROXIED_CONNECT_UNSUPPORTED" },
      )
    }
    if (this.sessionManager.mode === "unconfigured") {
      throw new AuthError(
        `createComposio.connectApp("${slug}"): COMPOSIO_API_KEY not configured`,
        { code: "NOT_CONFIGURED" },
      )
    }

    const result = await this.apps.connectApp(slug)

    try {
      await result.waitForActive()
    } catch (error) {
      throw new ConnectionError(
        `createComposio: connection for "${slug}" did not become active`,
        { code: "CONNECTION_NOT_ACTIVE", cause: error },
      )
    }

    await this.refreshAfterConnection()
    return result
  }

  async selectApps(slugs: string[]): Promise<void> {
    for (const slug of slugs) {
      await this.connectApp(slug)
    }
  }

  private async getSessionInfo() {
    const existing = this.sessionManager.connectionInfo
    if (existing) return existing

    if (this.sessionManager.mode === "proxied") {
      return this.sessionManager.createSessionFromServer()
    }

    try {
      return await this.sessionManager.createSession()
    } catch (error) {
      throw new ConnectionError("createComposio: failed to create composio session", {
        code: "SESSION_CREATE_FAILED",
        cause: error,
      })
    }
  }

  private async createMcpClient(url: string, headers: Record<string, string>): Promise<McpClientLike> {
    const config: AgentHandlerTransportConfig = {
      transport: {
        type: url.endsWith("/sse") ? "sse" : "http",
        url,
        headers,
      },
    }
    try {
      const createClient =
        this.options.createMcpClient ??
        ((c: AgentHandlerTransportConfig) =>
          createMCPClient(c as never) as unknown as Promise<McpClientLike>)
      return await createClient(config)
    } catch (error) {
      throw new ConnectionError("createComposio: failed to open MCP session", {
        code: "MCP_SESSION_FAILED",
        cause: error,
      })
    }
  }

  private async refreshAfterConnection(): Promise<void> {
    const client = this.mcpClient
    this.mcpClient = null
    await closeClient(client)
    await recreateSession(this.sessionManager)
    if (!this.sessionManager.connectionInfo) {
      throw new SdkError("createComposio: session did not refresh after connection", {
        code: "SESSION_REFRESH_FAILED",
      })
    }
  }
}

export function createComposio(options: ComposioConfig = {}): ComposioClient {
  return new ComposioClientImpl(options)
}