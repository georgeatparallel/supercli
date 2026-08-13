import { describe, expect, test } from "bun:test"
import { SdkError } from "../core/errors"
import type { VoiceConfig } from "../core/types"
import { createVoice } from "./index"
import { isSttProvider, STT_PROVIDERS, transcribe } from "./stt"
import { isTtsProvider, TTS_PROVIDERS, synthesize } from "./tts"

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function makeVoice(overrides: Partial<VoiceConfig> = {}): ReturnType<typeof createVoice> {
  return createVoice({
    stt: "smallest",
    tts: "elevenlabs",
    sttApiKey: "stt-key",
    ttsApiKey: "tts-key",
    ...overrides,
  })
}

const AUDIO = Buffer.from("fake-audio-bytes")

describe("createVoice", () => {
  test("listSttProviders and listTtsProviders return known providers", () => {
    const voice = makeVoice()
    expect(voice.listSttProviders()).toEqual(["smallest", "elevenlabs", "groq"])
    expect(voice.listTtsProviders()).toEqual(["smallest", "elevenlabs"])
  })

  test("transcribe routes to smallest STT and returns text", async () => {
    const voice = makeVoice({
      fetch: (async (url, init) => {
        expect(String(url)).toBe(
          "https://api.smallest.ai/v1/speech-to-text/transcribe",
        )
        expect((init?.headers as Record<string, string>).Authorization).toBe(
          "Bearer stt-key",
        )
        return jsonResponse({ text: "hello world" })
      }) as VoiceConfig["fetch"],
    })
    const result = await voice.transcribe(AUDIO)
    expect(result.text).toBe("hello world")
  })

  test("transcribe falls back to default smallest provider", async () => {
    const voice = makeVoice({
      stt: undefined,
      fetch: (async () => jsonResponse({ text: "default" })) as VoiceConfig["fetch"],
    })
    const result = await voice.transcribe(AUDIO)
    expect(result.text).toBe("default")
  })

  test("synthesize routes to elevenlabs TTS with voice id and returns mp3", async () => {
    const voice = makeVoice({
      fetch: (async (url, init) => {
        expect(String(url)).toBe(
          "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream",
        )
        expect((init?.headers as Record<string, string>)["xi-api-key"]).toBe(
          "tts-key",
        )
        const body = JSON.parse(String(init?.body)) as { text: string; model_id: string }
        expect(body.text).toBe("hi")
        expect(body.model_id).toBe("eleven_turbo_v2_5")
        return new Response(Buffer.from("mp3-bytes"), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        })
      }) as VoiceConfig["fetch"],
    })
    const result = await voice.synthesize("hi")
    expect(result.format).toBe("mp3")
    expect(result.audio.toString()).toBe("mp3-bytes")
  })

  test("synthesize accepts explicit provider and voice overrides", async () => {
    const voice = makeVoice({
      fetch: (async (url) => {
        expect(String(url)).toBe(
          "https://api.smallest.ai/v1/lightning/speech-synthesis",
        )
        return new Response(Buffer.from("pcm-bytes"), {
          status: 200,
          headers: { "Content-Type": "audio/pcm" },
        })
      }) as VoiceConfig["fetch"],
    })
    const result = await voice.synthesize("hey", undefined, "smallest")
    expect(result.format).toBe("pcm")
    expect(result.audio.toString()).toBe("pcm-bytes")
  })

  test("transcribe throws SdkError when stt provider has no key", async () => {
    const voice = createVoice({
      stt: "groq",
      fetch: (async () => jsonResponse({ text: "x" })) as VoiceConfig["fetch"],
    })
    try {
      await voice.transcribe(AUDIO)
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(SdkError)
      expect((err as SdkError).code).toBe("NOT_CONFIGURED")
    }
  })

  test("transcribe throws SdkError on HTTP error", async () => {
    const voice = makeVoice({
      fetch: (async () => jsonResponse({ error: "boom" }, 500)) as VoiceConfig["fetch"],
    })
    try {
      await voice.transcribe(AUDIO)
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(SdkError)
      expect((err as SdkError).code).toBe("VOICE_STT_FAILED")
    }
  })

  test("synthesize throws SdkError on empty audio", async () => {
    const voice = makeVoice({
      fetch: (async () => new Response(new ArrayBuffer(0), { status: 200 })) as VoiceConfig["fetch"],
    })
    try {
      await voice.synthesize("hi")
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(SdkError)
      expect((err as SdkError).code).toBe("VOICE_TTS_FAILED")
    }
  })
})

describe("stt dispatcher", () => {
  test("STT_PROVIDERS and isSttProvider work", () => {
    expect(STT_PROVIDERS).toEqual(["smallest", "elevenlabs", "groq"])
    expect(isSttProvider("smallest")).toBe(true)
    expect(isSttProvider("unknown")).toBe(false)
    expect(isSttProvider(123)).toBe(false)
  })

  test("transcribe groq posts to openai-compatible endpoint", async () => {
    const result = await transcribe(
      AUDIO,
      "groq",
      {
        apiKey: "g-key",
        fetch: (async (url, init) => {
          expect(String(url)).toBe(
            "https://api.groq.com/openai/v1/audio/transcriptions",
          )
          expect((init?.headers as Record<string, string>).Authorization).toBe(
            "Bearer g-key",
          )
          return jsonResponse({ text: "transcribed" })
        }) as VoiceConfig["fetch"],
      },
    )
    expect(result.text).toBe("transcribed")
  })

  test("transcribe with unknown provider throws UNKNOWN_PROVIDER", async () => {
    try {
      await transcribe(AUDIO, "bogus" as never)
      expect.unreachable()
    } catch (err) {
      expect((err as SdkError).code).toBe("UNKNOWN_PROVIDER")
    }
  })
})

describe("tts dispatcher", () => {
  test("TTS_PROVIDERS and isTtsProvider work", () => {
    expect(TTS_PROVIDERS).toEqual(["smallest", "elevenlabs"])
    expect(isTtsProvider("elevenlabs")).toBe(true)
    expect(isTtsProvider("groq")).toBe(false)
  })

  test("synthesize elevenlabs posts with model_id and xi-api-key", async () => {
    const result = await synthesize(
      "hello",
      "elevenlabs",
      {
        apiKey: "e-key",
        fetch: (async (url, init) => {
          expect(String(url)).toBe(
            "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream",
          )
          expect((init?.headers as Record<string, string>)["xi-api-key"]).toBe(
            "e-key",
          )
          return new Response(Buffer.from("mp3"), {
            status: 200,
            headers: { "Content-Type": "audio/mpeg" },
          })
        }) as VoiceConfig["fetch"],
      },
    )
    expect(result.format).toBe("mp3")
  })

  test("synthesize with unknown provider throws UNKNOWN_PROVIDER", async () => {
    try {
      await synthesize("x", "bogus" as never)
      expect.unreachable()
    } catch (err) {
      expect((err as SdkError).code).toBe("UNKNOWN_PROVIDER")
    }
  })
})
