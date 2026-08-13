import { SdkError } from "../core/errors"
import type { FetchLike } from "../core/types"
import type { SttResult, TtsResult } from "./types"

export interface SmallestSttOptions {
  apiKey: string
  model?: string
  language?: string
  baseURL?: string
  fetch?: FetchLike
}

export interface SmallestTtsOptions {
  apiKey: string
  model?: string
  baseURL?: string
  fetch?: FetchLike
}

export const SMALLEST_STT_DEFAULT_MODEL = "pulse-pro"
export const SMALLEST_TTS_DEFAULT_MODEL = "lightning_v3.1_pro"

const SMALLEST_BASE_URL = "https://api.smallest.ai/v1"

function resolveFetch(options: { fetch?: FetchLike }): FetchLike {
  return options.fetch ?? ((input, init) => fetch(input, init))
}

export async function transcribeSmallest(
  audio: Buffer,
  options: SmallestSttOptions,
): Promise<SttResult> {
  const baseURL = (options.baseURL ?? SMALLEST_BASE_URL).replace(/\/$/, "")
  const url = `${baseURL}/speech-to-text/transcribe`
  const doFetch = resolveFetch(options)

  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "audio.wav")
  form.append("model", options.model ?? SMALLEST_STT_DEFAULT_MODEL)
  if (options.language) form.append("language", options.language)

  let res: Response
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey}` },
      body: form,
    })
  } catch (err) {
    throw new SdkError(
      `Smallest STT request failed: ${(err as Error).message}`,
      { code: "VOICE_STT_FAILED" },
    )
  }

  const body = await res.text()
  if (!res.ok) {
    throw new SdkError(`Smallest STT error ${res.status}: ${body}`, {
      code: "VOICE_STT_FAILED",
    })
  }

  let data: { text?: string; transcription?: string }
  try {
    data = JSON.parse(body) as { text?: string; transcription?: string }
  } catch {
    throw new SdkError(`Smallest STT invalid JSON: ${body}`, {
      code: "VOICE_STT_FAILED",
    })
  }

  const text = data.text ?? data.transcription ?? ""
  if (!text) {
    throw new SdkError("Smallest STT returned empty text", {
      code: "VOICE_STT_FAILED",
    })
  }
  return { text }
}

export async function synthesizeSmallest(
  text: string,
  options: SmallestTtsOptions,
): Promise<TtsResult> {
  const baseURL = (options.baseURL ?? SMALLEST_BASE_URL).replace(/\/$/, "")
  const url = `${baseURL}/lightning/speech-synthesis`
  const doFetch = resolveFetch(options)

  let res: Response
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, model: options.model ?? SMALLEST_TTS_DEFAULT_MODEL }),
    })
  } catch (err) {
    throw new SdkError(
      `Smallest TTS request failed: ${(err as Error).message}`,
      { code: "VOICE_TTS_FAILED" },
    )
  }

  if (!res.ok) {
    const body = await res.text()
    throw new SdkError(`Smallest TTS error ${res.status}: ${body}`, {
      code: "VOICE_TTS_FAILED",
    })
  }

  const audio = Buffer.from(await res.arrayBuffer())
  if (audio.length === 0) {
    throw new SdkError("Smallest TTS returned empty audio", {
      code: "VOICE_TTS_FAILED",
    })
  }
  return { audio, format: "pcm" }
}
