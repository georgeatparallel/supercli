// MiniMax (via the Supercode cloud / concentrate.ai relay) is
// nondeterministic about tool-call transport. Most of the time it emits a
// proper OpenAI-style `delta.tool_calls` array. But it *occasionally* emits
// the tool call as inline TEXT inside `delta.content`, in one of several shapes:
//
//   [TOOL_CALL]
//   run_command --command="git diff --staged"
//   [/TOOL_CALL]
//
//   <tool_call><invoke name="run_command">
//   <parameter name="command">git diff --staged</parameter>
//   </invoke></tool_call>
//
//   <tool_call><invoke name="run_command">
//   <command>git diff --staged</command>
//   <description>Show the staged diff</description>
//   </invoke></tool_call>
//
//   <invoke name="run_command"><command>git status</command></invoke>
//
//   {"name":"run_command","parameters":{"command":"git diff --staged"}}
//
//   { "tool": "run_command", "command": "git status", "description": "..." }
//
// Plus junk control tokens like:
//   ]<]minimax[>[<tool_call>
//   <|tool_call_begin|> / <|minimax|> / etc.
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
const INVOKE_CLOSE = /<\/invoke>/g

// Known supercode tool names. The bare-JSON descriptor shape is only accepted
// when `name`/`tool` matches one of these, so prose that happens to contain a JSON
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

// MiniMax / concentrate control tokens that leak into content. Strip them so
// they never render in the TUI. Keep this permissive — unknown vendor tokens
// of the same shape are harmless to drop.
const CONTROL_TOKEN_RE =
  /\]\s*<\s*\]\s*minimax\s*\[\s*>\s*(?:\[\s*<\s*tool_call\s*>)?|<\[\s*<\s*tool_call\s*>|<\|\s*[^|>]+\s*\|>|\]\s*<\s*\]\s*[a-z0-9_-]+\s*\[\s*>/gi

/**
 * Strip MiniMax / vendor control tokens from a text chunk.
 * Safe to call on any streamed prose.
 */
export function stripControlTokens(text: string): string {
  if (!text) return ""
  return text.replace(CONTROL_TOKEN_RE, "").replace(/\[<\s*tool_call\s*>/gi, "")
}

/**
 * One-shot parse of a complete (non-streaming) string that may contain
 * embedded tool calls. Used by the client proxy as a safety net when the
 * server still streams raw MiniMax markup as text.
 */
export function extractEmbeddedToolCalls(
  content: string,
  opts?: { knownTools?: Set<string> },
): { text: string; calls: EmbeddedToolCall[] } {
  const parser = parseStreamedContent(opts)
  const out = parser.push(content)
  const flushed = parser.flush()
  return {
    text: `${out.text}${flushed.text}`,
    calls: [...out.calls, ...flushed.calls],
  }
}

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
      // Find the next opener (square, xml, bare invoke, bare JSON descriptor, or control token).
      let nextOpen = -1
      let openKind: "square" | "xml" | "invoke" | "json" | "control" = "square"
      const squareAt = block.indexOf("[TOOL_CALL]", i)
      const squareAtLow = block.indexOf("[tool_call]", i)
      const xmlAt = block.indexOf("<tool_call>", i)
      const xmlAtAlt = block.indexOf("<tool_call", i)
      const invokeAt = block.indexOf("<invoke", i)
      const jsonAt = findJsonDescriptorStart(block, i)
      const controlAt = findControlTokenStart(block, i)

      let sq = squareAt
      if (squareAtLow !== -1 && (sq === -1 || squareAtLow < sq)) sq = squareAtLow
      if (sq !== -1) {
        nextOpen = sq
        openKind = "square"
      }
      if (xmlAt !== -1 && (nextOpen === -1 || xmlAt < nextOpen)) {
        nextOpen = xmlAt
        openKind = "xml"
      } else if (
        xmlAtAlt !== -1 &&
        (nextOpen === -1 || xmlAtAlt < nextOpen) &&
        /^<tool_call[\s>]/i.test(block.slice(xmlAtAlt))
      ) {
        nextOpen = xmlAtAlt
        openKind = "xml"
      }
      if (
        invokeAt !== -1 &&
        (nextOpen === -1 || invokeAt < nextOpen) &&
        /^<invoke[\s>]/i.test(block.slice(invokeAt))
      ) {
        nextOpen = invokeAt
        openKind = "invoke"
      }
      if (jsonAt !== -1 && (nextOpen === -1 || jsonAt < nextOpen)) {
        nextOpen = jsonAt
        openKind = "json"
      }
      if (controlAt !== -1 && (nextOpen === -1 || controlAt < nextOpen)) {
        nextOpen = controlAt
        openKind = "control"
      }

      if (nextOpen === -1) {
        // Hold back a short tail that might be the start of a multi-chunk
        // opener (`[TOOL`, `<tool`, `{"name"`, `]<]min`, etc.).
        const tailHold = holdPartialOpener(block.slice(i))
        if (tailHold.hold) {
          text.push(tailHold.emit)
          pending = tailHold.hold
        } else {
          text.push(block.slice(i))
        }
        break
      }

      // Emit everything before the opener. Skip pure-whitespace separators
      // that only exist between control tokens / tool descriptors.
      const before = block.slice(i, nextOpen)
      if (before.length > 0) {
        if (
          /^\s*$/.test(before) &&
          (openKind === "json" || openKind === "xml" || openKind === "invoke" || openKind === "control")
        ) {
          // drop
        } else {
          text.push(before)
        }
      }

      if (openKind === "control") {
        const consumed = consumeControlToken(block.slice(nextOpen))
        if (consumed === -1) {
          // Incomplete control token — hold for next chunk.
          pending = block.slice(nextOpen)
          i = block.length
          break
        }
        i = nextOpen + consumed
        continue
      }

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
        // Starts with `{"name"` / `{"tool"` but isn't a valid known-tool descriptor:
        // emit the `{` and keep scanning (avoids a hang on `{"name":"Foo"}`).
        text.push(block[nextOpen] ?? "{")
        i = nextOpen + 1
        continue
      }

      const tail = block.slice(nextOpen)
      // tail begins with the opener tag; find the matching close, but the
      // inner content excludes the opener itself.
      const opLen =
        openKind === "square"
          ? /^\[tool_call\]/i.test(tail)
            ? "[tool_call]".length
            : "[TOOL_CALL]".length
          : openKind === "invoke"
            ? (() => {
                const m = /^<invoke\b[^>]*>/i.exec(tail)
                return m ? m[0].length : "<invoke>".length
              })()
            : /^<tool_call>/i.test(tail)
              ? "<tool_call>".length
              : (() => {
                  const m = /^<tool_call[^>]*>/i.exec(tail)
                  return m ? m[0].length : "<tool_call>".length
                })()
      const innerStart = opLen
      const closeRe = openKind === "square" ? SQUARE_CLOSE : openKind === "invoke" ? INVOKE_CLOSE : XML_CLOSE
      closeRe.lastIndex = 0
      const closeMatch = closeRe.exec(tail)
      if (!closeMatch) {
        // Opener not yet closed — hold the whole tail for the next chunk.
        pending = tail
        i = block.length
        break
      }

      // Bare <invoke> blocks pass the FULL block (open tag included) to the
      // XML parser, which scans for <invoke name=...> itself.
      const inner = tail.slice(innerStart, closeMatch.index)
      calls.push(
        ...(openKind === "invoke"
          ? parseBlock(tail.slice(0, closeMatch.index + closeMatch[0].length), "invoke")
          : parseBlock(inner, openKind)),
      )
      i = nextOpen + closeMatch.index + closeMatch[0].length
    }

    // When we extracted tool calls, drop whitespace-only leftovers that were
      // just separators between descriptors (newlines around JSON blobs).
      let joined = stripControlTokens(text.join(""))
      if (calls.length > 0) {
        // Keep interior whitespace (between prose sentences) but drop pure
        // leading/trailing separator whitespace introduced by markers.
        joined = joined.replace(/^\n+/, "").replace(/\n+$/, "").replace(/^ +/, "").replace(/ +$/, "")
      }
      return { text: joined, calls, pending }
  }

  return {
    push(chunk: string): ParsedBlock {
      buf += chunk
      const out = pump(buf)
      buf = out.pending
      if (out.calls.length > 0 && !out.pending) {
        return { ...out, text: out.text.replace(/\n+$/, "").replace(/ +$/, "") }
      }
      return out
    },
    flush(): ParsedBlock {
      const remaining = buf
      buf = ""
      if (!remaining) return { text: "", calls: [], pending: "" }

      // Final pass: try to extract any complete markers still in the buffer.
      // Truncated openers are dropped rather than leaked as raw markup.
      const out = pump(remaining)
      if (!out.pending) {
        if (out.calls.length > 0) {
          return {
            ...out,
            text: out.text.replace(/^\n+/, "").replace(/\n+$/, "").replace(/^ +/, "").replace(/ +$/, ""),
          }
        }
        return out
      }

      // Still holding something — drop unclosed markers, keep only clean prose
      // that doesn't look like a partial tool-call opener.
      const cleaned = stripControlTokens(out.pending)
      if (
        /\[tool_call/i.test(cleaned) ||
        /<tool_call/i.test(cleaned) ||
        /<invoke\b/i.test(cleaned) ||
        /^\s*\{\s*"(?:name|tool)"\s*:/.test(cleaned) ||
        /\]\s*<\s*\]/.test(cleaned) ||
        /<\|\s*[^|>]*$/.test(cleaned)
      ) {
        const text = out.calls.length > 0
          ? out.text.replace(/\n+$/, "").replace(/ +$/, "")
          : out.text
        return { text, calls: out.calls, pending: "" }
      }
      const text = out.text + cleaned
      return {
        text: out.calls.length > 0
          ? text.replace(/^\n+/, "").replace(/\n+$/, "").replace(/^ +/, "").replace(/ +$/, "")
          : text,
        calls: out.calls,
        pending: "",
      }
    },
  }
}

function parseBlock(inner: string, kind: "square" | "xml" | "invoke"): EmbeddedToolCall[] {
  try {
    if (kind === "xml" || kind === "invoke") {
      const call = parseXmlBlock(inner)
      return call ? [call] : []
    }
    return parseSquareBlock(inner)
  } catch {
    return []
  }
}

/** XML shapes:
 *   <invoke name="X"><parameter name="Y">value</parameter></invoke>
 *   <invoke name="X"><command>...</command><description>...</description></invoke>
 */
function parseXmlBlock(inner: string): EmbeddedToolCall | null {
  // name attribute — quoted or unquoted.
  const nameMatch = /<invoke\s+name\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/.exec(inner)
  if (!nameMatch) return null
  const name = (nameMatch[1] ?? nameMatch[2] ?? nameMatch[3]) ?? ""
  const args: Record<string, unknown> = {}
  // parameter name — quoted or unquoted.
  const paramRe =
    /<parameter\s+name\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))\s*[^>]*>([\s\S]*?)<\/parameter>/g
  let m: RegExpExecArray | null
  while ((m = paramRe.exec(inner))) {
    const pname = m[1] ?? m[2] ?? m[3] ?? ""
    const value = m[4] ?? ""
    if (pname) args[pname] = decodeEntities(value.trim())
  }
  // <command>…</command> → args.command (MiniMax `<invoke>` variant)
  const commandMatch = /<command\b[^>]*>([\s\S]*?)<\/command>/i.exec(inner)
  if (commandMatch && commandMatch[1]?.trim()) {
    args.command = decodeEntities(commandMatch[1].trim())
  }
  // <description>…</description> → args.description
  const descMatch = /<description\b[^>]*>([\s\S]*?)<\/description>/i.exec(inner)
  if (descMatch && descMatch[1]?.trim()) {
    args.description = decodeEntities(descMatch[1].trim())
  }
  if (Object.keys(args).length === 0) return null
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
//   { "tool": "run_command", "command": "git status", "description": "..." }
//
// Minimax occasionally dumps a complete JSON tool-call *descriptor* as inline
// content text rather than a structured `delta.tool_calls` array. It is only
// treated as a tool call when `name`/`tool` maps to a known tool; otherwise it
// is left as prose. Descriptors may nest args under `parameters`/`arguments`/
// `args`, or put them as top-level sibling keys next to `tool`/`name`.
//

// Locate the next plausible descriptor start: a `{` followed by `"name"` or
// `"tool"` (allowing optional whitespace). Returns the index or -1.
function findJsonDescriptorStart(s: string, from: number): number {
  const re = /\{\s*"(?:name|tool)"\s*:/g
  re.lastIndex = from
  const m = re.exec(s)
  return m ? m.index : -1
}

function findControlTokenStart(s: string, from: number): number {
  // Fast paths for the known MiniMax leak patterns.
  const candidates = [
    s.indexOf("]<]", from),
    s.indexOf("]< ]", from),
    s.indexOf("<|", from),
    s.indexOf("[<", from),
    // Stray close tags whose opener was consumed as part of a control token.
    s.indexOf("</tool_call>", from),
    s.indexOf("</invoke>", from),
  ].filter((n) => n !== -1)
  if (candidates.length === 0) return -1
  return Math.min(...candidates)
}

function consumeControlToken(s: string): number {
  // Full match of a known control token at the head of `s`.
  CONTROL_TOKEN_RE.lastIndex = 0
  const m = CONTROL_TOKEN_RE.exec(s)
  if (m && m.index === 0) return m[0].length

  // Partial / exact MiniMax junk: ]<]minimax[>[<tool_call>
  const mm = /^\]\s*<\s*\]\s*minimax\s*\[\s*>\s*(?:\[\s*<\s*tool_call\s*>)?/i.exec(s)
  if (mm) return mm[0].length

  // Stray close tag whose opener was already consumed by a control token.
  // Drop the tag (and any trailing `]` framing) silently.
  const strayClose = /^<\/(?:tool_call|invoke)\s*>\s*\]?/i.exec(s)
  if (strayClose) return strayClose[0].length

  // `<|...|>` special tokens
  const pipe = /^<\|\s*[^|>]*\s*\|>/.exec(s)
  if (pipe) return pipe[0].length

  // Incomplete pipe token at end of chunk — signal hold.
  if (/^<\|\s*[^|>]*$/.test(s) || /^\]\s*<\s*\]\s*[a-z0-9_-]*$/i.test(s)) {
    return -1
  }

  // `[<tool_call>` without a closing counterpart — drop the opener tag only.
  const bare = /^\[\s*<\s*tool_call\s*>/i.exec(s)
  if (bare) return bare[0].length

  // Leading `]<]` that isn't a full token yet.
  if (/^\]\s*<\s*\]/.test(s) && s.length < 24) return -1

  // Unknown `]<]` — consume just those three chars so we don't wedge.
  if (s.startsWith("]<]")) return 3
  if (s.startsWith("<|")) {
    // Incomplete — hold
    return -1
  }
  if (s.startsWith("[<")) {
    if (s.length < 12) return -1
    return 2
  }
  return 0
}

function holdPartialOpener(tail: string): { emit: string; hold: string } {
  // If the tail could still grow into an opener, hold it.
  const holdPatterns = [
    /\[(?:T(?:O(?:O(?:L(?:_(?:C(?:A(?:L(?:L)?)?)?)?)?)?)?)?)?$/i,
    /<(?:t(?:o(?:o(?:l(?:_(?:c(?:a(?:l(?:l)?)?)?)?)?)?)?)?)?$/i,
    /<(?:i(?:n(?:v(?:o(?:k(?:e)?)?)?)?)?)?$/i,
    /\{\s*"(?:n(?:a(?:m(?:e)?)?)?|t(?:o(?:o(?:l)?)?)?)?"?\s*:?\s*$/,
    /\](?:<(?:\](?:m(?:i(?:n(?:i(?:m(?:a(?:x)?)?)?)?)?)?)?)?)?$/i,
    /<\|\s*[^|>]*$/,
    /\[<\s*[^>]*$/,
  ]
  for (const re of holdPatterns) {
    const m = re.exec(tail)
    if (m && m.index !== undefined) {
      return { emit: tail.slice(0, m.index), hold: tail.slice(m.index) }
    }
  }
  return { emit: tail, hold: "" }
}

// Try to parse a JSON tool-call descriptor from the head of `s`. Returns:
//   - { complete: true, call, length }  — a full valid descriptor consumed
//   - { complete: false, incomplete: true } — descriptor started but stream
//     ended before the closing brace (hold for next chunk)
//   - null — not a descriptor (emit `{` and rescan)
function tryParseJsonDescriptor(
  s: string,
  knownTools: Set<string>,
):
  | { complete: true; call: EmbeddedToolCall; length: number }
  | { complete: false; incomplete: true }
  | null {
  // Find the matching closing `}` via a scan that respects nesting and string
  // literals, so embedded braces in argument strings don't confuse the match.
  const close = findBalancedClose(s)
  if (close === -1) {
    // We've already got an opener + `"name"`/`"tool"` — a closing brace will
    // arrive in a later chunk. Hold it.
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
  const name =
    typeof obj.name === "string"
      ? obj.name
      : typeof obj.tool === "string"
        ? obj.tool
        : null
  if (!name || !knownTools.has(name)) return null

  // Nested args under common keys, OR top-level sibling fields (MiniMax M3).
  const nested = obj.parameters ?? obj.arguments ?? obj.args ?? obj.input
  let args: Record<string, unknown>
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    args = nested as Record<string, unknown>
  } else {
    args = {}
    for (const [k, v] of Object.entries(obj)) {
      if (k === "name" || k === "tool" || k === "id" || k === "type") continue
      // Skip nested containers we already considered empty/invalid.
      if (k === "parameters" || k === "arguments" || k === "args" || k === "input") continue
      args[k] = v
    }
    // A descriptor with only a name/tool and no args is still a tool call
    // (some tools take zero args). Keep it.
  }

  return {
    complete: true,
    call: { name, args, id: typeof obj.id === "string" ? obj.id : "" },
    length: slice.length,
  }
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
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === "\\") {
        escaped = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return idx
    }
  }
  return -1
}
