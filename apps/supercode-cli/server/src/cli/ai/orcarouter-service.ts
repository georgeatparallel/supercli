import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { streamText, type FinishReason, type ModelMessage, type LanguageModel } from "ai"
import { orcarouterConfig } from "../../config/orcarouter.config.ts"
import chalk from "chalk"
import { recordUsage } from "../../lib/track-usage"
import { computeCost } from "../../lib/pricing"
import { executeToolLoop } from "./tool-executor.ts"
import { stripOrphanToolCalls } from "./sanitize-messages"

const HIGH_VALUE_MODELS: string[] = []

export class OrcaRouterService {
  model: LanguageModel
  readonly modelName: string

  constructor(modelName?: string) {
    if (!orcarouterConfig.apiKey) {
      throw new Error(
        "OrcaRouter is not configured.\n\n  Set ORCAROUTER_API_KEY in your environment:\n" +
        "    export ORCAROUTER_API_KEY=<your-key>\n\n" +
        "  Get a key at: https://orcarouter.ai",
      )
    }

    this.modelName = modelName || orcarouterConfig.model

    const client = createOpenAICompatible({
      name: "orcarouter",
      baseURL: orcarouterConfig.baseUrl,
      headers: { Authorization: `Bearer ${orcarouterConfig.apiKey}` },
    })

    this.model = client.chatModel(this.modelName)
  }

  async sendMessage(
    messages: ModelMessage[],
    onChunk?: (chunk: string) => void,
    tools?: any,
    onToolCall?: any,
    signal?: AbortSignal,
    onReasoning?: (chunk: string) => void,
    onToolResult?: (params: { toolName: string; args: unknown; result: string }) => void,
    onStepFinish?: (params: { stepNumber: number; toolCalls: Array<{ toolName: string; args: unknown }>; toolResults: Array<{ toolName: string; args: unknown; result: string }> }) => void,
  ) {
    const streamAbortController = new AbortController()
    const streamTimeout = setTimeout(() => streamAbortController.abort(), 120_000)
    const signalHandler = signal ? () => streamAbortController.abort() : undefined
    signalHandler && signal!.addEventListener("abort", signalHandler, { once: true })

    try {
      // Drop orphan tool_calls — see sanitize-messages.ts.
      const sanitized = stripOrphanToolCalls(messages)
      const systemMessages = sanitized.filter(m => m.role === "system")
      const nonSystemMessages = sanitized.filter(m => m.role !== "system")
      const system = systemMessages.map(m => m.content).join("\n")

      const hasTools = tools && Object.keys(tools).length > 0

      if (!hasTools) {
        const result = streamText({
          model: this.model,
          messages: nonSystemMessages,
          system,
          abortSignal: streamAbortController.signal,
          ...(!HIGH_VALUE_MODELS.includes(this.modelName) ? { maxOutputTokens: 8192 } : {}),
        })

        let fullResponse = ""
        for await (const chunk of result.textStream) {
          fullResponse += chunk
          onChunk?.(chunk)
        }

        const [finishReason, usage] = await Promise.all([
          result.finishReason,
          result.usage,
        ])

        recordUsage({
          provider: "orcarouter",
          model: this.modelName,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
          costUsd: computeCost(this.modelName, usage.inputTokens ?? 0, usage.outputTokens ?? 0, usage.inputTokenDetails?.cacheReadTokens ?? 0),
          durationMs: null,
        })

        return {
          content: fullResponse,
          finishReason,
          usage,
        }
      }

      const {content, usage} = await executeToolLoop(
        this.model,
        nonSystemMessages,
        system,
        tools,
        {
          onChunk,
          onToolCall,
          onReasoning,
          onToolResult,
          onStepFinish,
          signal: streamAbortController.signal,
        },
      )
      const resolved = await usage

      recordUsage({
        provider: "orcarouter",
        model: this.modelName,
        inputTokens: resolved.inputTokens ?? 0,
        outputTokens: resolved.outputTokens ?? 0,
        cachedInputTokens: resolved.inputTokenDetails?.cacheReadTokens ?? 0,
        totalTokens: resolved.totalTokens ?? 0,
        costUsd: computeCost(this.modelName, resolved.inputTokens ?? 0, resolved.outputTokens ?? 0, resolved.inputTokenDetails?.cacheReadTokens ?? 0),
        durationMs: null,
      })

      return {
        content,
        finishReason: "stop" as FinishReason,
        usage: resolved,
      }
    } catch (error: any) {
      if (error?.name === "AbortError") throw error
      const msg = error instanceof Error ? error.message : String(error)
      const is5xx = /OrcaRouter (?:API )?5\d\d/.test(msg) || /status code 5\d\d/i.test(msg)
      if (is5xx) {
        const friendly = new Error(
          `OrcaRouter gateway error (HTTP 5xx). This is upstream — not your request. ` +
          `Try again, or run /model to switch providers.\n  ${msg}`,
        )
        console.error(chalk.red("OrcaRouter Service Error:"), friendly.message)
        throw friendly
      }
      console.error(chalk.red("OrcaRouter Service Error:"), msg)
      throw error
    } finally {
      clearTimeout(streamTimeout)
      if (signalHandler) signal!.removeEventListener("abort", signalHandler as any)
    }
  }

  async getMessage(messages: ModelMessage[], tools?: any) {
    let fullResponse = ""
    const result = await this.sendMessage(messages, (chunk) => {
      fullResponse += chunk
    })
    return result.content
  }
}
