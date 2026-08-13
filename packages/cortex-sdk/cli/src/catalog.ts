export type ModuleId =
  | "gateway"
  | "web-search"
  | "voice"
  | "composio"
  | "agent-handler"
  | "mcp"

export interface Provider {
  id: string
  name: string
  description: string
  envKey?: string
  defaultModel?: string
  defaultBaseURL?: string
  needsKey: boolean
}

export interface Module {
  id: ModuleId
  name: string
  description: string
  providers: Provider[]
}

export const MODULES: Module[] = [
  {
    id: "gateway",
    name: "Gateway",
    description: "LLM gateway — chat, streaming, and tool calls over one OpenAI-compatible API",
    providers: [
      {
        id: "concentrateai",
        name: "Concentrate AI",
        description: "Aggregated model router",
        envKey: "CONCENTRATEAI_API_KEY",
        defaultModel: "deepseek/deepseek-v4-flash",
        defaultBaseURL: "https://api.concentrate.ai/v1",
        needsKey: true,
      },
      {
        id: "mergedev",
        name: "Merge Dev",
        description: "Multi-provider API gateway",
        envKey: "MERGEDEV_API_KEY",
        defaultModel: "anthropic/claude-opus-4-8",
        defaultBaseURL: "https://api-gateway.merge.dev/v1/openai",
        needsKey: true,
      },
      {
        id: "openrouter",
        name: "OpenRouter",
        description: "Unified access to 300+ models",
        envKey: "OPENROUTER_API_KEY",
        defaultModel: "moonshotai/kimi-k2.6",
        defaultBaseURL: "https://openrouter.ai/api/v1",
        needsKey: true,
      },
      {
        id: "gemini",
        name: "Google Gemini",
        description: "Gemini models via Generative Language API",
        envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
        defaultModel: "gemini-2.5-flash",
        needsKey: true,
      },
      {
        id: "minimax",
        name: "MiniMax",
        description: "MiniMax models",
        envKey: "MINIMAX_API_KEY",
        defaultModel: "MiniMax-M1",
        needsKey: true,
      },
      {
        id: "nim",
        name: "NVIDIA NIM",
        description: "NVIDIA-hosted open models",
        envKey: "NVIDIA_API_KEY",
        defaultModel: "minimaxai/minimax-m3",
        defaultBaseURL: "https://integrate.api.nvidia.com/v1",
        needsKey: true,
      },
      {
        id: "orcarouter",
        name: "Orca Router",
        description: "Budget LLM router",
        envKey: "ORCAROUTER_API_KEY",
        defaultModel: "openai/gpt-4o-mini",
        defaultBaseURL: "https://api.orcarouter.ai/v1",
        needsKey: true,
      },
      {
        id: "supercode-cloud",
        name: "SuperCode Cloud",
        description: "Hosted SuperCode gateway (no key required)",
        defaultModel: "deepseek-v4-flash",
        defaultBaseURL: "https://supercode-8w7e.onrender.com",
        needsKey: false,
      },
    ],
  },
  {
    id: "web-search",
    name: "Web Search",
    description: "Search tool providers — exa, firecrawl, context.dev",
    providers: [
      {
        id: "exa",
        name: "Exa",
        description: "Neural web search API",
        envKey: "EXA_API_KEY",
        needsKey: true,
      },
      {
        id: "firecrawl",
        name: "Firecrawl",
        description: "Crawl, scrape, and search the web",
        envKey: "FIRECRAWL_API_KEY",
        needsKey: true,
      },
      {
        id: "contextdev",
        name: "context.dev",
        description: "Context search engine",
        envKey: "CONTEXTDEV_API_KEY",
        needsKey: true,
      },
    ],
  },
  {
    id: "voice",
    name: "Voice",
    description: "Speech-to-text and text-to-speech providers",
    providers: [
      {
        id: "smallest",
        name: "Smallest.ai",
        description: "Pulse STT + TTS (primary STT provider)",
        envKey: "SMALLEST_API_KEY",
        needsKey: true,
      },
      {
        id: "elevenlabs",
        name: "ElevenLabs",
        description: "High-quality TTS + Scribe STT",
        envKey: "ELEVENLABS_API_KEY",
        needsKey: true,
      },
      {
        id: "groq",
        name: "Groq",
        description: "Whisper STT via Groq",
        envKey: "GROQ_API_KEY",
        needsKey: true,
      },
    ],
  },
  {
    id: "composio",
    name: "Composio",
    description: "Tool integrations for agents (GitHub, Gmail, Slack, ...)",
    providers: [
      {
        id: "composio",
        name: "Composio",
        description: "Tool integration platform",
        envKey: "COMPOSIO_API_KEY",
        needsKey: true,
      },
    ],
  },
  {
    id: "agent-handler",
    name: "Agent Handler",
    description: "Backend agent handler client (SuperCode or custom)",
    providers: [
      {
        id: "agent-handler",
        name: "Agent Handler",
        description: "HTTP/SSE agent client",
        envKey: "AGENT_HANDLER_API_KEY",
        needsKey: true,
      },
    ],
  },
  {
    id: "mcp",
    name: "MCP",
    description: "Model Context Protocol servers (coming soon)",
    providers: [],
  },
]

export function getModule(id: ModuleId): Module | undefined {
  return MODULES.find((m) => m.id === id)
}

export function configKey(moduleId: ModuleId): string {
  return moduleId.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

export function moduleFromKey(key: string): Module | undefined {
  return MODULES.find((m) => configKey(m.id) === key || m.id === key)
}

export function getProvider(moduleId: ModuleId, providerId: string): Provider | undefined {
  return getModule(moduleId)?.providers.find((p) => p.id === providerId)
}

export function findUnit(term: string): { module: Module; provider: Provider } | undefined {
  for (const module of MODULES) {
    for (const provider of module.providers) {
      if (provider.id === term || `${module.id}.${provider.id}` === term) {
        return { module, provider }
      }
    }
  }
  return undefined
}
