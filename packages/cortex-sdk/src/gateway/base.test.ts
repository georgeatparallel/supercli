import { afterEach, describe, expect, test } from "bun:test"
import {
  AuthError,
  ConnectionError,
  ModelUnavailableError,
  SdkError,
} from "../core/errors"
import { BaseGatewayProvider, type GatewayProviderOptions } from "./base"

class TestProvider extends BaseGatewayProvider {
  constructor(options: Partial<GatewayProviderOptions> = {}) {
    super({ provider: "concentrateai", ...options } as GatewayProviderOptions)
  }

  async listModels() {
    return []
  }

  protected buildModel(): import("ai").LanguageModel {
    throw new Error("unused")
  }
}

const realSetTimeout = globalThis.setTimeout

afterEach(() => {
  Object.defineProperty(globalThis, "setTimeout", {
    value: realSetTimeout,
    configurable: true,
  })
})

function instantTimers() {
  Object.defineProperty(globalThis, "setTimeout", {
    value: (fn: () => void) => {
      queueMicrotask(fn)
      return 0
    },
    configurable: true,
  })
}

describe("BaseGatewayProvider.fetchWithRetry", () => {
  test("succeeds on first attempt", async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      return new Response("ok", { status: 200 })
    }
    const provider = new TestProvider({ fetch: fetchImpl })
    const response = await provider.fetchWithRetry("https://example.com")
    expect(response.status).toBe(200)
    expect(calls).toBe(1)
  })

  test("retries on transient 5xx and recovers", async () => {
    instantTimers()
    let calls = 0
    const fetchImpl = async () => {
      calls++
      if (calls < 3) return new Response("server error", { status: 500 })
      return new Response("ok", { status: 200 })
    }
    const provider = new TestProvider({ fetch: fetchImpl, maxRetries: 2 })
    const response = await provider.fetchWithRetry("https://example.com")
    expect(response.status).toBe(200)
    expect(calls).toBe(3)
  })

  test("retries on 429 and 408", async () => {
    instantTimers()
    const codes = [429, 408, 200]
    let i = 0
    const fetchImpl = async () => {
      const status = codes[i]
      i++
      return new Response("try again", { status })
    }
    const provider = new TestProvider({ fetch: fetchImpl, maxRetries: 2 })
    const response = await provider.fetchWithRetry("https://example.com")
    expect(response.status).toBe(200)
    expect(i).toBe(3)
  })

  test("exhausts retries on persistent 5xx and throws ModelUnavailableError", async () => {
    instantTimers()
    let calls = 0
    const fetchImpl = async () => {
      calls++
      return new Response("down", { status: 503 })
    }
    const provider = new TestProvider({ fetch: fetchImpl, maxRetries: 2 })
    expect(provider.fetchWithRetry("https://example.com")).rejects.toBeInstanceOf(ModelUnavailableError)
    expect(calls).toBe(3)
  })

  test("does not retry on 4xx", async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      return new Response("bad request", { status: 400 })
    }
    const provider = new TestProvider({ fetch: fetchImpl, maxRetries: 3 })
    await expect(provider.fetchWithRetry("https://example.com")).rejects.toBeInstanceOf(SdkError)
    expect(calls).toBe(1)
  })
})

describe("BaseGatewayProvider.normalizeError", () => {
  test("429 maps to ConnectionError", async () => {
    instantTimers()
    const provider = new TestProvider({
      fetch: () => Promise.resolve(new Response("rate limited", { status: 429 })),
    })
    await expect(provider.fetchWithRetry("https://example.com")).rejects.toBeInstanceOf(ConnectionError)
  })

  test("401 maps to AuthError", async () => {
    const provider = new TestProvider({
      fetch: () => Promise.resolve(new Response("invalid key", { status: 401 })),
    })
    await expect(provider.fetchWithRetry("https://example.com")).rejects.toBeInstanceOf(AuthError)
  })

  test("404 maps to ModelUnavailableError", async () => {
    const provider = new TestProvider({
      fetch: () => Promise.resolve(new Response("not found", { status: 404 })),
    })
    await expect(provider.fetchWithRetry("https://example.com")).rejects.toBeInstanceOf(ModelUnavailableError)
  })
})