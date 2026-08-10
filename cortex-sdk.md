# Cortex SDK

## Overview

A unified TypeScript SDK that wraps ConcentrateAI's API gateway, MergeDev's API gateway + Agent Handler, and Composio's app integration platform — providing a single developer experience for building AI agents that can use any model and control any software.

Modeled after the Vercel AI SDK architecture: each capability produces standard Vercel AI SDK types (`LanguageModel`, `Tool`) so they compose naturally with `streamText`, `generateText`, and the broader AI SDK ecosystem.

---

## Architecture

```
cortex-sdk (single npm package)
│
├── /gateway          → Unified model access via ConcentrateAI | MergeDev
├── /agent-handler    → MCP-native tool packs via MergeDev AH
├── /composio         → 150+ app integrations via Composio
└── (root)            → High-level SupercodeAgent combining all three
```

### Design Principle

Each sub-module returns **Vercel AI SDK-native types** and provides **discovery + selection** methods:

| Module | Returns | Also Provides |
|---|---|---|
| `createGateway()` | `LanguageModel` | `listModels()` — discover available models per provider |
| `agentHandler.getTools()` | `Record<string, Tool>` | `listToolPacks()`, `selectPacks()` — discover & choose packs |
| `composioClient.getTools()` | `Record<string, Tool>` | `listApps()`, `connectApp()`, `selectApps()` — discover & connect apps |

---

## Package Structure

```
packages/cortex-sdk/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
│
└── src/
    ├── index.ts                       # Re-exports + SupercodeAgent class
    │
    ├── core/
    │   ├── types.ts                   # Shared config interfaces
    │   └── errors.ts                  # SdkError, ConnectionError, AuthError, etc.
    │
    ├── gateway/
    │   ├── index.ts                   # createGateway(options) → LanguageModel
    │   ├── types.ts                   # GatewayProvider, GatewayOptions
    │   ├── concentreai.ts             # @ai-sdk/openai-compatible wrapper for ConcentrateAI
    │   └── mergedev.ts                # @ai-sdk/openai-compatible wrapper for MergeDev
    │
    ├── agent-handler/
    │   ├── index.ts                   # createAgentHandler(options) → AgentHandlerClient
    │   ├── types.ts                   # AgentHandlerConfig, ToolPackInfo
    │   ├── client.ts                  # MCP connect/disconnect/listTools via @ai-sdk/mcp
    │   └── tool-packs.ts              # Preset configurations for known tool packs
    │
    ├── composio/
    │   ├── index.ts                   # createComposio(options) → ComposioClient
    │   ├── types.ts                   # ComposioConfig, AppInfo, ConnectionStatus
    │   ├── session.ts                 # Session create/recreate (local SDK or server-proxied)
    │   ├── apps.ts                    # listApps, connectApp (OAuth), getTools
    │   └── oauth.ts                   # Browser redirect + poll flow
    │
    └── utils/
        ├── retry.ts                   # Exponential backoff (3 attempts, 1s/2s/4s)
        └── fetch.ts                   # Fetch wrapper with auth and error normalization
```

---

## API Surface

### Level 1 — Models Only

```typescript
import { createGateway } from "cortex-sdk/gateway"

// Create a gateway instance — model can be set at construction or selected later
const gateway = createGateway({
  provider: "concentrateai",
  apiKey: "sk-cn-...",
  model: "deepseek/deepseek-v4-flash",    // optional, sets default model
})

// Discover available models for the selected provider
const models = await gateway.listModels()
// Returns [{ id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", ... }, ...]

// Select a model (returns LanguageModel)
// - If model was set at construction, gateway.model returns it directly
// - You can also override or set it later:
const model = gateway.model("deepseek/deepseek-v4-flash")

// MergeDev — same interface, different provider
const mdGateway = createGateway({
  provider: "mergedev",
  apiKey: "md-...",
  model: "anthropic/claude-sonnet-4-6",    // set at construction
})

const mdModels = await mdGateway.listModels()

// Works directly with Vercel AI SDK
import { streamText } from "ai"

const result = streamText({
  model: mdGateway.model,  // or mdGateway.model("anthropic/claude-sonnet-4-6")
  messages: [{ role: "user", content: "Write a poem" }],
})
```

**`createGateway()` returns a gateway client** with `listModels()` for discovery and `.model` (getter, uses constructor-specified model) / `.model(id)` (selector, returns a standard Vercel AI SDK `LanguageModel`). Swappable between providers with one config change. Under the hood it uses `@ai-sdk/openai-compatible` since both ConcentrateAI and MergeDev expose OpenAI-compatible APIs.

### Level 2 — Models + Tools (Agent Handler)

```typescript
import { createGateway } from "cortex-sdk/gateway"
import { createAgentHandler } from "cortex-sdk/agent-handler"
import { streamText } from "ai"

const gateway = createGateway({
  provider: "mergedev",
  apiKey: process.env.MERGE_DEV_API_KEY,
})

const handler = createAgentHandler({
  apiKey: process.env.MERGE_AH_API_KEY,
  registeredUserId: process.env.MERGE_REGISTERED_USER_ID,
})

// Discover available tool packs
const packs = await handler.listToolPacks()
// Returns [{ id: "web-search", name: "Web Search", tools: ["firecrawl_search", ...] }, ...]

// Select which packs to connect
await handler.selectPacks(["web-search", "exa-search"])

const result = streamText({
  model: gateway.model("anthropic/claude-sonnet-4-6"),
  messages: [{ role: "user", content: "Search the web for latest AI news" }],
  tools: await handler.getTools(),  // MCP tools from selected packs
})
```

**`createAgentHandler()` wraps MergeDev's Agent Handler MCP endpoint.** Provides `listToolPacks()` for discovery and `selectPacks()` for choosing which packs to activate. Under the hood it uses `@ai-sdk/mcp` with HTTP transport to connect to `https://ah-api.merge.dev/api/v1/tool-packs/{toolPackId}/registered-users/{registeredUserId}/mcp`. Tools are returned as `Record<string, Tool>` — directly passable to `streamText`.

### Level 3 — Models + Tools (Composio)

```typescript
import { createGateway } from "cortex-sdk/gateway"
import { createComposio } from "cortex-sdk/composio"
import { streamText } from "ai"

const gateway = createGateway({
  provider: "concentrateai",
  apiKey: process.env.CONCENTRATEAI_API_KEY,
})

const composio = createComposio({
  apiKey: process.env.COMPOSIO_API_KEY,          // for local SDK mode
  // OR serverUrl for proxied mode (no local composio key needed)
})

// Discover available apps
const apps = await composio.listApps()
// Returns [{ slug: "github", name: "GitHub", connected: false }, ...]

// Connect (OAuth) then use — individual app
await composio.connectApp("github")

// Or batch-select multiple apps at once
await composio.selectApps(["github", "linear", "slack"])

const result = streamText({
  model: gateway.model("anthropic/claude-opus-4-8"),
  messages: [{ role: "user", content: "Create a GitHub issue and post in Slack" }],
  tools: await composio.getTools(),  // MCP tools from connected apps
})
```

**`createComposio()` abstracts `@composio/core` behind a clean interface.** Two modes:
- **Local SDK mode**: Uses `@composio/core` directly with `COMPOSIO_API_KEY`
- **Server-proxied mode**: Calls a remote server's `POST /api/composio/session` endpoint (no local composio key needed)

### Level 4 — SupercodeAgent (All-in-One)

```typescript
import { SupercodeAgent } from "cortex-sdk"

const agent = new SupercodeAgent({
  gateway: {
    provider: "mergedev",
    apiKey: process.env.MERGE_DEV_API_KEY,
    model: "anthropic/claude-sonnet-4-6",          // optional, defaults to provider's best
  },
  agentHandler: {
    apiKey: process.env.MERGE_AH_API_KEY,
    registeredUserId: process.env.MERGE_REGISTERED_USER_ID,
    toolPacks: ["web-search", "exa-search"],        // select packs at init
  },
  composio: {
    apiKey: process.env.COMPOSIO_API_KEY,
    apps: ["github", "linear", "slack"],             // select apps at init
  },
})

await agent.init()
// Connects: gateway → model selected
//           agent handler → selected tool packs connected
//           composio → selected apps connected (OAuth if needed)

// Orchestration only — consumer drives the AI SDK
import { streamText } from "ai"

const result = streamText({
  model: agent.model,
  messages: [{ role: "user", content: "Review last week's Mercury transactions and create a GitHub issue" }],
  tools: { ...agent.tools },
})
```

**`SupercodeAgent` is an orchestration layer only** — it handles initialization and state (connecting all services, managing sessions, merging tools). The consumer is free to use `streamText`, `generateText`, or any other AI SDK function with the agent's `.model` and `.tools`.

---

## Underlying Technology

### ConcentrateAI

- **API Base URL**: `https://api.concentrate.ai/v1`
- **Auth**: Bearer token (`Authorization: Bearer <key>`)
- **API Format**: OpenAI-compatible (`/v1/chat/completions`)
- **Key env vars**: `CONCENTRATEAI_API_KEY`, `CONCENTRATE_BYOK_PROD_KEY`, `CONCENTRATE_BYOK_DEV_KEY`
- **Models available**: Claude Opus 4.8, Claude Sonnet 4.5/4, GPT-4o, GPT-4.1, o3-mini, o4-mini, Grok 4.5/3, DeepSeek V4 Flash/V3/R1, Llama 4 Maverick, GLM 5.2, Kimi K3/K2.6, MiniMax M3, and more
- **Value prop**: Access to 20+ frontier models through a single API without managing 20 separate provider keys

### MergeDev Gateway

- **API Base URL**: `https://api-gateway.merge.dev/v1/openai`
- **Auth**: Bearer token
- **API Format**: OpenAI-compatible
- **Key env vars**: `MERGE_DEV_API_KEY`, `MERGE_DEV_BYOK_PROD_KEY`, `MERGE_DEV_BYOK_DEV_KEY`
- **Models available**: Claude Sonnet 4.6, Claude Opus 4.8/4, GPT-4o/o3/o4, Grok 4.3/4.5, Gemini 2.5 Flash/Pro, DeepSeek V4 Flash/V3/R1, Llama 4 Maverick, Kimi K3/K2.6, MiniMax M3, and more
- **Value prop**: Unified billing + access to frontier models through one gateway

### MergeDev Agent Handler (AH)

- **API Base URL**: `https://ah-api.merge.dev`
- **MCP Endpoint**: `https://ah-api.merge.dev/api/v1/tool-packs/{toolPackId}/registered-users/{registeredUserId}/mcp`
- **Auth**: Bearer token via `Authorization` header
- **Key env vars**: `MERGE_AH_API_KEY`, `MERGE_TOOL_PACK_ID`, `MERGE_REGISTERED_USER_ID`
- **Transport**: MCP over HTTP/SSE (via `@ai-sdk/mcp`)
- **Value prop**: MCP-based tool packs (Firecrawl, Exa, etc.) that agents can use to interact with external services

### Composio

- **SDK**: `@composio/core` (optional peer dependency)
- **Session**: `composio.sessions.create(userId, { mcp: true, connectedAccounts })` → returns MCP proxy URL + headers
- **App Connection**: `composio.toolkits.authorize(userId, slug)` → OAuth redirect URL + `waitForConnection()` polling
- **Key env vars**: `COMPOSIO_API_KEY`, `SUPERCODE_SERVER_URL` (for proxied mode)
- **Transport**: MCP over HTTP/SSE (via `@ai-sdk/mcp`)
- **Value prop**: 150+ pre-built app integrations (GitHub, Linear, Slack, Mercury, Notion, Jira, etc.) — one OAuth flow per app, tools auto-discovered

### Vercel AI SDK (peer dependency)

- **Package**: `ai` (v4, v5, or v6 — peer dependency, consumer-controlled version)
- **Used by**: Gateway (returns `LanguageModel`), Agent Handler + Composio (return `Record<string, Tool>`)
- **Value prop**: The SDK composes with the `ai` ecosystem rather than reinventing it

---

## Key Behaviors

### Retry Logic

All gateway providers include exponential backoff retry (inherited from the existing codebase):
- 3 retry attempts for 5xx errors
- Delays: 1s, 2s, 4s
- Abort safety timeout: 120s on all streaming requests

### Empty-Stream Fallback

If a streaming response produces zero content (known edge case with ConcentrateAI's upstream), the SDK automatically retries with a non-streaming request (`"stream": false`).

### Tool Loop Guards

- Max 8 tool-call steps per turn (`stepCountIs(8)`)
- Empty-result sentinel injection (hallucination prevention)
- Repetition detection (same tool + same args 3+ times → stops)

### Session Lifecycle (Composio)

- `connect()` → creates/reuses MCP session
- `connectApp(slug)` → OAuth flow → session is recreated to include the new app's tools
- `disconnect()` → tears down MCP connection
- Two modes: local SDK (direct `@composio/core`) or server-proxied (via remote API)

### BYOK (Bring Your Own Key) Fallback Chain

Both ConcentrateAI and MergeDev gateways support user-provided keys that override the default server key:

```
PROD_BYOK > DEV_BYOK > API_KEY (env)
```

---

## package.json

```jsonc
{
  "name": "cortex-sdk",
  "version": "0.1.0",
  "description": "Unified SDK for building AI agents with ConcentrateAI, MergeDev, and Composio",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./gateway": {
      "types": "./dist/gateway/index.d.ts",
      "import": "./dist/gateway/index.js"
    },
    "./agent-handler": {
      "types": "./dist/agent-handler/index.d.ts",
      "import": "./dist/agent-handler/index.js"
    },
    "./composio": {
      "types": "./dist/composio/index.d.ts",
      "import": "./dist/composio/index.js"
    }
  },
  "files": ["dist"],
  "peerDependencies": {
    "ai": "^4.0.0 || ^5.0.0 || ^6.0.0"
  },
  "dependencies": {
    "@ai-sdk/openai-compatible": "^2.0.0",
    "@ai-sdk/mcp": "^2.0.0",
    "zod": "^3.25.0"
  },
  "optionalDependencies": {
    "@composio/core": "^0.13.0"
  }
}
```

---

## Implementation Phases

### Phase 1 — Scaffold

**Goal**: Package structure, build pipeline, core types.

Files to create:
- `packages/cortex-sdk/package.json` — name, exports map, deps, peer deps
- `packages/cortex-sdk/tsconfig.json` — strict mode, ESNext target, path aliases
- `packages/cortex-sdk/tsup.config.ts` — ESM + CJS outputs, dts generation
- `packages/cortex-sdk/src/core/types.ts` — `GatewayProvider`, `GatewayOptions`, `AgentHandlerConfig`, `ComposioConfig`, `ConnectorStatus`
- `packages/cortex-sdk/src/core/errors.ts` — `SdkError`, `ConnectionError`, `AuthError`, `ModelUnavailableError`, `ToolPackError`
- Register in root `turbo.json` for `build`/`typecheck`/`lint` pipelines
- Verify: `bun run build` produces valid `dist/` with `.js` + `.d.ts` + `.cjs`

### Phase 2 — Gateway Implementation

**Goal**: `createGateway()` working for both ConcentrateAI and MergeDev.

Files to create:
- `src/gateway/base.ts` — Abstract `BaseGatewayProvider` with:
  - Retry logic (3 attempts, 1s/2s/4s backoff)
  - 120s abort safety timeout
  - Empty-stream → non-streaming fallback
  - Usage/cost tracking hooks (optional)
  - Error normalization
- `src/gateway/concentrateai.ts` — `createConcentrateAIProvider(options): BaseGatewayProvider`
  - Wraps `createOpenAICompatible({ baseURL: "https://api.concentrate.ai/v1", headers })`
  - Returns model via `.chatModel(name)`
  - BYOK fallback chain: `CONCENTRATE_BYOK_PROD_KEY` → `CONCENTRATE_BYOK_DEV_KEY` → `CONCENTRATEAI_API_KEY`
- `src/gateway/mergedev.ts` — `createMergeDevProvider(options): BaseGatewayProvider`
  - Same pattern but points at `https://api-gateway.merge.dev/v1/openai`
  - BYOK fallback: `MERGE_DEV_BYOK_PROD_KEY` → `MERGE_DEV_BYOK_DEV_KEY` → `MERGE_DEV_API_KEY`
- `src/gateway/index.ts` — `createGateway(options): GatewayClient`
  - Routes to the correct provider based on `options.provider`
  - Returns `{ model(id?): LanguageModel, listModels(): ModelInfo[] }`
  - `listModels()` discovers available models from the provider
  - `model(id)` returns a standard Vercel AI SDK `LanguageModel` for the given (or default) model

Testing:
- Unit tests with mocked `fetch` verifying retry behavior, auth headers, model creation
- Verify `createGateway()` output is usable with `streamText` from `ai`

### Phase 3 — Agent Handler Implementation

**Goal**: `createAgentHandler()` working with MergeDev AH MCP endpoint.

Files to create:
- `src/agent-handler/client.ts` — MCP client lifecycle:
  - `connect()` → `createMCPClient({ transport: { type: "http" | "sse", url, headers } })` via `@ai-sdk/mcp`
  - `getTools()` → calls `client.tools()` → returns `Record<string, Tool>`
  - `disconnect()` → closes the MCP client
  - `reconnect()` → disconnect + connect
- `src/agent-handler/tool-packs.ts` — Tool pack management:
  - `listToolPacks()` — queries MergeDev AH API for available tool packs
  - `selectPacks(ids[])` — connects only to the selected packs (filters available tools)
  - Predefined preset configs for known tool packs
- `src/agent-handler/index.ts` — `createAgentHandler(config): AgentHandlerClient`
  - Accepts `{ apiKey, registeredUserId }` (toolPackId moved to selectPacks)
  - Returns `{ connect, disconnect, getTools, listToolPacks, selectPacks, isConnected }`

Testing:
- Unit tests with a mock MCP server
- Test connection lifecycle, tool discovery, error handling

### Phase 4 — Composio Implementation

**Goal**: `createComposio()` with app connection and tool discovery.

Files to create:
- `src/composio/session.ts` — Session manager:
  - **Local mode**: Uses `@composio/core` if `COMPOSIO_API_KEY` is present
    - `new Composio({ apiKey }).sessions.create(userId, { mcp: true, connectedAccounts })`
    - Returns `{ url, headers, sessionId }` for MCP connection
  - **Proxied mode**: Calls remote server's `/api/composio/session` endpoint
    - Uses stored auth token for authentication
    - Server creates and returns MCP session info
  - Session caching and recreation after new app connections
- `src/composio/apps.ts` — App management:
  - `listApps()` → queries auth configs, toolkits, and connected accounts → returns merged app list with connection status
  - `connectApp(slug)` → calls `composio.toolkits.authorize()` → opens browser for OAuth → polls until active
  - `selectApps(slugs[])` → batch-connects multiple apps (connect + trigger session refresh per app)
  - `getTools()` → returns tools from the MCP session
- `src/composio/oauth.ts` — OAuth flow extracted from existing CLI code:
  - Browser redirect via `open` package
  - `waitForConnection()` polling
  - Session recreation after successful connection
- `src/composio/index.ts` — `createComposio(config): ComposioClient`
  - Accepts `{ apiKey?, serverUrl? }`
  - Returns `{ connect, connectApp, getTools, listApps, disconnect, isConnected }`

Testing:
- Unit tests with mocked `@composio/core` and mocked server endpoints
- Test session lifecycle, app connection flow, error handling

### Phase 5 — SupercodeAgent

**Goal**: High-level orchestration class combining all three capabilities.

File to create:
- `src/index.ts` — `SupercodeAgent` class:
  ```typescript
  class SupercodeAgent {
    constructor(config: {
      gateway: GatewayOptions & { model?: string }
      composio?: ComposioOptions & { apps?: string[] }
      agentHandler?: AgentHandlerOptions & { toolPacks?: string[] }
    })

    async init(): Promise<void>
    // 1. Creates gateway client, selects model (uses config.model or default)
    // 2. Connects agent handler if configured, selects specified tool packs
    // 3. Connects composio if configured, connects specified apps

    get model(): LanguageModel
    get tools(): Record<string, Tool>          // merged from all sources
    get isReady(): boolean

    async disconnect(): Promise<void>
    // Tears down all connections

    // Post-init discovery & selection also available:
    // agent.handler.listToolPacks()
    // agent.handler.selectPacks([...])
    // agent.composio.listApps()
    // agent.composio.selectApps([...])
  }
  ```

This is intentionally thin — just orchestration. The consumer uses `agent.model` and `agent.tools` with their own `streamText`/`generateText` calls. Post-init discovery is accessible through the sub-clients exposed on the agent instance.

### Phase 6 — Dogfooding

**Goal**: Replace direct provider/tool code in the CLI with `cortex-sdk`.

Changes in `apps/supercode-cli/server/src/`:
- Import `createGateway` from `cortex-sdk/gateway` instead of manually instantiating `createOpenAICompatible` in:
  - `cli/ai/concentrate-service.ts`
  - `cli/ai/mergedev-service.ts`
  - `cli/ai/server-proxy-service.ts`
- Import `createAgentHandler` from `cortex-sdk/agent-handler` instead of `MergeConnectorManager` in:
  - `connectors/mergedev.ts` (can be replaced entirely)
  - `cli/commands/ai/init.ts`
- Import `createComposio` from `cortex-sdk/composio` instead of `ComposioSessionManager` in:
  - `mcp/composio.ts` (can be replaced entirely)
  - `cli/commands/slashCommands/mcp.ts`
- Remove duplicated retry/fallback/error logic that now lives in the SDK

### Phase 7 — Documentation and Publishing

- README with:
  - Quickstart: Gateway only (30 seconds)
  - Quickstart: Gateway + Tools (2 minutes)
  - Quickstart: Full agent (5 minutes)
  - API reference
  - Migration guide from direct provider usage
  - Environment variable reference
- JSDoc on all exported functions and types
- Initial `0.1.0` release to npm

---

## Out of Scope (v1)

| Feature | Planned For | Rationale |
|---|---|---|
| Permissions/ruleset engine | v2 | Genuine differentiator but adds significant scope. Ship core connectivity first. |
| Python SDK | v2 | After TS SDK is stable and dogfooded |
| Rust SDK | v3 | After Python SDK |
| OpenRouter provider in gateway | v2 | Already available via `@openrouter/ai-sdk-provider`. Can be added when demand exists. |
| MiniMax provider in gateway | v2 | Already available via `vercel-minimax-ai-provider` |
| NVIDIA provider in gateway | v2 | Low usage, can be added on demand |
| OrcaRouter provider in gateway | v2 | Low usage, can be added on demand |
| Merging `@super/claude-sdk` and `@super/embeddings-sdk` | v2 | Tiny packages, low urgency. Can deprecate later. |

---

## Monorepo Integration

### Location

```
packages/cortex-sdk/          # ← new
packages/sdk/                    # ← existing empty @super/sdk, leave as-is
```

The root workspace config (`workspaces: ["packages/*"]`) auto-discovers the new package.

### Turbo Integration

Add to `turbo.json`:

```jsonc
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

### Root tsconfig

Add path alias for internal consumption:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "cortex-sdk": ["./packages/cortex-sdk/src"],
      "cortex-sdk/*": ["./packages/cortex-sdk/src/*"]
    }
  }
}
```

---

## Developer Experience Examples

### Simple Chatbot with Any Model

```typescript
import { createGateway } from "cortex-sdk/gateway"
import { generateText } from "ai"

const gateway = createGateway({
  provider: "concentrateai",
  apiKey: process.env.CONCENTRATEAI_API_KEY,
})

const model = gateway.model("deepseek/deepseek-v4-flash")

const { text } = await generateText({
  model,
  messages: [{ role: "user", content: "What is the capital of France?" }],
})

console.log(text)
```

### Agent That Can Browse the Web

```typescript
import { createGateway } from "cortex-sdk/gateway"
import { createAgentHandler } from "cortex-sdk/agent-handler"
import { streamText } from "ai"

const gateway = createGateway({
  provider: "mergedev",
  apiKey: process.env.MERGE_DEV_API_KEY,
})

const handler = createAgentHandler({
  apiKey: process.env.MERGE_AH_API_KEY,
  registeredUserId: process.env.MERGE_REGISTERED_USER_ID,
})

const packs = await handler.listToolPacks()
await handler.selectPacks(["web-search", "exa-search"])

const result = streamText({
  model: gateway.model("anthropic/claude-sonnet-4-6"),
  messages: [{ role: "user", content: "Find the latest pricing for Vercel's Pro plan and summarize it" }],
  tools: await handler.getTools(),  // includes Firecrawl, Exa
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}
```

### Agent That Controls GitHub and Linear

```typescript
import { createGateway } from "cortex-sdk/gateway"
import { createComposio } from "cortex-sdk/composio"
import { streamText } from "ai"

const gateway = createGateway({
  provider: "concentrateai",
  apiKey: process.env.CONCENTRATEAI_API_KEY,
})

const composio = createComposio({
  apiKey: process.env.COMPOSIO_API_KEY,
})

const apps = await composio.listApps()
await composio.selectApps(["github", "linear"])

const result = streamText({
  model: gateway.model("anthropic/claude-opus-4-8"),
  messages: [{
    role: "user",
    content: "Create a GitHub issue titled 'Update dependencies' in my repo, then create a Linear ticket to track it",
  }],
  tools: await composio.getTools(),
})
```

---

## Glossary

| Term | Definition |
|---|---|
| **Gateway** | A unified API layer that provides access to multiple AI models through a single endpoint and API key. Both ConcentrateAI and MergeDev offer gateways. |
| **Agent Handler (AH)** | MergeDev's MCP-based system for providing tool packs (Firecrawl, Exa, etc.) to AI agents via the MCP protocol. |
| **MCP** | Model Context Protocol — an open protocol that standardizes how applications provide context and tools to LLMs. |
| **Composio** | A platform providing 150+ pre-built app integrations (GitHub, Slack, Linear, etc.) accessible via MCP. |
| **BYOK** | Bring Your Own Key — a pattern where users can provide their own API key for a service, overriding the default server key. |
| **LanguageModel** | A Vercel AI SDK type representing an AI model that can be used with `streamText`, `generateText`, etc. |
| **Tool** | A Vercel AI SDK type representing a function/tool that an AI model can call. |
| **Tool Pack** | A collection of related MCP tools bundled together (e.g., a "web search" pack containing `firecrawl_search`, `firecrawl_scrape`). |
| **OAuth Flow** | The process of authorizing an app connection via browser-based OAuth, followed by polling until the connection is active. |
