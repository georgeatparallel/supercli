import { SdkError } from "../core/errors"
import type { FetchLike } from "../core/types"
import type { SttResult, TtsResult } from "./types"

export interface ElevenLabsSttOptions {
  apiKey: string
  model?: string
  language?: string
  baseURL?: string
  fetch?: FetchLike
}

export interface ElevenLabsTtsOptions {
  apiKey: string
  model?: string
  voiceId?: string
  baseURL?: string
  fetch?: FetchLike
}

export const ELEVENLABS_STT_DEFAULT_MODEL = "scribe_v1"
export const ELEVENLABS_TTS_DEFAULT_MODEL = "eleven_turbo_v2_5"
export const ELEVENLABS_DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

function resolveFetch(options: { fetch?: FetchLike }): FetchLike {
  return options.fetch ?? ((input, init) => fetch(input, init))
}

export async function transcribeElevenLabs(
  audio: Buffer,
  options: ElevenLabsSttOptions,
): Promise<SttResult> {
  const baseURL = (options.baseURL ?? ELEVENLABS_BASE_URL).replace(/\/$/, "")
  const url = `${baseURL}/speech-to-text`
  const doFetch = resolveFetch(options)

  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "audio.wav")
  form.append("model_id", options.model ?? ELEVENLABS_STT_DEFAULT_MODEL)
  if (options.language) form.append("language", options.language)

  let res: Response
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: { "xi-api-key": options.apiKey },
      body: form,
    })
  } catch (err) {
    throw new SdkError(
      `ElevenLabs STT request failed: ${(err as Error).message}`,
      { code: "VOICE_STT_FAILED" },
    )
  }

  const body = await res.text()
  if (!res.ok) {
    throw new SdkError(`ElevenLabs STT error ${res.status}: ${body}`, {
      code: "VOICE_STT_FAILED",
    })
  }

  let data: { text?: string }
  try {
    data = JSON.parse(body) as { text?: string }
  } catch {
    throw new SdkError(`ElevenLabs STT invalid JSON: ${body}`, {
      code: "VOICE_STT_FAILED",
    })
  }

  if (!data.text) {
    throw new SdkError("ElevenLabs STT returned empty text", {
      code: "VOICE_STT_FAILED",
    })
  }
  return { text: data.text }
}

export async function synthesizeElevenLabs(
  text: string,
  options: ElevenLabsTtsOptions,
): Promise<TtsResult> {
  const baseURL = (options.baseURL ?? ELEVENLABS_BASE_URL).replace(/\/$/, "")
  const voiceId = options.voiceId ?? ELEVENLABS_DEFAULT_VOICE_ID
  const url = `${baseURL}/text-to-speech/${voiceId}/stream`
  const doFetch = resolveFetch(options)

  let res: Response
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": options.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: options.model ?? ELEVENLABS_TTS_DEFAULT_MODEL,
      }),
    })
  } catch (err) {
    throw new SdkError(
      `ElevenLabs TTS request failed: ${(err as Error).message}`,
      { code: "VOICE_TTS_FAILED" },
    )
  }

  if (!res.ok) {
    const body = await res.text()
    throw new SdkError(`ElevenLabs TTS error ${res.status}: ${body}`, {
      code: "VOICE_TTS_FAILED",
    })
  }

  const audio = Buffer.from(await res.arrayBuffer())
  if (audio.length === 0) {
    throw new SdkError("ElevenLabs TTS returned empty audio", {
      code: "VOICE_TTS_FAILED",
    })
  }
  return { audio, format: "mp3" }
}
