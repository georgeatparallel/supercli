import { SdkError } from "../core/errors"
import type { FetchLike, TtsProvider } from "../core/types"
import { synthesizeElevenLabs } from "./elevenlabs"
import { synthesizeSmallest } from "./smallest"
import type { TtsResult } from "./types"

export interface TtsConfig {
  apiKey?: string
  model?: string
  voice?: string
  baseURL?: string
  fetch?: FetchLike
}

export const TTS_PROVIDERS: TtsProvider[] = ["smallest", "elevenlabs"]

export function isTtsProvider(value: unknown): value is TtsProvider {
  return typeof value === "string" && (TTS_PROVIDERS as string[]).includes(value)
}

export async function synthesize(
  text: string,
  provider: TtsProvider,
  config: TtsConfig = {},
): Promise<TtsResult> {
  switch (provider) {
    case "smallest":
      return synthesizeSmallest(text, {
        apiKey: requireKey("smallest", config.apiKey, [
          "SMALLEST_API_KEY",
          "SMALLEST_AI_API_KEY",
        ]),
        model: config.model ?? process.env.SMALLEST_AI_TTS_MODEL,
        baseURL: config.baseURL,
        fetch: config.fetch,
      })
    case "elevenlabs":
      return synthesizeElevenLabs(text, {
        apiKey: requireKey("elevenlabs", config.apiKey, ["ELEVENLABS_API_KEY"]),
        model: config.model ?? process.env.ELEVENLABS_TTS_MODEL ?? "eleven_turbo_v2_5",
        voiceId: config.voice ?? process.env.ELEVENLABS_VOICE_ID,
        baseURL: config.baseURL,
        fetch: config.fetch,
      })
    default:
      throw new SdkError(`Unknown TTS provider: ${String(provider)}`, {
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
    throw new SdkError(`${provider} TTS: no API key configured`, {
      code: "NOT_CONFIGURED",
    })
  }
  return key
}
