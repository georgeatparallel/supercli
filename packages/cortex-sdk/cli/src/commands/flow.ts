import type { ModuleId } from "../catalog"
import { getModule, MODULES, configKey } from "../catalog"
import type { ConfigModule } from "../config"
import type { TuiContext } from "../tui/renderer"
import { promptSelect, type SelectOption } from "../tui/select"
import { promptMultiSelect } from "../tui/multiselect"
import { promptInput } from "../tui/input"

export interface InstallSelection {
  modules: ModuleId[]
  entries: ConfigModule[]
}

export async function selectModules(tui: TuiContext): Promise<ModuleId[] | undefined> {
  const options: SelectOption[] = MODULES.map((m) => ({
    name: m.name,
    description: m.description,
    value: m.id,
  }))
  const result = await promptMultiSelect(tui, {
    title: "Which SDK modules to enable",
    subtitle: "Pick the modules you want to install",
    options,
  })
  if (result.cancelled) return undefined
  return result.selected as ModuleId[]
}

export async function resolveModule(tui: TuiContext, moduleId: ModuleId): Promise<ConfigModule | undefined> {
  const module = getModule(moduleId)
  if (!module) return undefined

  // voice needs two providers (stt + tts); others need one
  if (moduleId === "voice") {
    return resolveVoice(tui)
  }

  if (module.providers.length === 0) {
    // no providers to configure (e.g. mcp stub)
    return { name: configKey(module.id), config: {} }
  }

  const provider = await promptSelect(tui, {
    title: `Select a ${module.name} provider`,
    subtitle: module.description,
    options: module.providers.map((p) => ({
      name: p.name,
      description: p.description,
      value: p.id,
    })),
  })
  if (!provider) return undefined

  const providerDef = module.providers.find((p) => p.id === provider)!
  return collectConfig(tui, module.id, provider, providerDef.needsKey, providerDef.defaultModel, providerDef.envKey)
}

async function resolveVoice(tui: TuiContext): Promise<ConfigModule | undefined> {
  const stt = await promptSelect(tui, {
    title: "Select a speech-to-text provider",
    subtitle: "STT converts your voice into text",
    options: [
      { name: "Smallest.ai", description: "Pulse STT — primary provider", value: "smallest" },
      { name: "ElevenLabs", description: "Scribe STT", value: "elevenlabs" },
      { name: "Groq", description: "Whisper via Groq", value: "groq" },
    ],
  })
  if (!stt) return undefined

  const tts = await promptSelect(tui, {
    title: "Select a text-to-speech provider",
    subtitle: "TTS speaks the assistant's reply",
    options: [
      { name: "Smallest.ai", description: "TTS via Smallest", value: "smallest" },
      { name: "ElevenLabs", description: "High-quality TTS", value: "elevenlabs" },
    ],
  })
  if (!tts) return undefined

  const config: Record<string, unknown> = {
    stt,
    tts,
  }

  const sttKey = await promptKey(tui, `Enter your ${stt} STT API key`, stt === "smallest" ? "SMALLEST_API_KEY" : stt === "elevenlabs" ? "ELEVENLABS_API_KEY" : "GROQ_API_KEY")
  if (sttKey === undefined) return undefined
  if (sttKey) config.sttApiKey = sttKey

  if (tts !== stt) {
    const ttsKey = await promptKey(tui, `Enter your ${tts} TTS API key`, tts === "smallest" ? "SMALLEST_API_KEY" : "ELEVENLABS_API_KEY")
    if (ttsKey === undefined) return undefined
    if (ttsKey) config.ttsApiKey = ttsKey
  } else if (config.sttApiKey) {
    config.ttsApiKey = config.sttApiKey
  }

  return { name: "voice", config }
}

export async function collectConfig(
  tui: TuiContext,
  moduleId: ModuleId,
  providerId: string,
  needsKey: boolean,
  defaultModel?: string,
  envKey?: string,
): Promise<ConfigModule | undefined> {
  const config: Record<string, unknown> = { provider: providerId }
  if (defaultModel) config.model = defaultModel

  if (needsKey) {
    const key = await promptKey(tui, `Enter your API key for ${providerId}`, envKey)
    if (key === undefined) return undefined
    if (key) config.apiKey = key
  }

  return { name: configKey(moduleId), config }
}

export async function promptKey(tui: TuiContext, title: string, envKey?: string): Promise<string | undefined> {
  const result = await promptInput(tui, {
    title,
    subtitle: envKey ? `Leave empty to use the ${envKey} environment variable` : "Leave empty to skip",
    placeholder: envKey ? `e.g. ${envKey.toLowerCase()}_...` : undefined,
    secure: true,
  })
  if (result.cancelled) return undefined
  return result.value
}
