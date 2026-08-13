# cortex-sdk

Unified SDK for building AI agents — 8 gateway providers, 3 web search providers, 6 MCP platforms, and 3 voice providers.

## Install

```bash
bun add cortex-sdk
```

Requires `ai` as a peer dependency (`^4.0.0 || ^5.0.0 || ^6.0.0`).

## Modules

| Import path                | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `cortex-sdk`               | Root exports + `SupercodeAgent` orchestration   |
| `cortex-sdk/gateway`       | `createGateway` — model access via 8 providers  |
| `cortex-sdk/agent-handler` | `createAgentHandler` — MergeDev tool packs      |
| `cortex-sdk/composio`      | `createComposio` — 150+ app integrations        |
| `cortex-sdk/web-search`    | `createWebSearch` — Exa, Firecrawl, Context.dev |
| `cortex-sdk/mcp`           | `createMcpManager` — direct MCP connections     |
| `cortex-sdk/voice`         | `createVoice` — STT + TTS                       |

## Status

Package scaffolded (Phase 1). Module factories are stubs that throw `SdkError("NOT_IMPLEMENTED")` until their implementation phases land.
