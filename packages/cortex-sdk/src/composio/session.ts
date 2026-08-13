import { AuthError, ConnectionError, SdkError } from "../core/errors"
import type { FetchLike } from "../core/types"
import type {
  AppInfo,
  ComposioLike,
  ComposioSessionInfo,
  McpClientLike,
} from "./types"

export type ComposioSessionMode = "local" | "proxied" | "unconfigured"

export interface ComposioSessionManagerOptions {
  apiKey?: string
  serverUrl?: string
  accessToken?: string
  userId?: string
  fetch?: FetchLike
  loadComposio?: () => Promise<{ Composio: new (options: { apiKey: string }) => unknown }>
}

export const COMPOSIO_DEFAULT_SERVER_URL = "https://supercode-8w7e.onrender.com"

async function defaultLoadComposio(): Promise<{
  Composio: new (options: { apiKey: string }) => unknown
}> {
  return (await import("@composio/core")) as unknown as {
    Composio: new (options: { apiKey: string }) => unknown
  }
}

export class ComposioSessionManager {
  private readonly options: ComposioSessionManagerOptions
  private composio: ComposioLike | null = null
  private session: ComposioSessionInfo | null = null
  private serverApiKey: string | null = null

  constructor(options: ComposioSessionManagerOptions = {}) {
    this.options = options
  }

  get mode(): ComposioSessionMode {
    if (this.apiKey) return "local"
    if (this.options.serverUrl) return "proxied"
    return "unconfigured"
  }

  get isConfigured(): boolean {
    return this.mode !== "unconfigured"
  }

  get isConnected(): boolean {
    return this.session !== null
  }

  get connectionInfo(): ComposioSessionInfo | null {
    return this.session
  }

  get userId(): string {
    return this.options.userId ?? "supercode-sdk"
  }

  private get apiKey(): string | undefined {
    return this.options.apiKey ?? this.serverApiKey ?? undefined
  }

  async getClient(): Promise<ComposioLike> {
    if (this.composio) return this.composio
    if (!this.apiKey) {
      throw new AuthError("createComposio: no API key or server URL configured", {
        code: "NOT_CONFIGURED",
      })
    }
    const loadComposio = this.options.loadComposio ?? defaultLoadComposio
    let mod: { Composio: new (options: { apiKey: string }) => unknown }
    try {
      mod = await loadComposio()
    } catch (error) {
      throw new ConnectionError("createComposio: @composio/core could not be loaded", {
        code: "COMPOSIO_LOAD_FAILED",
        cause: error,
      })
    }
    const composio = new mod.Composio({ apiKey: this.apiKey })
    this.composio = composio as unknown as ComposioLike
    return this.composio
  }

  async createSession(userId = this.userId): Promise<ComposioSessionInfo> {
    if (this.session) return this.session
    const composio = await this.getClient()
    const connectedAccounts = await this.listConnectedAccountIds()
    let s: any
    try {
      s = await composio.sessions.create(userId, {
        mcp: true,
        connectedAccounts,
      })
    } catch (error) {
      throw new ConnectionError("createComposio: composio session creation failed", {
        code: "SESSION_CREATE_FAILED",
        cause: error,
      })
    }
    const info: ComposioSessionInfo = {
      url: (s as any).mcp?.url as string,
      headers: (s as any).mcp?.headers as Record<string, string>,
      sessionId: (s as any).session_id as string,
    }
    if (!info.url) {
      throw new ConnectionError("createComposio: composio session returned no MCP URL", {
        code: "SESSION_INVALID",
      })
    }
    this.session = info
    return info
  }

  async createSessionFromServer(
    serverUrl = this.options.serverUrl ?? COMPOSIO_DEFAULT_SERVER_URL,
  ): Promise<ComposioSessionInfo> {
    if (this.session) return this.session
    const accessToken = this.options.accessToken
    if (!serverUrl) {
      throw new AuthError("createComposio: serverUrl is required in proxied mode", {
        code: "NOT_CONFIGURED",
      })
    }
    if (!accessToken) {
      throw new AuthError("createComposio: accessToken is required in proxied mode", {
        code: "NOT_CONFIGURED",
      })
    }
    const res = await this.request(`${serverUrl}/api/composio/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const info = (await res.json()) as ComposioSessionInfo
    this.session = info
    if (info.apiKey) {
      this.serverApiKey = info.apiKey
    }
    return info
  }

  async listAppsFromServer(
    serverUrl = this.options.serverUrl ?? COMPOSIO_DEFAULT_SERVER_URL,
  ): Promise<AppInfo[]> {
    const accessToken = this.options.accessToken
    if (!serverUrl) {
      throw new AuthError("createComposio: serverUrl is required in proxied mode", {
        code: "NOT_CONFIGURED",
      })
    }
    if (!accessToken) {
      throw new AuthError("createComposio: accessToken is required in proxied mode", {
        code: "NOT_CONFIGURED",
      })
    }
    const res = await this.request(`${serverUrl}/api/composio/apps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const data = (await res.json()) as { apps?: AppInfo[] }
    return data.apps ?? []
  }

  async listConnectedAccountIds(): Promise<Record<string, string>> {
    const composio = await this.getClient()
    let res: { items?: Array<{ id: string; status: string; toolkit?: { slug?: string } }> }
    try {
      res = (await (composio as any).connectedAccounts.list({})) as any
    } catch (error) {
      throw new ConnectionError("createComposio: connected accounts listing failed", {
        code: "CONNECTED_ACCOUNTS_FAILED",
        cause: error,
      })
    }
    const result: Record<string, string> = {}
    for (const acct of res.items ?? []) {
      if (acct.status === "ACTIVE" && acct.toolkit?.slug) {
        result[acct.toolkit.slug] = acct.id
      }
    }
    return result
  }

  async listApps(): Promise<AppInfo[]> {
    const composio = await this.getClient()
    let authConfigs: { items?: Array<{ toolkit?: { slug?: string } }> }
    let toolkits: Array<{ slug: string; name?: string; meta?: { description?: string; logo?: string } }>
    let connectedRes: { items?: Array<{ id: string; status: string; toolkit?: { slug?: string } }> }
    try {
      ;[authConfigs, toolkits, connectedRes] = (await Promise.all([
        (composio as any).authConfigs.list({}),
        (composio as any).toolkits.get(),
        (composio as any).connectedAccounts.list({}),
      ])) as any
    } catch (error) {
      throw new ConnectionError("createComposio: app listing failed", {
        code: "LIST_APPS_FAILED",
        cause: error,
      })
    }

    const configuredSlugs = new Set(
      (authConfigs.items ?? []).map((ac) => ac.toolkit?.slug).filter(Boolean) as string[],
    )

    const connectedMap = new Map<string, { id: string; status: string }>()
    for (const acct of connectedRes.items ?? []) {
      const slug = acct.toolkit?.slug
      if (slug && acct.status === "ACTIVE") {
        connectedMap.set(slug, { id: acct.id, status: acct.status })
      }
    }

    const toolkitMap = new Map<string, (typeof toolkits)[number]>()
    for (const tk of toolkits) {
      toolkitMap.set(tk.slug, tk)
    }

    const apps: AppInfo[] = []
    for (const slug of configuredSlugs) {
      const tk = toolkitMap.get(slug)
      if (!tk) continue
      const conn = connectedMap.get(slug)
      apps.push({
        slug: tk.slug,
        name: tk.name ?? slug,
        description: tk.meta?.description,
        logo: tk.meta?.logo,
        connected: conn?.status === "ACTIVE",
        connectedAccountId: conn?.id,
      })
    }

    apps.sort((a, b) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return apps
  }

  resetSession(): void {
    this.session = null
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const fetchImpl = this.options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
    let res: Response
    try {
      res = await fetchImpl(url, init as RequestInit)
    } catch (error) {
      throw new ConnectionError(`request to ${url} failed`, {
        code: "REQUEST_FAILED",
        cause: error,
      })
    }
    if (!res.ok) {
      throw new SdkError(`request to ${url} failed with status ${res.status}`, {
        code: "HTTP_ERROR",
      })
    }
    return res
  }
}