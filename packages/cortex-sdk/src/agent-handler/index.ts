import type { AgentHandlerConfig } from "../core/types"
import { AgentHandlerClientImpl } from "./client"
import type { AgentHandlerClient, AgentHandlerClientOptions, ToolPackInfo } from "./types"

export type { AgentHandlerConfig } from "../core/types"
export type { AgentHandlerClient, AgentHandlerClientOptions, ToolPackInfo } from "./types"

export { listToolPacks, TOOL_PACK_PRESETS } from "./tool-packs"
export type { McpClientLike, AgentHandlerTransportConfig } from "./types"

export function createAgentHandler(config: AgentHandlerConfig): AgentHandlerClient {
  return new AgentHandlerClientImpl(config as AgentHandlerClientOptions)
}