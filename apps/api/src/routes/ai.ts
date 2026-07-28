import { Hono } from "hono"
import { z } from "zod"
import { stream } from "hono/streaming"
import { zValidator } from "@hono/zod-validator"
import { createStreamText, buildSystemPrompt } from "../providers"
import { authenticate } from "../middleware/auth"
import type { AppEnv } from "../types"
import type { ModelMessage } from "ai"

const chatBodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })),
  provider: z.string().optional().default("google"),
  model: z.string().optional().default("gemini-3-flash-preview"),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  conversationId: z.string().optional(),
  profile: z.string().optional(),
  projectDoc: z.string().optional(),
})

const generateObjectBodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })),
  provider: z.string().optional().default("google"),
  model: z.string().optional().default("gemini-3-flash-preview"),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().optional(),
  responseFormat: z.enum(["json", "text"]).optional().default("json"),
})

export const aiRoute = new Hono<AppEnv>()
  .post(
    "/ai/chat",
    authenticate,
    zValidator("json", chatBodySchema),
    async (c) => {
      const user = c.get("user")
      const body = c.req.valid("json")

      const coreMessages: ModelMessage[] = body.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }))

      const systemPrompt = buildSystemPrompt(body.profile, body.projectDoc)

      try {
        const result = await createStreamText({
          provider: body.provider,
          model: body.model,
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          maxTokens: body.maxTokens,
          temperature: body.temperature,
          topP: body.topP,
          messages: coreMessages,
          systemPrompt,
          conversationId: body.conversationId,
        })

        c.header("Content-Type", "application/x-ndjson")
        c.header("Cache-Control", "no-cache")
        c.header("Connection", "keep-alive")

        return stream(c, async (s) => {
          for await (const delta of result.textStream) {
            const chunk = JSON.stringify({ type: "text-delta", textDelta: delta }) + "\n"
            await s.write(chunk)
          }

          const finishReason = await result.finishReason
          const usage = await result.usage

          const finishChunk = JSON.stringify({
            type: "finish",
            finishReason,
            usage: {
              promptTokens: usage.inputTokens ?? 0,
              completionTokens: usage.outputTokens ?? 0,
              totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
            },
          }) + "\n"
          await s.write(finishChunk)
        })
      } catch (error: any) {
        const errorMessage = error?.message || "Unknown error"
        if (errorMessage.includes("Daily token limit")) {
          return c.json({ error: errorMessage }, 429)
        }
        console.error("[AI Chat Error]", error)
        return c.json({ error: errorMessage }, 500)
      }
    }
  )
  .post(
    "/ai/generate-object",
    authenticate,
    zValidator("json", generateObjectBodySchema),
    async (c) => {
      const user = c.get("user")
      const body = c.req.valid("json")

      const coreMessages: ModelMessage[] = body.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }))

      try {
        const result = await createStreamText({
          provider: body.provider,
          model: body.model,
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          temperature: body.temperature,
          messages: coreMessages,
          systemPrompt: "You are a helpful assistant that generates structured JSON responses.",
        })

        const text = await result.text
        return c.json({ object: text })
      } catch (error: any) {
        console.error("[AI Generate Object Error]", error)
        return c.json({ error: error?.message || "Unknown error" }, 500)
      }
    }
  )
