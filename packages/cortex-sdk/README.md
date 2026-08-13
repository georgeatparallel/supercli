# supercode-cortex

Unified SDK for building AI agents — 8 gateway providers, 3 web search providers, 6 MCP platforms, and 3 voice providers, plus a CLI to generate and manage your `cortex.config.ts`.

## Requirements

- [Bun](https://bun.sh) >= 1.2 for the interactive CLI (uses the OpenTUI native renderer)
- `ai` as a peer dependency (`^4.0.0 || ^5.0.0 || ^6.0.0`) for the library exports

## Install

```bash
bun add supercode-cortex
```

## CLI

Generate a `cortex.config.ts` in your project and manage it interactively:

```bash
supercode-cortex init              Interactive setup: pick modules and providers
supercode-cortex find              Browse providers and install them
supercode-cortex list              Show installed modules and available units
supercode-cortex add <unit>        Add a unit (e.g. gateway.openrouter)
supercode-cortex remove <unit>     Remove an installed unit
supercode-cortex update <unit>     Reconfigure an installed unit
supercode-cortex --help            Show help
supercode-cortex --version         Show version
```

Units are named `<module>.<provider>`, e.g. `gateway.openrouter`, `gateway.mergedev`, `web-search.exa`, `voice.smallest`. Run `supercode-cortex list` to see everything available.

The generated config is a plain TypeScript module of data-only exports:

```ts
export const gateway = { "provider": "openrouter", "model": "moonshotai/kimi-k2.6" }
export const webSearch = { "provider": "exa" }
export const voice = { "stt": "smallest", "tts": "smallest" }
```

Then import each export into the matching SDK factory.

## Modules

| Import path                    | Purpose                                        |
| ------------------------------ | ---------------------------------------------- |
| `supercode-cortex`             | Root exports + `SupercodeAgent` orchestration  |
| `supercode-cortex/gateway`     | `createGateway` — model access via 8 providers |
| `supercode-cortex/agent-handler` | `createAgentHandler` — MergeDev tool packs   |
| `supercode-cortex/composio`    | `createComposio` — 150+ app integrations       |
| `supercode-cortex/web-search`  | `createWebSearch` — Exa, Firecrawl, Context.dev |
| `supercode-cortex/mcp`         | `createMcpManager` — direct MCP connections    |
| `supercode-cortex/voice`       | `createVoice` — STT + TTS                      |

## Usage

```ts
import { createGateway } from "supercode-cortex/gateway"
import { gateway, webSearch, voice } from "./cortex.config"

const model = createGateway(gateway).model()
const search = createWebSearch(webSearch)
const voiceClient = createVoice(voice)
```

### Gateway providers

| Provider         | Env var                        | Default model                  |
| ---------------- | ------------------------------ | ------------------------------ |
| concentrateai    | `CONCENTRATEAI_API_KEY`        | `deepseek/deepseek-v4-flash`   |
| mergedev         | `MERGEDEV_API_KEY`             | `anthropic/claude-opus-4-8`    |
| openrouter       | `OPENROUTER_API_KEY`           | `moonshotai/kimi-k2.6`         |
| gemini           | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-2.5-flash`             |
| minimax          | `MINIMAX_API_KEY`              | `MiniMax-M1`                   |
| nim              | `NVIDIA_API_KEY`               | `minimaxai/minimax-m3`         |
| orcarouter       | `ORCAROUTER_API_KEY`           | `openai/gpt-4o-mini`           |
| supercode-cloud  | — (no key)                     | `deepseek-v4-flash`            |

### Web search

| Provider    | Env var              |
| ----------- | -------------------- |
| exa         | `EXA_API_KEY`        |
| firecrawl   | `FIRECRAWL_API_KEY`  |
| contextdev  | `CONTEXTDEV_API_KEY` |

### Voice

| Provider    | Env var           |
| ----------- | ----------------- |
| smallest    | `SMALLEST_API_KEY` |
| elevenlabs  | `ELEVENLABS_API_KEY` |
| groq        | `GROQ_API_KEY`    |

## License

MIT
