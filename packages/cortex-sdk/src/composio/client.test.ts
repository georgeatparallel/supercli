import { describe, expect, test } from "bun:test"
import { AuthError, ConnectionError, SdkError } from "../core/errors"
import type { ComposioClientOptions, ComposioLike, McpClientLike } from "./types"
import { ComposioClientImpl } from "./index"

function fakeMcpClient(tools: Record<string, unknown>): McpClientLike {
  return {
    tools: async () => tools as never,
    close: async () => {},
  }
}

function makeComposio(overrides: Partial<ComposioLike> = {}): ComposioLike {
  const base: ComposioLike = {
    sessions: {
      create: async () => ({
        mcp: { url: "https://mcp.example.com/sse", headers: { Authorization: "Bearer x" } },
        session_id: "sess-1",
      }),
    },
    connectedAccounts: {
      list: async () => ({ items: [] }),
    },
    toolkits: {
      get: async () => [
        { slug: "github", name: "GitHub", meta: { description: "GitHub tools" } },
        { slug: "linear", name: "Linear" },
      ],
      authorize: async () => ({
        id: "acct-1",
        redirectUrl: "https://auth.example.com/start",
        waitForConnection: async () => {},
      }),
    },
    authConfigs: {
      list: async () => ({ items: [{ toolkit: { slug: "github" } }] }),
    },
  }
  return { ...base, ...overrides }
}

function fakeComposioLoader(composio: ComposioLike) {
  return {
    loadComposio: async () => ({
      Composio: function FakeComposio() {
        return composio
      } as never,
    }),
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status })
}

function makeOptions(overrides: Partial<ComposioClientOptions> = {}): ComposioClientOptions {
  const created: Array<{ transport: { type: string; url: string } }> = []
  const options: ComposioClientOptions = {
    apiKey: "comp-key",
    loadComposio: async () => ({
      Composio: function FakeComposio() {
        return makeComposio()
      } as never,
    }),
    createMcpClient: (config) => {
      created.push(config as never)
      return Promise.resolve(fakeMcpClient({ comp_tool: { type: "function" } }))
    },
    openBrowser: async () => {},
    ...overrides,
  }
  return options
}

describe("ComposioClientImpl", () => {
  test("connect() opens an MCP session and reports connected", async () => {
    const client = new ComposioClientImpl(makeOptions())
    await client.connect()
    expect(client.isConnected).toBe(true)
  })

  test("connect() is idempotent", async () => {
    const options = makeOptions()
    const client = new ComposioClientImpl(options)
    await client.connect()
    await client.connect()
    expect(client.isConnected).toBe(true)
  })

  test("getTools() auto-connects and returns composio tools", async () => {
    const client = new ComposioClientImpl(makeOptions())
    const tools = await client.getTools()
    expect(Object.keys(tools)).toEqual(["comp_tool"])
  })

  test("disconnect() closes the MCP client and clears connection", async () => {
    let closed = 0
    const client = new ComposioClientImpl(
      makeOptions({
        createMcpClient: () =>
          Promise.resolve({
            tools: async () => ({}),
            close: async () => {
              closed++
            },
          }),
      }),
    )
    await client.connect()
    expect(client.isConnected).toBe(true)
    await client.disconnect()
    expect(closed).toBe(1)
    expect(client.isConnected).toBe(false)
  })

  test("listApps() returns merged apps with connection status", async () => {
    const composio = makeComposio({
      connectedAccounts: {
        list: async () => ({ items: [{ id: "acct-github", status: "ACTIVE", toolkit: { slug: "github" } }] }),
      },
    })
    const client = new ComposioClientImpl(
      makeOptions({ ...fakeComposioLoader(composio) }),
    )
    const apps = await client.listApps()
    expect(apps).toHaveLength(1)
    expect(apps[0]?.slug).toBe("github")
    expect(apps[0]?.connected).toBe(true)
    expect(apps[0]?.connectedAccountId).toBe("acct-github")
  })

  test("listApps() sorts connected apps first", async () => {
    const composio = makeComposio({
      authConfigs: {
        list: async () => ({
          items: [{ toolkit: { slug: "github" } }, { toolkit: { slug: "linear" } }],
        }),
      },
      connectedAccounts: {
        list: async () => ({
          items: [{ id: "acct-linear", status: "ACTIVE", toolkit: { slug: "linear" } }],
        }),
      },
    })
    const client = new ComposioClientImpl(
      makeOptions({ ...fakeComposioLoader(composio) }),
    )
    const apps = await client.listApps()
    expect(apps.map((a) => a.slug)).toEqual(["linear", "github"])
  })

  test("connectApp() starts OAuth, opens browser, waits for active, refreshes session", async () => {
    const sessionCreates: string[] = []
    const composio = makeComposio({
      sessions: {
        create: async (userId) => {
          sessionCreates.push(userId)
          return {
            mcp: { url: "https://mcp.example.com/sse", headers: { Authorization: "Bearer x" } },
            session_id: `sess-${sessionCreates.length}`,
          }
        },
      },
    })
    let browserOpened = ""
    const client = new ComposioClientImpl(
      makeOptions({
        ...fakeComposioLoader(composio),
        openBrowser: async (url) => {
          browserOpened = url
        },
      }),
    )
    await client.connect()
    const before = sessionCreates.length
    const result = await client.connectApp("github")
    expect(result.connectedAccountId).toBe("acct-1")
    expect(browserOpened).toBe("https://auth.example.com/start")
    expect(sessionCreates.length).toBeGreaterThan(before)
  })

  test("connectApp() falls back to proxied mode when no apiKey is set", async () => {
    const client = new ComposioClientImpl(makeOptions({ apiKey: undefined }))
    await expect(client.connectApp("github")).rejects.toMatchObject({
      code: "PROXIED_CONNECT_UNSUPPORTED",
    })
  })

  test("connectApp() throws PROXIED_CONNECT_UNSUPPORTED in proxied mode", async () => {
    const client = new ComposioClientImpl(
      makeOptions({ apiKey: undefined, serverUrl: "https://server.example.com", accessToken: "tok" }),
    )
    await expect(client.connectApp("github")).rejects.toMatchObject({
      code: "PROXIED_CONNECT_UNSUPPORTED",
    })
  })

  test("selectApps() connects each app in order", async () => {
    const connected: string[] = []
    const composio = makeComposio({
      toolkits: {
        get: async () => [],
        authorize: async (_userId: string, slug: string) => {
          connected.push(slug)
          return {
            id: `acct-${slug}`,
            redirectUrl: null,
            waitForConnection: async () => {},
          }
        },
      },
    })
    const client = new ComposioClientImpl(
      makeOptions({
        createMcpClient: () =>
          Promise.resolve({
            tools: async () => ({}),
            close: async () => {},
          }),
        ...fakeComposioLoader(composio),
      }),
    )
    await client.selectApps(["github", "linear"])
    expect(connected).toEqual(["github", "linear"])
  })
})

describe("proxied mode", () => {
  test("connect() uses the server session endpoint", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = []
    const client = new ComposioClientImpl(
      makeOptions({
        apiKey: undefined,
        serverUrl: "https://server.example.com",
        accessToken: "user-tok",
        fetch: (async (url, init) => {
          calls.push({
            url: String(url),
            headers: (init?.headers ?? {}) as Record<string, string>,
          })
          return jsonResponse({
            url: "https://mcp.example.com/sse",
            headers: { Authorization: "Bearer sess" },
            sessionId: "sess-proxy",
          })
        }) as ComposioClientOptions["fetch"],
      }),
    )
    await client.connect()
    expect(calls[0]?.url).toBe("https://server.example.com/api/composio/session")
    expect(calls[0]?.headers.Authorization).toBe("Bearer user-tok")
    expect(client.isConnected).toBe(true)
  })

  test("listApps() fetches from the server apps endpoint", async () => {
    const client = new ComposioClientImpl(
      makeOptions({
        apiKey: undefined,
        serverUrl: "https://server.example.com",
        accessToken: "user-tok",
        fetch: (async () =>
          jsonResponse({
            apps: [{ slug: "github", name: "GitHub", connected: true, connectedAccountId: "a1" }],
          })) as ComposioClientOptions["fetch"],
      }),
    )
    const apps = await client.listApps()
    expect(apps).toHaveLength(1)
    expect(apps[0]?.slug).toBe("github")
  })

  test("listApps() returns [] when server omits apps", async () => {
    const client = new ComposioClientImpl(
      makeOptions({
        apiKey: undefined,
        serverUrl: "https://server.example.com",
        accessToken: "user-tok",
        fetch: (async () => jsonResponse({})) as ComposioClientOptions["fetch"],
      }),
    )
    const apps = await client.listApps()
    expect(apps).toEqual([])
  })

  test("non-ok server responses throw SdkError", async () => {
    const client = new ComposioClientImpl(
      makeOptions({
        apiKey: undefined,
        serverUrl: "https://server.example.com",
        accessToken: "user-tok",
        fetch: (async () => new Response("boom", { status: 500 })) as ComposioClientOptions["fetch"],
      }),
    )
    await expect(client.listApps()).rejects.toBeInstanceOf(SdkError)
  })
})

describe("session edge cases", () => {
  test("session create failure maps to ConnectionError", async () => {
    const composio = makeComposio({
      sessions: {
        create: async () => {
          throw new Error("composio down")
        },
      },
    })
    const client = new ComposioClientImpl(
      makeOptions({ ...fakeComposioLoader(composio) }),
    )
    await expect(client.connect()).rejects.toBeInstanceOf(ConnectionError)
  })

  test("missing apiKey in local mode throws AuthError on connect", async () => {
    const client = new ComposioClientImpl(makeOptions({ apiKey: undefined }))
    await expect(client.connect()).rejects.toBeInstanceOf(AuthError)
  })
})
