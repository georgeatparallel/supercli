// Shared SSE stream handler for OpenAI-compatible chat completions.
// Used by every server provider path (openrouter, nvidia, mergedev,
// orcarouter, concentrateai, supercode) so MiniMax-style inline tool
// descriptors and reasoning deltas are handled the same way regardless
// of model, tier, or environment.

import type { Response } from "express"
import {
  parseStreamedContent,
  KNOWN_TOOL_NAMES,
  type EmbeddedToolCall,
} from "./embedded-tool-calls"

/** Built-in tools + any request-scoped names (MCP, custom). */
export function mergeKnownTools(extra?: Iterable<string> | null): Set<string> {
  const set = new Set(KNOWN_TOOL_NAMES)
  if (extra) {
    for (const name of extra) {
      if (name) set.add(name)
    }
  }
  return set
}

export interface StreamUsage {
  inputTokens: number
  outputTokens: number
}

export interface StreamChatResult {
  fullContent: string
  reasoningContent: string
  emittedToolCalls: boolean
  usage: StreamUsage
}

// Structural type: callers pass `response.body.getReader()` whose concrete
// type varies across runtimes (Bun vs DOM libs disagree on `readMany`).
export interface StreamReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>
}

export interface StreamChatOptions {
  res: Response
  reader: StreamReader
  /** When true, also accept reasoning-only empty turns without erroring. */
  surfaceReasoningAsText?: boolean
  /** Extra tool names to accept in bare-JSON descriptors (e.g. MCP tools). */
  knownTools?: Set<string>
}

/**
 * Read an OpenAI-compatible SSE body, write NDJSON events to `res`, and
 * return summary stats. Handles:
 *   - delta.content (with embedded MiniMax/Kimi tool-call recovery)
 *   - delta.reasoning / delta.reasoning_content
 *   - delta.tool_calls (structured, streamed args)
 *   - finish_reason tool_calls flush + EOF flush of pending calls
 */
export async function streamOpenAICompatibleChat(
  opts: StreamChatOptions,
): Promise<StreamChatResult> {
  const { res, reader, knownTools } = opts
  const decoder = new TextDecoder()
  let buffer = ""
  let inputTokens = 0
  let outputTokens = 0
  let fullContent = ""
  let reasoningContent = ""
  let sawToolCalls = false
  let emittedToolCalls = false
  let pendingToolCalls: Record<number, { id: string; name: string; args: string }> = {}
  const embedded = parseStreamedContent({
    knownTools: mergeKnownTools(knownTools),
  })
  const emittedKeys = new Set<string>()

  const emitToolCall = (name: string, args: Record<string, unknown>, id?: string) => {
    const key = `${name}:${JSON.stringify(args)}`
    if (emittedKeys.has(key)) return
    emittedKeys.add(key)
    sawToolCalls = true
    emittedToolCalls = true
    res.write(
      JSON.stringify({
        type: "tool-call",
        toolName: name,
        args,
        toolCallId: id || `call_${Date.now()}_${emittedKeys.size}`,
      }) + "\n",
    )
  }

  const flushPending = () => {
    for (const [, call] of Object.entries(pendingToolCalls)) {
      if (call.name && call.args) {
        try {
          const parsed = JSON.parse(call.args)
          emitToolCall(call.name, parsed, call.id || undefined)
        } catch {
          /* skip malformed args */
        }
      }
    }
    pendingToolCalls = {}
  }

  const emitEmbedded = (calls: EmbeddedToolCall[]) => {
    for (const call of calls) {
      emitToolCall(call.name, call.args, call.id || undefined)
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith("data: ")) continue
        const jsonStr = trimmed.slice(6)
        if (jsonStr === "[DONE]") break
        try {
          const data = JSON.parse(jsonStr)
          const delta = data.choices?.[0]?.delta

          if (delta?.content) {
            const blk = embedded.push(String(delta.content))
            if (blk.text) {
              fullContent += blk.text
              res.write(JSON.stringify({ type: "text", content: blk.text }) + "\n")
            }
            emitEmbedded(blk.calls)
          }

          const reasoningChunk = delta?.reasoning_content || delta?.reasoning
          if (reasoningChunk) {
            reasoningContent += reasoningChunk
            res.write(JSON.stringify({ type: "reasoning", content: reasoningChunk }) + "\n")
          }

          if (delta?.tool_calls) {
            sawToolCalls = true
            for (const tc of delta.tool_calls) {
              const index = tc.index ?? 0
              if (!pendingToolCalls[index]) {
                pendingToolCalls[index] = { id: "", name: "", args: "" }
              }
              if (tc.id) pendingToolCalls[index].id = tc.id
              if (tc.function?.name) pendingToolCalls[index].name = tc.function.name
              if (tc.function?.arguments) pendingToolCalls[index].args += tc.function.arguments
            }
          }

          const finishReason = data.choices?.[0]?.finish_reason
          if (finishReason === "tool_calls") {
            sawToolCalls = true
            flushPending()
          }

          if (data.usage) {
            inputTokens = data.usage.prompt_tokens ?? 0
            outputTokens = data.usage.completion_tokens ?? 0
          }
        } catch {
          /* skip malformed */
        }
      }

      // Stream can end with [DONE]/EOF without finish_reason tool_calls.
      if (sawToolCalls && Object.keys(pendingToolCalls).length > 0) {
        flushPending()
      }
    }
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      res.write(
        JSON.stringify({
          type: "error",
          message: `Upstream failure: ${err?.message ?? String(err)}`,
        }) + "\n",
      )
    }
  }

  // Release trailing prose / completed embedded descriptors.
  const flushed = embedded.flush()
  if (flushed.text) {
    fullContent += flushed.text
    res.write(JSON.stringify({ type: "text", content: flushed.text }) + "\n")
  }
  emitEmbedded(flushed.calls)

  // Final pending structured tool calls (if any remain).
  if (Object.keys(pendingToolCalls).length > 0) flushPending()

  return {
    fullContent,
    reasoningContent,
    emittedToolCalls,
    usage: { inputTokens, outputTokens },
  }
}

/**
 * Parse a non-streaming OpenAI chat completion message into clean text +
 * tool calls (structured + embedded). Writes events to `res`.
 */
export function emitFromNonStreamingMessage(
  res: Response,
  message: any,
  reasoningFallback = "",
  knownTools?: Set<string>,
): { fullContent: string; emittedToolCalls: boolean } {
  let fullContent = ""
  let emittedToolCalls = false
  const content = message?.content ?? message?.reasoning_content ?? ""

  if (content) {
    const parser = parseStreamedContent({
      knownTools: mergeKnownTools(knownTools),
    })
    const blk = parser.push(String(content))
    const flushed = parser.flush()
    const cleanText = `${blk.text}${flushed.text}`
    if (cleanText) {
      fullContent = cleanText
      res.write(JSON.stringify({ type: "text", content: cleanText }) + "\n")
    }
    for (const call of [...blk.calls, ...flushed.calls]) {
      emittedToolCalls = true
      res.write(
        JSON.stringify({
          type: "tool-call",
          toolName: call.name,
          args: call.args,
          toolCallId: call.id || `call_fb_${Date.now()}`,
        }) + "\n",
      )
    }
  } else if (reasoningFallback.trim()) {
    fullContent = reasoningFallback
    res.write(JSON.stringify({ type: "text", content: reasoningFallback }) + "\n")
  }

  const toolCalls = message?.tool_calls
  if (Array.isArray(toolCalls)) {
    for (const tc of toolCalls) {
      const name = tc?.function?.name
      if (!name) continue
      let args: Record<string, unknown> = {}
      try {
        args =
          typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : (tc.function.arguments ?? {})
      } catch {
        /* leave empty */
      }
      emittedToolCalls = true
      res.write(
        JSON.stringify({
          type: "tool-call",
          toolName: name,
          args,
          toolCallId: tc.id || `call_fb_${Date.now()}`,
        }) + "\n",
      )
    }
  }

  return { fullContent, emittedToolCalls }
}

export function writeFinish(
  res: Response,
  opts: {
    emittedToolCalls: boolean
    inputTokens: number
    outputTokens: number
  },
) {
  const { emittedToolCalls, inputTokens, outputTokens } = opts
  res.write(
    JSON.stringify({
      type: "finish",
      reason: emittedToolCalls ? "tool_calls" : "stop",
      usage: {
        inputTokens,
        outputTokenDetails: { textTokens: outputTokens, reasoningTokens: 0 },
        outputTokens,
        inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        totalTokens: inputTokens + outputTokens,
      },
    }) + "\n",
  )
  res.end()
}
