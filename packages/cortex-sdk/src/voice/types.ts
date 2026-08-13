import type { FetchLike, SttProvider, TtsProvider, VoiceConfig } from "../core/types"

export type { FetchLike, SttProvider, TtsProvider, VoiceConfig } from "../core/types"

export interface SttResult {
  text: string
  language?: string
}

export interface TtsResult {
  audio: Buffer
  format: "pcm" | "mp3"
}

export interface VoiceClient {
  transcribe(audio: Buffer, provider?: SttProvider): Promise<SttResult>
  synthesize(text: string, voice?: string, provider?: TtsProvider): Promise<TtsResult>
  listSttProviders(): SttProvider[]
  listTtsProviders(): TtsProvider[]
}
