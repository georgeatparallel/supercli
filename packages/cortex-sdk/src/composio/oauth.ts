import { ConnectionError } from "../core/errors"
import type { ComposioSessionManager } from "./session"
import type { McpClientLike, OpenBrowser } from "./types"

export type { OpenBrowser } from "./types"

export async function openBrowser(url: string, opener?: OpenBrowser): Promise<void> {
  if (opener) {
    await opener(url)
    return
  }
  try {
    const open = (await import("open")).default
    await open(url)
  } catch (error) {
    throw new ConnectionError(`opening browser for OAuth failed`, {
      code: "OPEN_BROWSER_FAILED",
      cause: error,
    })
  }
}

export async function recreateSession(
  sessionManager: ComposioSessionManager,
  userId?: string,
): Promise<void> {
  sessionManager.resetSession()
  await sessionManager.createSession(userId ?? sessionManager.userId)
}

export function closeClient(client: McpClientLike | null): Promise<void> {
  if (!client) return Promise.resolve()
  try {
    return client.close()
  } catch (error) {
    throw new ConnectionError("closing MCP session failed", {
      code: "SESSION_CLOSE_FAILED",
      cause: error,
    })
  }
}