import type { SttProvider, TtsProvider, VoiceConfig } from "../core/types"
import { STT_PROVIDERS, transcribe as sttTranscribe } from "./stt"
import { TTS_PROVIDERS, synthesize as ttsSynthesize } from "./tts"
import type { SttResult, TtsResult, VoiceClient } from "./types"

export type { SttResult, TtsResult, VoiceClient } from "./types"
export type { SttProvider, TtsProvider, VoiceConfig } from "../core/types"

export function createVoice(options: VoiceConfig = {}): VoiceClient {
  return new VoiceClientImpl(options)
}

class VoiceClientImpl implements VoiceClient {
  constructor(private readonly options: VoiceConfig) {}

  async transcribe(audio: Buffer, provider?: SttProvider): Promise<SttResult> {
    const stt = provider ?? this.options.stt ?? "smallest"
    return sttTranscribe(audio, stt, {
      apiKey: this.options.sttApiKey,
      model: this.options.sttModel,
      language: this.options.sttLanguage,
      fetch: this.options.fetch,
    })
  }

  async synthesize(
    text: string,
    voice?: string,
    provider?: TtsProvider,
  ): Promise<TtsResult> {
    const tts = provider ?? this.options.tts ?? "smallest"
    return ttsSynthesize(text, tts, {
      apiKey: this.options.ttsApiKey,
      model: this.options.ttsModel,
      voice: voice ?? this.options.voice,
      fetch: this.options.fetch,
    })
  }

  listSttProviders(): SttProvider[] {
    return [...STT_PROVIDERS]
  }

  listTtsProviders(): TtsProvider[] {
    return [...TTS_PROVIDERS]
  }
}
