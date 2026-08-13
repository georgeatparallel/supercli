import { SdkError } from "../core/errors"
import type { FetchLike } from "../core/types"
import type { SttResult } from "./types"

export interface GroqSttOptions {
  apiKey: string
  model?: string
  baseURL?: string
  fetch?: FetchLike
}

export const GROQ_STT_DEFAULT_MODEL = "whisper-large-v3-turbo"

const GROQ_BASE_URL = "https://api.groq.com/openai/v1"

function resolveFetch(options: { fetch?: FetchLike }): FetchLike {
  return options.fetch ?? ((input, init) => fetch(input, init))
}

export async function transcribeGroq(
  audio: Buffer,
  options: GroqSttOptions,
): Promise<SttResult> {
  const baseURL = (options.baseURL ?? GROQ_BASE_URL).replace(/\/$/, "")
  const url = `${baseURL}/audio/transcriptions`
  const doFetch = resolveFetch(options)

  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "audio.wav")
  form.append("model", options.model ?? GROQ_STT_DEFAULT_MODEL)

  let res: Response
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey}` },
      body: form,
    })
  } catch (err) {
    throw new SdkError(
      `Groq STT request failed: ${(err as Error).message}`,
      { code: "VOICE_STT_FAILED" },
    )
  }

  const body = await res.text()
  if (!res.ok) {
    throw new SdkError(`Groq STT error ${res.status}: ${body}`, {
      code: "VOICE_STT_FAILED",
    })
  }

  let data: { text?: string }
  try {
    data = JSON.parse(body) as { text?: string }
  } catch {
    throw new SdkError(`Groq STT invalid JSON: ${body}`, {
      code: "VOICE_STT_FAILED",
    })
  }

  if (!data.text) {
    throw new SdkError("Groq STT returned empty text", {
      code: "VOICE_STT_FAILED",
    })
  }
  return { text: data.text }
}
