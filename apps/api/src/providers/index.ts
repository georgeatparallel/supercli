import { streamText, type ModelMessage, type Tool } from "ai"
import { google } from "@ai-sdk/google"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { minimax } from "vercel-minimax-ai-provider"
import prisma from "../lib/prisma"

type StreamResult = ReturnType<typeof streamText>

const DAILY_TOKEN_LIMIT = 128_000
const DAILY_QUERY_LIMIT = 20

function buildSystemPrompt(profile?: string | null, projectDoc?: string | null): string {
  const parts: string[] = []
  parts.push(
    "You are Supercode, a CLI-based AI coding agent that lives in the user's terminal. You are an expert software engineer who writes clean, production-grade code."
  )
  if (projectDoc) {
    parts.push(`\n## Project Context\n${projectDoc}`)
  }
  if (profile) {
    parts.push(`\n## User Instructions\n${profile}`)
  }
  parts.push("\n## Rules\n- Be concise and direct\n- Write code, don't explain unless asked\n- Never add unsolicited comments\n- Follow existing codebase conventions")
  return parts.join("\n")
}

async function checkDailyTokenBudget(): Promise<{
  allowed: boolean
  remaining: number
  queriesRemaining: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const events = await prisma.usageEvent.findMany({
    where: {
      createdAt: { gte: today, lt: tomorrow },
    },
    select: {
      inputTokens: true,
      outputTokens: true,
      cachedInputTokens: true,
    },
  })

  const totalTokens = events.reduce(
    (sum, e) => sum + e.inputTokens + e.outputTokens + (e.cachedInputTokens ?? 0),
    0
  )

  return {
    allowed: totalTokens < DAILY_TOKEN_LIMIT && events.length < DAILY_QUERY_LIMIT,
    remaining: Math.max(0, DAILY_TOKEN_LIMIT - totalTokens),
    queriesRemaining: Math.max(0, DAILY_QUERY_LIMIT - events.length),
  }
}

function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number
): number {
  const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
    "gemini-3-flash-preview": { input: 1, output: 4, cacheRead: 0.25 },
    "gemini-3-pro-preview": { input: 1.25, output: 10, cacheRead: 0.315 },
    "minimax-m3": { input: 0.15, output: 0.85, cacheRead: 0.015 },
  }
  const p = MODEL_PRICING[model] ?? { input: 0, output: 0, cacheRead: 0 }
  const regularInput = inputTokens - cachedInputTokens
  return Math.round(
    ((regularInput * p.input + cachedInputTokens * p.cacheRead + outputTokens * p.output) / 1_000_000) * 1_000_000
  ) / 1_000_000
}

function routeToProvider(params: {
  provider: string
  model: string
}): { aiModel: string; aiProvider: string } {
  const { provider, model } = params

  switch (provider) {
    case "google":
      return { aiModel: model || "gemini-3-flash-preview", aiProvider: "google" }
    case "openrouter":
      return { aiModel: model || "openai/gpt-oss-120b:free", aiProvider: "openrouter" }
    case "minimax":
      return { aiModel: model || "minimax-m3", aiProvider: "minimax" }
    case "nvidia":
      return { aiModel: model || "minimaxai/minimax-m3", aiProvider: "nvidia" }
    case "mergedev":
      return { aiModel: model || "minimaxai/MiniMax-M2.7", aiProvider: "mergedev" }
    case "orcarouter":
      return { aiModel: model || "minimaxai/MiniMax-M2.7", aiProvider: "orcarouter" }
    case "concentrateai":
      return { aiModel: model || "minimaxai/MiniMax-M2.7", aiProvider: "concentrateai" }
    default:
      return { aiModel: model || "gemini-3-flash-preview", aiProvider: "google" }
  }
}

export async function createStreamText(opts: {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  messages: ModelMessage[]
  systemPrompt: string
  tools?: Record<string, Tool>
  conversationId?: string
}): Promise<StreamResult> {
  const { allowed, remaining, queriesRemaining } = await checkDailyTokenBudget()

  if (!allowed) {
    throw new Error(
      `Daily token limit reached. You have ${remaining} tokens and ${queriesRemaining} queries remaining today. Please try again tomorrow.`
    )
  }

  const { aiModel, aiProvider } = routeToProvider({
    provider: opts.provider,
    model: opts.model,
  })

  let modelInstance: any

  switch (aiProvider) {
    case "google":
      modelInstance = google(aiModel)
      break
    case "openrouter": {
      const or = createOpenRouter({ apiKey: opts.apiKey || process.env.OPENROUTER_API_KEY })
      modelInstance = or(aiModel)
      break
    }
    case "minimax":
      modelInstance = minimax(aiModel)
      break
    case "nvidia":
    case "mergedev":
    case "orcarouter":
    case "concentrateai": {
      const baseURL = opts.baseUrl || process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"
      const compat = createOpenAICompatible({
        name: aiProvider,
        apiKey: opts.apiKey,
        baseURL,
      })
      modelInstance = compat(aiModel)
      break
    }
    default:
      modelInstance = google(aiModel)
  }

  const result = streamText({
    model: modelInstance,
    messages: opts.messages,
    system: opts.systemPrompt,
    maxOutputTokens: opts.maxTokens || 4096,
    temperature: opts.temperature || 0.7,
    topP: opts.topP || 0.95,
    tools: opts.tools,
    onFinish: async ({ usage }) => {
      const cost = computeCost(aiModel, usage.inputTokens ?? 0, usage.outputTokens ?? 0, 0)
      try {
        await prisma.usageEvent.create({
          data: {
            provider: aiProvider,
            model: aiModel,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            cachedInputTokens: 0,
            costUsd: cost,
            durationMs: 0,
          },
        })
      } catch (e) {
        console.error("[track-usage] Failed to record usage:", e)
      }
    },
  })

  return result
}

export { DAILY_TOKEN_LIMIT, DAILY_QUERY_LIMIT, buildSystemPrompt, computeCost }
