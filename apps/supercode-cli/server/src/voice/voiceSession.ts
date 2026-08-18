/**
 * Per-user voice session state.
 *
 * The voice agent is conversational: the user builds a task up over several
 * turns ("write a mail" -> details -> draft -> "should I send it?" -> "yes").
 * Draft/prepare actions run immediately, but *finalizing* actions (send, post,
 * create, update, ...) are deferred until the user explicitly confirms, so the
 * agent always knows when to act and how.
 */

export interface PendingAction {
  slug: string
  args: Record<string, unknown>
  toolkit: string | null
  app: string | null
}

export interface VoiceSession {
  /** The prepared-but-unconfirmed finalizing action, if any. */
  pendingAction: PendingAction | null
}

const sessions = new Map<string, VoiceSession>()

export function getVoiceSession(userId: string): VoiceSession {
  let session = sessions.get(userId)
  if (!session) {
    session = { pendingAction: null }
    sessions.set(userId, session)
  }
  return session
}

/**
 * True when a composio slug changes real-world state (sends, posts, creates,
 * updates, deletes, replies, ...). Draft/prepare and read-only variants
 * (create_draft, update_draft, get_*, fetch, list, search, read, query, ...)
 * are safe to run immediately and are therefore excluded.
 */
const FINALIZE_PATTERN = /(send|post|create|update|delete|reply|publish|commit|merge|submit|schedule)/i
const SAFE_VARIANT_PATTERN = /(draft|get_|fetch|list|search|read|query|verify|check|count)/i

export function isFinalizeAction(slug: string): boolean {
  return FINALIZE_PATTERN.test(slug) && !SAFE_VARIANT_PATTERN.test(slug)
}

/** Maps a draft/prepare variant to its finalizing counterpart, if any. */
export function finalizeSlugFor(slug: string): string {
  const match = slug.match(/(create|update)_(?:email_)?draft/i)
  if (match && match.index !== undefined) {
    const upper = match[0] === match[0].toUpperCase()
    return slug.slice(0, match.index) + (upper ? "SEND_EMAIL" : "send_email") + slug.slice(match.index + match[0].length)
  }
  return slug.replace(/(?:_draft)$/i, "_send_email")
}

/** Explicit go-ahead from the user ("yes do it", "send it", "go ahead", ...). */
const CONFIRMATION_PATTERN =
  /\b(yes|yeah|yep|yup|sure|ok|okay|go ahead|send it|do it|proceed|confirm|please send|go for it|definitely|absolutely)\b/i

export function hasConfirmation(text: string): boolean {
  return CONFIRMATION_PATTERN.test(text)
}

/** Explicit refusal / stop ("no", "don't send", "cancel", "not yet", ...). */
const DENIAL_PATTERN =
  /\b(no|nope|cancel|don'?t send|do not send|not yet|hold on|wait|stop|never mind|nevermind)\b/i

export function hasDenial(text: string): boolean {
  return DENIAL_PATTERN.test(text)
}