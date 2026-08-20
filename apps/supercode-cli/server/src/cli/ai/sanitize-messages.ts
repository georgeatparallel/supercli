// Sanitize ModelMessage arrays before forwarding them to an upstream model API.
//
// Some OpenAI-compatible providers (notably ConcentrateAI) 400 with
// `invalid_prompt: function_call ... is missing a corresponding
// function_call_output` when the messages array contains an assistant
// message with `tool_calls` but no following `role: "tool"` message whose
// `tool_call_id` matches one of those `tool_calls[i].id`. The condition
// is easy to enter — a previous turn streamed `tool-call` events but
// errored/closed before the matching tool result was emitted, the chat
// UI dropped/stripped tool messages during compaction or history replay
// (formatMessagesForAI flattens them to prose), or a stale conversation
// snapshot was re-sent mid-turn.
//
// This helper removes stale assistant `tool_calls` that do not have a matching
// later `tool` result, and drops stray `tool` messages that do not have a
// retained assistant call before them. Roles other than `assistant`/`tool` are
// passed through as-is.

import type { ModelMessage } from "ai"

type AnyMsg = ModelMessage & Record<string, unknown>

function asToolCalls(msg: AnyMsg): Array<{ id?: unknown }> | null {
  const tc = msg.tool_calls
  if (!Array.isArray(tc)) return null
  return tc as Array<{ id?: unknown }>
}

function toolId(msg: AnyMsg): string | null {
  if (msg.role !== "tool") return null
  const id = msg.tool_call_id
  return typeof id === "string" ? id : null
}

/**
 * Remove unpaired tool-call messages. Safe to call repeatedly.
 */
export function stripOrphanToolCalls(messages: ModelMessage[]): ModelMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return messages

  const keepAssistant = new Set<number>()
  const validToolIds = new Set<string>()
  const toolIdsAfter = new Set<string>()

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as AnyMsg | undefined
    if (!m) continue
    const id = toolId(m)
    if (id) {
      toolIdsAfter.add(id)
      continue
    }

    const tcs = asToolCalls(m)
    if (!tcs) continue
    const ids = tcs
      .map((tc) => (typeof tc.id === "string" ? tc.id : null))
      .filter((tcId): tcId is string => Boolean(tcId))
    if (ids.length === tcs.length && ids.every((tcId) => toolIdsAfter.has(tcId))) {
      keepAssistant.add(i)
      for (const tcId of ids) validToolIds.add(tcId)
    }
  }

  // Forward pass: preserve order, only keeping tool results after their
  // retained assistant call. If an invalid assistant had normal prose content,
  // keep the prose but strip the stale `tool_calls` field.
  const out: ModelMessage[] = []
  const activeToolIds = new Set<string>()
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as AnyMsg
    const tcs = asToolCalls(m)
    if (tcs) {
      if (!keepAssistant.has(i)) {
        if (typeof m.content === "string" && m.content.trim()) {
          const clone = { ...m }
          delete clone.tool_calls
          out.push(clone as ModelMessage)
        }
        continue
      }
      for (const tc of tcs) {
        if (typeof tc.id === "string") activeToolIds.add(tc.id)
      }
      out.push(m as ModelMessage)
      continue
    }

    const id = toolId(m)
    if (id) {
      if (!validToolIds.has(id) || !activeToolIds.has(id)) continue
      activeToolIds.delete(id)
      out.push(m as ModelMessage)
      continue
    }

    out.push(m as ModelMessage)
  }

  return out
}
