import { SdkError } from "../core/errors"
import type { McpServerConfig } from "../core/types"

export type { McpServerConfig, McpTransport } from "../core/types"

export interface McpConnection {
  serverId: string
  connected: boolean
}

export interface McpManager {
  connectServer(id: string): Promise<void>
  listTools(serverId?: string): Promise<unknown[]>
  listServers(): McpServerConfig[]
  disconnect(): Promise<void>
}

export function createMcpManager(options: { servers?: McpServerConfig[] }): McpManager {
  void options
  throw new SdkError("createMcpManager: not implemented yet (Phase 5)", {
    code: "NOT_IMPLEMENTED",
  })
}
