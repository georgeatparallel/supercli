export type GatewayProvider =
  | "concentrateai"
  | "mergedev"
  | "openrouter"
  | "gemini"
  | "minimax"
  | "nim"
  | "orcarouter"
  | "supercode-cloud"

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface GatewayOptions {
  provider: GatewayProvider
  apiKey?: string
  baseURL?: string
  model?: string
  headers?: Record<string, string>
  fetch?: FetchLike
}

export interface AgentHandlerConfig {
  apiUrl?: string
  apiKey?: string
  registeredUserId?: string
  toolPacks?: string[]
  transport?: "http" | "sse"
  fetch?: FetchLike
}

export interface ComposioConfig {
  apiKey?: string
  serverUrl?: string
  accessToken?: string
  userId?: string
  apps?: string[]
  fetch?: FetchLike
  openBrowser?: (url: string) => Promise<void> | void
}

export type McpTransport = "stdio" | "http" | "sse"

export interface McpServerConfig {
  id: string
  name: string
  transport: McpTransport
  command?: string
  args?: string[]
  url?: string
  headers?: Record<string, string>
  env?: Record<string, string>
}

export type SttProvider = "smallest" | "elevenlabs" | "groq"

export type TtsProvider = "smallest" | "elevenlabs"

export interface VoiceConfig {
  stt?: SttProvider
  tts?: TtsProvider
  sttApiKey?: string
  ttsApiKey?: string
  sttModel?: string
  sttLanguage?: string
  ttsModel?: string
  voice?: string
  fetch?: FetchLike
}
