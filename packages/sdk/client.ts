import type {
  ChatRequest,
  GenerateObjectRequest,
  ChatResponse,
  GenerateObjectResponse,
  HealthResponse,
  UserResponse,
  StreamChunk,
  SupercodeClientConfig,
} from "./types"
import {
  chatRequestSchema,
  generateObjectRequestSchema,
  healthResponseSchema,
  userResponseSchema,
  streamChunkSchema,
} from "./schemas"

export class SupercodeClient {
  private baseUrl: string
  private token: string

  constructor(config: SupercodeClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "")
    this.token = config.token
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    }
  }

  async health(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/api/health`)
    const data = await res.json()
    return healthResponseSchema.parse(data)
  }

  async me(): Promise<UserResponse> {
    const res = await fetch(`${this.baseUrl}/api/auth/me`, {
      headers: this.headers,
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || "Failed to get user")
    }
    const data = await res.json()
    return userResponseSchema.parse(data)
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const validated = chatRequestSchema.parse(request)
    const res = await fetch(`${this.baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(validated),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || "Chat request failed")
    }

    let text = ""
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    let finishReason = ""

    const reader = res.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const chunk = JSON.parse(line)
          const parsed = streamChunkSchema.parse(chunk)

          if (parsed.type === "text-delta") {
            text += parsed.textDelta
          } else if (parsed.type === "finish") {
            finishReason = parsed.finishReason
            usage = parsed.usage
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    return { text, usage, finishReason }
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    const validated = chatRequestSchema.parse(request)
    const res = await fetch(`${this.baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(validated),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || "Chat request failed")
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const chunk = JSON.parse(line)
          const parsed = streamChunkSchema.parse(chunk)
          yield parsed
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  async generateObject(request: GenerateObjectRequest): Promise<GenerateObjectResponse> {
    const validated = generateObjectRequestSchema.parse(request)
    const res = await fetch(`${this.baseUrl}/api/ai/generate-object`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(validated),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || "Generate object request failed")
    }

    const data = await res.json()
    return { object: data.object }
  }
}
