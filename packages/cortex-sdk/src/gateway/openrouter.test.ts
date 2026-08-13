import { describe, expect, test } from "bun:test"
import { createGateway } from "./index"
import { OpenRouterProvider } from "./openrouter"
import type { LanguageModelV2 } from "@ai-sdk/provider"
import { AuthError } from "../core/errors"

interface CapturedRequest {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

function makeFetch(behaviour: "ok-then-success" | "always-401" | "always-500-models" = "ok-then-success") {
  const calls: CapturedRequest[] = []
  const record = (input: string | URL | Request, init?: RequestInit): CapturedRequest => {
    const url = typeof input === "string" ? input : input.toString()
    const headers: Record<string, string> = {}
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => (headers[k] = v))
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) headers[k] = v
      } else {
        Object.assign(headers, init.headers)
      }
    }
    const body = init && init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {}
    const entry: CapturedRequest = { url, headers, body }
    calls.push(entry)
    return entry
  }

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const entry = record(input, init)
    if (entry.url.endsWith("/models")) {
      if (behaviour === "always-500-models") return new Response("down", { status: 500 })
      return new Response(
        JSON.stringify({ data: [{ id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
    if (entry.url.endsWith("/chat/completions")) {
      if (behaviour === "always-401") return new Response("unauthorized", { status: 401 })
      return new Response(
        JSON.stringify({
          id: "chatcmpl-test",
          model: entry.body.model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello there", reasoning: null, tool_calls: [] },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 4,
            completion_tokens: 7,
            total_tokens: 11,
            prompt_tokens_details: { cached_tokens: 0 },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
    return new Response("not found", { status: 404 })
  }

  return { calls, fetchImpl }
}

describe("OpenRouter provider", () => {
  test("listModels fetches /models and falls back when non-OK", async () => {
    const ok = makeFetch("ok-then-success")
    const gateway = createGateway({
      provider: "openrouter",
      apiKey: "sk-test",
      fetch: ok.fetchImpl,
    })
    const models = await gateway.listModels()
    expect(models.some((m) => m.id === "anthropic/claude-sonnet-4")).toBe(true)
    expect(ok.calls[0]?.url).toContain("/models")

    const bad = makeFetch("always-500-models")
    const gateway2 = createGateway({ provider: "openrouter", apiKey: "sk", fetch: bad.fetchImpl })
    const fallback = await gateway2.listModels()
    expect(fallback.length).toBeGreaterThan(0)
  })

  test("doGenerate sends Authorization Bearer and correct body shape", async () => {
    const { calls, fetchImpl } = makeFetch("ok-then-success")
    const gw = createGateway({
      provider: "openrouter",
      apiKey: "sk-test",
      model: "anthropic/claude-sonnet-4",
      fetch: fetchImpl,
      siteUrl: "https://example.com",
      siteTitle: "Supercode",
      forceProvider: "anthropic",
      allowFallbacks: false,
    } as Parameters<typeof createGateway>[0] & {
      siteUrl: string
      siteTitle: string
      forceProvider: string
      allowFallbacks: boolean
    })

    const model = gw.model() as unknown as LanguageModelV2
    const result = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    } as never)

    const chatCall = calls.find((c) => c.url.endsWith("/chat/completions"))
    expect(chatCall).toBeDefined()
    if (!chatCall) throw new Error("missing chat call")
    expect(chatCall.headers["Authorization"]).toBe("Bearer sk-test")
    expect(chatCall.headers["Content-Type"]).toBe("application/json")
    expect(chatCall.headers["HTTP-Referer"]).toBe("https://example.com")
    expect(chatCall.headers["X-Title"]).toBe("Supercode")
    expect(chatCall.body.model).toBe("anthropic/claude-sonnet-4")
    expect(chatCall.body.stream).toBe(false)
    expect(chatCall.body.provider).toEqual({ force: true, order: ["anthropic"], allow_fallbacks: false })

    const text = result.content.find((c) => c.type === "text")
    expect(text?.type).toBe("text")
    if (text && text.type === "text") expect(text.text).toBe("Hello there")
    expect(result.finishReason).toBe("stop")
  })

  test("401 maps to AuthError via fetchWithRetry path", async () => {
    const { fetchImpl } = makeFetch("always-401")
    const provider = new OpenRouterProvider({ apiKey: "sk-bad", fetch: fetchImpl })
    await expect(provider.fetchWithRetry(`${provider.baseURL}/chat/completions`)).rejects.toBeInstanceOf(AuthError)
  })

  test("uses default baseURL when none provided", () => {
    const provider = new OpenRouterProvider({ apiKey: "sk" })
    expect(provider.baseURL).toBe("https://openrouter.ai/api/v1")
  })

  test("allowFallbacks defaults to true and explicit false is honored", () => {
    const def = new OpenRouterProvider({ apiKey: "sk" })
    const off = new OpenRouterProvider({ apiKey: "sk", allowFallbacks: false })
    expect(def.allowFallbacks).toBe(true)
    expect(off.allowFallbacks).toBe(false)
  })
})
