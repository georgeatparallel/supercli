// MiniMax (via the Supercode cloud / concentrate.ai relay) is
// nondeterministic about tool-call transport. Most of the time it emits a
// proper OpenAI-style `delta.tool_calls` array. But it *occasionally* emits
// the tool call as inline TEXT inside `delta.content`, in one of three shapes:
//
//   [TOOL_CALL]
//   run_command --command="git diff --staged"
//   [/TOOL_CALL]
//
//   <tool_call><invoke name="run_command">
//   <parameter name="command">git diff --staged</parameter>
//   </invoke></tool_call>
//
//   {"name":"run_command","parameters":{"command":"git diff --staged"}}
//
// If those markers survive to the client they render as raw garbage in the
// chat instead of executing. This module strips the markers out of the stream
// and converts them into structured tool-call objects the relay can re-emit
// as real `tool-call` events.

export interface EmbeddedToolCall {
  name: string
  args: Record<string, unknown>
  id: string
}

export interface ParsedBlock {
  // Text that should be streamed onward verbatim (may be empty).
  text: string
  // Parsed tool calls (already complete).
  calls: EmbeddedToolCall[]
  // Left-over buffer that must be kept for the next chunk (an opener that
  // hasn't been closed yet). Empty when nothing is pending.
  pending: string
}

const SQUARE_CLOSE = /\[\/TOOL_CALL\]|\[\/tool_call\]/g
const XML_CLOSE = /<\/tool_call>/g

// Known supercode tool names. The bare-JSON descriptor shape is only accepted
// when `name` matches one of these, so prose that happens to contain a JSON
// object (e.g. tool results) is never misparsed into a phantom tool call.
export const KNOWN_TOOL_NAMES = new Set([
  "read_file",
  "search_files",
  "write_file",
  "edit_file",
  "run_command",
  "url_fetch",
  "web_search",
  "firecrawl_search",
  "firecrawl_scrape",
  "firecrawl_map",
  "exa_search",
  "exa_fetch",
  "code_exec",
  "read_instructions",
  "switch_to_agent_mode",
  "delegate",
  "task",
  "question",
  "todowrite",
  "skill",
  "crisp_review",
  "crisp_audit",
  "crisp_debt",
  "crisp_gain",
])

/**
 * Streaming parser for minimax inline tool-call text.
 *
 * Feed it `delta.content` chunks one at a time via `push()`. It emits a
 * stable prefix of the buffer that is no longer part of an in-flight marker,
 * plus any completed tool calls, and keeps the rest in `pending` for the next
 * chunk. Call `flush()` once the upstream stream ends to release whatever is
 * left (normally just trailing prose).
 *
 * While inside an open marker the surrounding prose is held back — minimax
 * emits narration *before* the marker, so withholding a few tokens until the
 * block closes is invisible in practice.
 */
export function parseStreamedContent(opts?: { knownTools?: Set<string> }): {
  push(chunk: string): ParsedBlock
  flush(): ParsedBlock
} {
  const knownTools = opts?.knownTools ?? KNOWN_TOOL_NAMES
  let buf = ""

  function pump(block: string): ParsedBlock {
    const text: string[] = []
    const calls: EmbeddedToolCall[] = []
    let pending = ""
    let i = 0

    while (i < block.length) {
      // Find the next opener (square, xml, or bare JSON descriptor).
      let nextOpen = -1
      let openKind: "square" | "xml" | "json" = "square"
      const squareAt = block.indexOf("[TOOL_CALL]", i)
      const squareAtLow = block.indexOf("[tool_call]", i)
      const xmlAt = block.indexOf("<tool_call>", i)
      const jsonAt = findJsonDescriptorStart(block, i)
      let sq = squareAt
      if (squareAtLow !== -1 && (sq === -1 || squareAtLow < sq)) sq = squareAtLow
      if (sq !== -1) { nextOpen = sq; openKind = "square" }
      if (xmlAt !== -1 && (nextOpen === -1 || xmlAt < nextOpen)) { nextOpen = xmlAt; openKind = "xml" }
      if (jsonAt !== -1 && (nextOpen === -1 || jsonAt < nextOpen)) { nextOpen = jsonAt; openKind = "json" }

      if (nextOpen === -1) {
        text.push(block.slice(i))
        break
      }

      // Emit everything before the opener.
      text.push(block.slice(i, nextOpen))

      if (openKind === "json") {
        const parsed = tryParseJsonDescriptor(block.slice(nextOpen), knownTools)
        if (parsed?.complete) {
          calls.push(parsed.call)
          i = nextOpen + parsed.length
          continue
        }
        if (parsed?.incomplete) {
          // Descriptor start but not yet closed — hold the tail for next chunk.
          pending = block.slice(nextOpen)
          i = block.length
          break
        }
        // Starts with `{"name"` but isn't a valid known-tool descriptor:
        // emit the `{` and keep scanning (avoids a hang on `{"name":"Foo"}`).
        i = nextOpen + 1
        continue
      }

      const tail = block.slice(nextOpen)
      // tail begins with the opener tag; find the matching close, but the
      // inner content excludes the opener itself.
      const opLen = openKind === "square"
        ? /^\[tool_call\]/i.test(tail) ? "[tool_call]".length : "[TOOL_CALL]".length
        : "<tool_call>".length
      const innerStart = opLen
      const closeRe = openKind === "square" ? SQUARE_CLOSE : XML_CLOSE
      closeRe.lastIndex = 0
      const closeMatch = closeRe.exec(tail)
      if (!closeMatch) {
        // Opener not yet closed — hold the whole tail for the next chunk.
        pending = tail
        i = block.length
        break
      }

      const inner = tail.slice(innerStart, closeMatch.index)
      calls.push(...parseBlock(inner, openKind))
      i = nextOpen + closeMatch.index + closeMatch[0].length
    }

    return { text: text.join(""), calls, pending }
  }

  return {
    push(chunk: string): ParsedBlock {
      buf += chunk
      const out = pump(buf)
      buf = out.pending
      return out
    },
    flush(): ParsedBlock {
      const remaining = buf
      buf = ""
      if (!remaining) return { text: "", calls: [], pending: "" }
      // No more chunks coming: if the tail still holds an unclosed opener it
      // is a truncated marker — drop it rather than leak raw markup.
      return { text: "", calls: [], pending: "" }
    },
  }
}

function parseBlock(inner: string, kind: "square" | "xml"): EmbeddedToolCall[] {
  try {
    if (kind === "xml") {
      const call = parseXmlBlock(inner)
      return call ? [call] : []
    }
    return parseSquareBlock(inner)
  } catch {
    return []
  }
}

/** XML shape: <invoke name="X"><parameter name="Y">value</parameter></invoke> */
function parseXmlBlock(inner: string): EmbeddedToolCall | null {
  // name attribute — quoted or unquoted.
  const nameMatch = /<invoke\s+name\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/.exec(inner)
  if (!nameMatch) return null
  const name = (nameMatch[1] ?? nameMatch[2] ?? nameMatch[3]) ?? ""
  const args: Record<string, unknown> = {}
  // parameter name — quoted or unquoted.
  const paramRe = /<parameter\s+name\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))\s*[^>]*>([\s\S]*?)<\/parameter>/g
  let m: RegExpExecArray | null
  while ((m = paramRe.exec(inner))) {
    const pname = m[1] ?? m[2] ?? m[3] ?? ""
    const value = m[4] ?? ""
    if (pname) args[pname] = decodeEntities(value.trim())
  }
  return { name, args, id: "" }
}

/** Square shape: `run_command --command="git diff --staged"` */
function parseSquareBlock(inner: string): EmbeddedToolCall[] {
  const nameMatch = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(inner)
  if (!nameMatch) return []
  const name = nameMatch[1] ?? ""
  const args: Record<string, unknown> = {}
  const flagRe = /--([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g
  let m: RegExpExecArray | null
  while ((m = flagRe.exec(inner))) {
    const key = m[1] ?? ""
    if (key) args[key] = m[2] ?? m[3] ?? m[4] ?? true
  }
  if (Object.keys(args).length === 0) return []
  return [{ name, args, id: "" }]
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

//
// ─── Bare-JSON descriptor shape ────────────────────────────────────────────
//
//   {"name":"run_command","parameters":{"command":"git diff --staged"}}
//
// Minimax occasionally dumps a complete JSON tool-call *descriptor* as inline
// content text rather than a structured `delta.tool_calls` array. It is only
// treated as a tool call when `name` maps to a known tool; otherwise it is
// left as prose. Descriptors may be keyed with `parameters`, `arguments`, or
// `args`, and may carry an optional `description`.
//

// Locate the next plausible descriptor start: a `{` immediately followed by
// `"name"` (allowing optional whitespace). Returns the index or -1.
function findJsonDescriptorStart(s: string, from: number): number {
  const re = /\{"name"\s*:/g
  re.lastIndex = from
  const m = re.exec(s)
  return m ? m.index : -1
}

// Try to parse a JSON tool-call descriptor from the head of `s`. Returns:
//   - { complete: true, call, length }  — a full valid descriptor consumed
//   - { complete: false, incomplete: true } — descriptor started but stream
//     ended before the closing brace (hold for next chunk)
//   - null — not a descriptor (emit `{` and rescan)
function tryParseJsonDescriptor(
  s: string,
  knownTools: Set<string>,
): { complete: true; call: EmbeddedToolCall; length: number } | { complete: false; incomplete: true } | null {
  // Find the matching closing `}` via a scan that respects nesting and string
  // literals, so embedded braces in argument strings don't confuse the match.
  const close = findBalancedClose(s)
  if (close === -1) {
    // We've already got an opener + `"name"` — a closing brace will arrive in
    // a later chunk. Hold it (but cap how much we'll wait so unclosed prose
    // JSON can't wedge the stream forever).
    return { complete: false, incomplete: true }
  }
  const slice = s.slice(0, close + 1)
  let parsed: unknown
  try {
    parsed = JSON.parse(slice)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const obj = parsed as Record<string, unknown>
  const name = obj.name
  if (typeof name !== "string" || !knownTools.has(name)) return null
  const argsRaw = obj.parameters ?? obj.arguments ?? obj.args
  if (!argsRaw || typeof argsRaw !== "object" || Array.isArray(argsRaw)) return null
  return { complete: true, call: { name, args: argsRaw as Record<string, unknown>, id: "" }, length: slice.length }
}

// Find the index of the `}` that closes the first top-level object in `s`,
// respecting double-quoted string literals (so escaped braces inside strings
// don't count). Returns -1 if the object never closes.
function findBalancedClose(s: string): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let idx = 0; idx < s.length; idx++) {
    const ch = s[idx]
    if (inString) {
      if (escaped) { escaped = false; continue }
      if (ch === "\\") { escaped = true; continue }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return idx
    }
  }
  return -1
}
