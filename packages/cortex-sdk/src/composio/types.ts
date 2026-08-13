import type { Tool } from "ai"
import type { ComposioConfig } from "../core/types"
import type { AgentHandlerTransportConfig } from "../agent-handler/types"

export type OpenBrowser = (url: string) => Promise<void> | void

export interface AppInfo {
  slug: string
  name: string
  description?: string
  logo?: string
  connected: boolean
  connectedAccountId?: string
}

export interface ComposioSessionInfo {
  url: string
  headers: Record<string, string>
  sessionId: string
  apiKey?: string
}

export interface ConnectAppResult {
  connectedAccountId: string
  redirectUrl: string | null
  waitForActive(): Promise<void>
}

export interface McpClientLike {
  tools(): Promise<Record<string, Tool>>
  close(): Promise<void>
}

export interface ComposioLike {
  sessions: {
    create(
      userId: string,
      options: { mcp: boolean; connectedAccounts: Record<string, string> },
    ): Promise<{
      mcp: { url: string; headers: Record<string, string> }
      session_id: string
    }>
  }
  connectedAccounts: {
    list(options: Record<string, never>): Promise<{
      items: Array<{ id: string; status: string; toolkit?: { slug: string } }>
    }>
  }
  toolkits: {
    get(): Promise<
      Array<{ slug: string; name: string; meta?: { description?: string; logo?: string } }>
    >
    authorize(
      userId: string,
      slug: string,
    ): Promise<{ id: string; redirectUrl: string | null; waitForConnection(): Promise<void> }>
  }
  authConfigs: {
    list(options: Record<string, never>): Promise<{ items: Array<{ toolkit?: { slug: string } }> }>
  }
}

export interface ComposioClientOptions extends ComposioConfig {
  loadComposio?: () => Promise<{ Composio: new (options: { apiKey: string }) => unknown }>
  createMcpClient?: (config: AgentHandlerTransportConfig) => Promise<McpClientLike>
}

export interface ComposioClient {
  connect(): Promise<void>
  disconnect(): Promise<void>
  getTools(): Promise<Record<string, Tool>>
  listApps(): Promise<AppInfo[]>
  connectApp(slug: string): Promise<ConnectAppResult>
  selectApps(slugs: string[]): Promise<void>
  readonly isConnected: boolean
}