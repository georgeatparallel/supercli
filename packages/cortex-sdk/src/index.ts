export * from "./core/errors"
export * from "./core/types"

export { createGateway } from "./gateway"
export type {
  GatewayClient,
  ModelInfo,
} from "./gateway"

export { createAgentHandler, listToolPacks, TOOL_PACK_PRESETS } from "./agent-handler"
export type {
  AgentHandlerClient,
  AgentHandlerClientOptions,
  AgentHandlerTransportConfig,
  McpClientLike,
  ToolPackInfo,
} from "./agent-handler"

export { createComposio } from "./composio"
export type {
  AppInfo,
  ComposioClient,
  ComposioClientOptions,
  ComposioSessionInfo,
  ConnectAppResult,
} from "./composio"

export { createWebSearch } from "./web-search"
export type {
  SearchResult,
  WebSearchClient,
  WebSearchConfig,
  WebSearchProvider,
} from "./web-search"

export { createMcpManager } from "./mcp"
export type { McpConnection, McpManager } from "./mcp"

export { createVoice } from "./voice"
export type { SttResult, TtsResult, VoiceClient } from "./voice"
