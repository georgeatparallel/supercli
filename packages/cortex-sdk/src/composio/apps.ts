import { openBrowser } from "./oauth"
import type { ComposioSessionManager } from "./session"
import type { AppInfo, ComposioLike, ConnectAppResult, OpenBrowser } from "./types"

export interface ComposioAppManagerOptions {
  session: ComposioSessionManager
  openBrowser?: OpenBrowser
}

export class ComposioAppManager {
  private readonly session: ComposioSessionManager
  private readonly openBrowserFn: OpenBrowser | undefined

  constructor(options: ComposioAppManagerOptions) {
    this.session = options.session
    this.openBrowserFn = options.openBrowser
  }

  async listApps(): Promise<AppInfo[]> {
    if (this.session.mode === "proxied") {
      return this.session.listAppsFromServer()
    }
    const client = await this.session.getClient()
    const [authConfigs, toolkits, connectedRes] = await Promise.all([
      client.authConfigs.list({}),
      client.toolkits.get(),
      client.connectedAccounts.list({}),
    ])

    const configuredSlugs = new Set(
      authConfigs.items?.map((ac) => ac.toolkit?.slug).filter(Boolean) as string[],
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

  async connectApp(slug: string): Promise<ConnectAppResult> {
    const client: ComposioLike = await this.session.getClient()
    const req = await client.toolkits.authorize(this.session.userId, slug)

    const result: ConnectAppResult = {
      connectedAccountId: req.id,
      redirectUrl: req.redirectUrl,
      waitForActive: async () => {
        await req.waitForConnection()
      },
    }

    if (req.redirectUrl) {
      await openBrowser(req.redirectUrl, this.openBrowserFn)
    }

    return result
  }
}