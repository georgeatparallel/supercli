import { z } from "zod"

export const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
})

export const providerSchema = z.enum([
  "google",
  "openrouter",
  "minimax",
  "nvidia",
  "mergedev",
  "orcarouter",
  "concentrateai",
])

export const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
  provider: providerSchema.optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  conversationId: z.string().optional(),
  profile: z.string().optional(),
  projectDoc: z.string().optional(),
})

export const generateObjectRequestSchema = z.object({
  messages: z.array(messageSchema),
  provider: providerSchema.optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().optional(),
  responseFormat: z.enum(["json", "text"]).optional(),
})

export const usageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
})

export const chatChunkSchema = z.object({
  type: z.literal("text-delta"),
  textDelta: z.string(),
})

export const finishChunkSchema = z.object({
  type: z.literal("finish"),
  finishReason: z.string(),
  usage: usageSchema,
})

export const streamChunkSchema = z.discriminatedUnion("type", [
  chatChunkSchema,
  finishChunkSchema,
])

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
  service: z.string(),
})

export const userResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  image: z.string().nullable(),
})

export const apiErrorSchema = z.object({
  error: z.string(),
})
