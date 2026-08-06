import { spawn } from "node:child_process"

const DEFAULT_WAKE_PHRASES = "jarvis wake up,jarvis wakeup,jarvis"

function normalizeForWake(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// The phrases that wake Jarvis. Comma-separated, case-insensitive.
// Defaults cover "Jarvis wake up", "Jarvis wakeup" and a bare "Jarvis".
export function getWakePhrases(): string[] {
  const raw = process.env.JARVIS_WAKE_PHRASE || DEFAULT_WAKE_PHRASES
  return raw
    .split(",")
    .map((s) => normalizeForWake(s))
    .filter(Boolean)
}

// Edit distance (Levenshtein) for fuzzy matching — lets us catch the way real
// STT mishears "Jarvis" ("Java, wake up", "jarve wake up", "hervis" …).
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i]![0] = i
  for (let j = 0; j <= n; j++) d[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
    }
  }
  return d[m]![n]!
}

// Sounded-out aliases the wake name could come back as. "java" is the big one
// (Jarvis → Java), so it's first-class here rather than left to fuzzy math.
const NAME_ALIASES = new Set([
  "java", "javis", "jarve", "jerus", "hervis", "harvis", "jarvee", "jervis",
])

function isNameToken(word: string): boolean {
  return NAME_ALIASES.has(word) || word.startsWith("jar") || editDistance(word, "jarvis") <= 2
}

const WAKE_ALIASES = new Set(["wake", "wakeup", "woke", "awake", "activate"])

function isWakeToken(word: string): boolean {
  return (
    WAKE_ALIASES.has(word) ||
    editDistance(word, "wake") <= 1 ||
    editDistance(word, "wakeup") <= 1
  )
}

// True when the transcribed utterance is a wake call. It matches exactly first
// (a wake phrase at the start of the utterance, so a bare "Jarvis" counts), then
// falls back to a fuzzy name+signal check so mispronunciations the STT renders
// as "Java, wake up." or "jarve wakeup" still trigger Jarvis.
export function isJarvisWake(text: string): boolean {
  const norm = normalizeForWake(text)
  if (!norm) return false
  const tokens = norm.split(" ")

  // Strict path — any wake phrase is a prefix of the utterance.
  if (getWakePhrases().some((p) => norm === p || norm.startsWith(`${p} `))) return true

  // Fuzzy path: a jarvis-like name near the start, then a wake keyword.
  // Tolerate a leading filler word ("hey", "okay", "um") before the name.
  const idx = tokens.slice(0, 3).findIndex((w) => isNameToken(w))
  if (idx === -1) return false
  const rest = tokens.slice(idx + 1)
  // Require the wake keyword reasonably close after the name (within 4 words).
  return rest.slice(0, 4).some(isWakeToken)
}

export interface JarvisTarget {
  name: string
  url: string
  // When set (macOS), open the native app (e.g. WhatsApp desktop) instead of a
  // browser tab. Ignored on non-macOS, which falls back to the URL.
  app?: string
  // When set, open this raw URI directly (custom scheme such as Warp's deep
  // link) instead of handing the URL to a browser/app.
  uri?: string
}

function envOr(key: string, fallback: string): string {
  const v = process.env[key]?.trim()
  return v || fallback
}

// The daily-startup set: GitHub, WhatsApp, Slack workspace, Linear workspace,
// Twitter, a new Warp terminal tab at the repo root, then any extras in
// JARVIS_URLS. Set JARVIS_SLACK_URL and JARVIS_LINEAR_URL to your real
// workspace URLs. WhatsApp opens in the macOS desktop app (WhatsApp.app) when
// present, so it lands native instead of the browser. Everything else opens in
// the configured browser (JARVIS_BROWSER, default "Dia") rather than the OS
// default. The Warp tab uses Warp's deep link so it opens a fresh tab at
// JARVIS_WARP_DIR instead of a new window.
export function buildJarvisTargets(): JarvisTarget[] {
  const targets: JarvisTarget[] = []
  const push = (name: string, url: string, app?: string) => {
    if (url) targets.push(app ? { name, url, app } : { name, url })
  }

  push("github", envOr("JARVIS_GITHUB_URL", "https://github.com/yashdev9274/supercli"))
  push(
    "whatsapp",
    envOr("JARVIS_WHATSAPP_URL", "https://web.whatsapp.com"),
    envOr("JARVIS_WHATSAPP_APP", "WhatsApp"),
  )
  push(
    "slack",
    envOr(
      "JARVIS_SLACK_URL",
      "https://join.slack.com/t/supercodeai/shared_invite/zt-43enen35h-glS1qR854YB~HUg2AIW0vg",
    ),
  )
  push("linear", envOr("JARVIS_LINEAR_URL", "https://linear.app/supercodeai/projects/all"))
  push("twitter", envOr("JARVIS_TWITTER_URL", "https://x.com"))

  const warpDir = envOr("JARVIS_WARP_DIR", "/Users/yashdewasthale/dev/saas/supercli")
  if (warpDir) {
    targets.push({
      name: "warp",
      url: warpDir,
      uri: `warp://action/new_tab?path=${encodeURIComponent(warpDir)}`,
    })
  }

  const extra = process.env.JARVIS_URLS || ""
  extra
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .forEach((url, i) => push(`app ${i + 1}`, url))

  return targets
}

function openUrl(url: string, app?: string, uri?: string): boolean {
  if (process.platform === "darwin") {
    if (uri) {
      // Custom scheme deep link — `open warp://…` hands it to the handler.
      try {
        const proc = spawn("open", [uri], { stdio: "ignore", detached: true })
        proc.unref()
        return true
      } catch {
        return false
      }
    }
    // macOS: `open -a <App> <url>` opens the URL in a specific browser/app.
    const browser = envOr("JARVIS_BROWSER", "Dia")
    const args = app ? ["-a", app, url] : ["-a", browser, url]
    try {
      const proc = spawn("open", args, { stdio: "ignore", detached: true })
      proc.unref()
      return true
    } catch {
      return false
    }
  }

  const cmd = process.platform === "win32" ? "start" : "xdg-open"
  try {
    const proc = spawn(cmd, [uri ?? url], { stdio: "ignore", detached: true })
    proc.unref()
    return true
  } catch {
    return false
  }
}

// Launch every configured Jarvis target. WhatsApp opens in its desktop app on
// macOS, Warp opens a new tab at the repo, and the rest open in the Dia
// browser. Returns the names that opened successfully and the ones that failed.
export function runJarvisStart(): { opened: string[]; failed: string[] } {
  const opened: string[] = []
  const failed: string[] = []
  for (const target of buildJarvisTargets()) {
    if (openUrl(target.url, target.app, target.uri)) opened.push(target.name)
    else failed.push(target.name)
  }
  return { opened, failed }
}