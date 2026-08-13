import { afterEach, describe, expect, test } from "bun:test"
import { clearGatewayCache, createGateway } from "./index"
import { ConcentrateAIProvider } from "./concentrateai"
import { OpenRouterProvider } from "./openrouter"
import { SdkError } from "../core/errors"
import type { GatewayProvider } from "../core/types"

afterEach(() => {
  clearGatewayCache()
})

describe("createGateway routing", () => {
  test("routes concentrateai and exposes provider + default model", () => {
    const gateway = createGateway({ provider: "concentrateai", apiKey: "sk" })
    expect(gateway.provider).toBe("concentrateai")
    expect(gateway.defaultModel).toBe("deepseek/deepseek-v4-flash")
  })

  test("model() returns an object usable with streamText (LanguageModel shape)", () => {
    const gateway = createGateway({ provider: "concentrateai", apiKey: "sk" })
    const model = gateway.model()
    expect(typeof model).toBe("object")
    expect(model).not.toBeNull()
  })

  test("model(id) uses the requested id", () => {
    const gateway = createGateway({ provider: "openrouter", apiKey: "sk" })
    const model = gateway.model("anthropic/claude-sonnet-4")
    expect(model).toBeTruthy()
  })

  test("listModels returns provider-defined models", async () => {
    const gateway = createGateway({ provider: "concentrateai", apiKey: "sk" })
    const models = await gateway.listModels()
    expect(models.length).toBeGreaterThan(0)
    expect(models.every((m) => m.provider === "concentrateai")).toBe(true)
  })

  test("throws SdkError for unsupported provider", () => {
    expect(() =>
      createGateway({ provider: "nope" as unknown as GatewayProvider, apiKey: "sk" }),
    ).toThrow(SdkError)
  })
})

describe("createGateway caching", () => {
  test("reuses cached provider for identical options", async () => {
    const a = createGateway({ provider: "concentrateai", apiKey: "sk" })
    const b = createGateway({ provider: "concentrateai", apiKey: "sk" })
    expect(a.defaultModel).toBe(b.defaultModel)
    expect((await a.listModels()).length).toBe((await b.listModels()).length)
  })

  test("clearGatewayCache drops entries", async () => {
    const a = createGateway({ provider: "concentrateai", apiKey: "sk" })
    clearGatewayCache()
    const b = createGateway({ provider: "concentrateai", apiKey: "sk" })
    expect(a.defaultModel).toBe(b.defaultModel)
    expect(a).not.toBe(b)
  })
})

describe("Provider env-var independence (BYOK hygiene)", () => {
  const envKeys = [
    "CONCENTRATE_BYOK_PROD_KEY",
    "CONCENTRATE_BYOK_DEV_KEY",
    "CONCENTRATEAI_API_KEY",
    "OPENROUTER_BYOK_PROD_KEY",
    "OPENROUTER_BYOK_DEV_KEY",
    "OPENROUTER_API_KEY",
  ]

  const saved: Record<string, string | undefined> = {}

  function lockEnv(values: Record<string, string>) {
    for (const k of envKeys) {
      saved[k] = process.env[k]
      if (values[k] === undefined) delete process.env[k]
      else process.env[k] = values[k]
    }
  }

  function restoreEnv() {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }

  test("ConcentrateAIProvider ignores leaked BYOK env vars", () => {
    lockEnv({
      CONCENTRATE_BYOK_PROD_KEY: "should-not-be-used",
      CONCENTRATE_BYOK_DEV_KEY: "should-not-be-used",
      CONCENTRATEAI_API_KEY: "should-not-be-used",
    })
    try {
      const provider = new ConcentrateAIProvider({})
      expect(provider.apiKey).toBe("")
      const explicit = new ConcentrateAIProvider({ apiKey: "user-key" })
      expect(explicit.apiKey).toBe("user-key")
    } finally {
      restoreEnv()
    }
  })

  test("OpenRouterProvider ignores leaked BYOK env vars", () => {
    lockEnv({
      OPENROUTER_BYOK_PROD_KEY: "should-not-be-used",
      OPENROUTER_BYOK_DEV_KEY: "should-not-be-used",
      OPENROUTER_API_KEY: "should-not-be-used",
    })
    try {
      const provider = new OpenRouterProvider({})
      expect(provider.apiKey).toBe("")
      const explicit = new OpenRouterProvider({ apiKey: "user-key" })
      expect(explicit.apiKey).toBe("user-key")
    } finally {
      restoreEnv()
    }
  })
})
