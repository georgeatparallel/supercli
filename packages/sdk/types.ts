export type MessageRole = "system" | "user" | "assistant"

export interface Message {
  role: MessageRole
  content: string
}

export type Provider =
  | "google"
  | "openrouter"
  | "minimax"
  | "nvidia"
  | "mergedev"
  | "orcarouter"
  | "concentrateai"

export interface ChatRequest {
  messages: Message[]
  provider?: Provider
  model?: string
  apiKey?: string
  baseUrl?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  conversationId?: string
  profile?: string
  projectDoc?: string
}

export interface GenerateObjectRequest {
  messages: Message[]
  provider?: Provider
  model?: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  responseFormat?: "json" | "text"
}

export interface Usage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ChatChunk {
  type: "text-delta"
  textDelta: string
}

export interface FinishChunk {
  type: "finish"
  finishReason: string
  usage: Usage
}

export type StreamChunk = ChatChunk | FinishChunk

export interface ChatResponse {
  text: string
  usage: Usage
  finishReason: string
}

export interface GenerateObjectResponse {
  object: string
}

export interface HealthResponse {
  status: "ok"
  timestamp: string
  service: string
}

export interface UserResponse {
  id: string
  name: string | null
  email: string
  image: string | null
}

export interface ApiError {
  error: string
}

export interface SupercodeClientConfig {
  baseUrl: string
  token: string
}
