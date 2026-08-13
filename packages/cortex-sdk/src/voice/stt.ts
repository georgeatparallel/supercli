import { SdkError } from "../core/errors"
import type { FetchLike, SttProvider } from "../core/types"
import { transcribeElevenLabs } from "./elevenlabs"
import { transcribeGroq } from "./groq"
import { transcribeSmallest } from "./smallest"
import type { SttResult } from "./types"

export interface SttConfig {
  apiKey?: string
  model?: string
  language?: string
  baseURL?: string
  fetch?: FetchLike
}

export const STT_PROVIDERS: SttProvider[] = ["smallest", "elevenlabs", "groq"]

export function isSttProvider(value: unknown): value is SttProvider {
  return typeof value === "string" && (STT_PROVIDERS as string[]).includes(value)
}

export async function transcribe(
  audio: Buffer,
  provider: SttProvider,
  config: SttConfig = {},
): Promise<SttResult> {
  switch (provider) {
    case "smallest":
      return transcribeSmallest(audio, {
        apiKey: requireKey("smallest", config.apiKey, [
          "SMALLEST_API_KEY",
          "SMALLEST_AI_API_KEY",
        ]),
        model: config.model ?? process.env.SMALLEST_MODEL ?? process.env.SMALLEST_AI_STT_MODEL,
        language: config.language ?? process.env.STT_LANGUAGE ?? "en",
        baseURL: config.baseURL,
        fetch: config.fetch,
      })
    case "elevenlabs":
      return transcribeElevenLabs(audio, {
        apiKey: requireKey("elevenlabs", config.apiKey, ["ELEVENLABS_API_KEY"]),
        model: config.model ?? process.env.ELEVENLABS_STT_MODEL ?? "scribe_v1",
        language: config.language ?? process.env.STT_LANGUAGE,
        baseURL: config.baseURL,
        fetch: config.fetch,
      })
    case "groq":
      return transcribeGroq(audio, {
        apiKey: requireKey("groq", config.apiKey, ["GROQ_API_KEY"]),
        model: config.model ?? process.env.GROQ_MODEL,
        baseURL: config.baseURL,
        fetch: config.fetch,
      })
    default:
      throw new SdkError(`Unknown STT provider: ${String(provider)}`, {
        code: "UNKNOWN_PROVIDER",
      })
  }
}

function requireKey(
  provider: string,
  configKey: string | undefined,
  envNames: string[],
): string {
  const key = configKey ?? envNames.map((n) => process.env[n]).find(Boolean)
  if (!key) {
    throw new SdkError(`${provider} STT: no API key configured`, {
      code: "NOT_CONFIGURED",
    })
  }
  return key
}
