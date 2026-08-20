import { expect, test } from "bun:test"
import type { ModelMessage } from "ai"
import { stripOrphanToolCalls } from "../sanitize-messages"

test("keeps paired assistant tool calls and tool results", () => {
  const messages = [
    { role: "user", content: "check status" },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "run_command", arguments: "{\"command\":\"git status\"}" },
        },
      ],
    },
    { role: "tool", tool_call_id: "call_1", content: "ok" },
  ] as unknown as ModelMessage[]

  expect(stripOrphanToolCalls(messages)).toEqual(messages)
})

test("strips stale assistant tool calls while preserving assistant prose", () => {
  const messages = [
    { role: "user", content: "check status" },
    {
      role: "assistant",
      content: "I will check.",
      tool_calls: [
        {
          id: "call_missing",
          type: "function",
          function: { name: "run_command", arguments: "{\"command\":\"git status\"}" },
        },
      ],
    },
  ] as unknown as ModelMessage[]

  expect(stripOrphanToolCalls(messages)).toEqual([
    { role: "user", content: "check status" },
    { role: "assistant", content: "I will check." },
  ])
})

test("drops stray tool results without a retained assistant call before them", () => {
  const messages = [
    { role: "tool", tool_call_id: "call_1", content: "orphan result" },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "run_command", arguments: "{\"command\":\"git status\"}" },
        },
      ],
    },
  ] as unknown as ModelMessage[]

  expect(stripOrphanToolCalls(messages)).toEqual([])
})
