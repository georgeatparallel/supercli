import type { Tool } from "ai"
import type { AgentHandlerConfig } from "../core/types"

export interface ToolPackInfo {
  id: string
  name: string
  tools: string[]
}

export interface AgentHandlerTransportConfig {
  transport: {
    type: "http" | "sse"
    url: string
    headers?: Record<string, string>
  }
}

export interface McpClientLike {
  tools(): Promise<Record<string, Tool>>
  close(): Promise<void>
}

export interface AgentHandlerClientOptions extends AgentHandlerConfig {
  createMcpClient?: (config: AgentHandlerTransportConfig) => Promise<McpClientLike>
}

export interface AgentHandlerClient {
  connect(): Promise<void>
  disconnect(): Promise<void>
  reconnect(): Promise<void>
  getTools(): Promise<Record<string, Tool>>
  listToolPacks(): Promise<ToolPackInfo[]>
  selectPacks(ids: string[]): Promise<ToolPackInfo[]>
  clearToolPackCache(): void
  readonly isConnected: boolean
  readonly selectedPacks: string[]
}