import { describe, it, expect } from "bun:test"
import {
  getVoiceSession,
  isFinalizeAction,
  finalizeSlugFor,
  hasConfirmation,
  hasDenial,
} from "../voiceSession"

describe("isFinalizeAction", () => {
  it("flags state-changing actions", () => {
    expect(isFinalizeAction("gmail_send_email")).toBe(true)
    expect(isFinalizeAction("slack_send_message")).toBe(true)
    expect(isFinalizeAction("gmail_reply_to_email")).toBe(true)
    expect(isFinalizeAction("linear_create_issue")).toBe(true)
    expect(isFinalizeAction("linear_update_issue")).toBe(true)
    expect(isFinalizeAction("github_create_pull_request")).toBe(true)
    expect(isFinalizeAction("googlecalendar_create_event")).toBe(true)
    expect(isFinalizeAction("notion_create_page")).toBe(true)
  })

  it("excludes draft and read-only variants", () => {
    expect(isFinalizeAction("gmail_create_draft")).toBe(false)
    expect(isFinalizeAction("gmail_update_draft")).toBe(false)
    expect(isFinalizeAction("gmail_fetch_emails")).toBe(false)
    expect(isFinalizeAction("gmail_get_message")).toBe(false)
    expect(isFinalizeAction("slack_search_messages")).toBe(false)
    expect(isFinalizeAction("linear_list_issues")).toBe(false)
    expect(isFinalizeAction("exa_search")).toBe(false)
  })
})

describe("finalizeSlugFor", () => {
  it("maps draft variants to their send counterpart", () => {
    expect(finalizeSlugFor("gmail_create_draft")).toBe("gmail_send_email")
    expect(finalizeSlugFor("gmail_update_draft")).toBe("gmail_send_email")
    expect(finalizeSlugFor("send_email")).toBe("send_email")
  })

  it("maps real composio case styles and email-draft variants", () => {
    expect(finalizeSlugFor("GMAIL_CREATE_EMAIL_DRAFT")).toBe("GMAIL_SEND_EMAIL")
    expect(finalizeSlugFor("GMAIL_UPDATE_EMAIL_DRAFT")).toBe("GMAIL_SEND_EMAIL")
    expect(finalizeSlugFor("gmail_create_email_draft")).toBe("gmail_send_email")
    expect(finalizeSlugFor("GMAIL_SEND_EMAIL")).toBe("GMAIL_SEND_EMAIL")
    expect(finalizeSlugFor("slack_send_message")).toBe("slack_send_message")
  })
})

describe("hasConfirmation", () => {
  it("detects explicit go-ahead", () => {
    expect(hasConfirmation("yes do it")).toBe(true)
    expect(hasConfirmation("Yes, send it")).toBe(true)
    expect(hasConfirmation("go ahead")).toBe(true)
    expect(hasConfirmation("sure, proceed")).toBe(true)
    expect(hasConfirmation("okay please send")).toBe(true)
  })

  it("rejects non-confirmations", () => {
    expect(hasConfirmation("no update it")).toBe(false)
    expect(hasConfirmation("what did you say")).toBe(false)
    expect(hasConfirmation("write a mail to alice@x.com")).toBe(false)
  })
})

describe("hasDenial", () => {
  it("detects refusals", () => {
    expect(hasDenial("no")).toBe(true)
    expect(hasDenial("don't send it")).toBe(true)
    expect(hasDenial("not yet")).toBe(true)
    expect(hasDenial("cancel that")).toBe(true)
  })

  it("does not treat unrelated text as denial", () => {
    expect(hasDenial("yes do it")).toBe(false)
    expect(hasDenial("tell me more")).toBe(false)
  })
})

describe("getVoiceSession", () => {
  it("returns a shared per-user session with pendingAction", () => {
    const a = getVoiceSession("user-1")
    const b = getVoiceSession("user-1")
    const c = getVoiceSession("user-2")
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a.pendingAction).toBeNull()
    a.pendingAction = { slug: "gmail_send_email", args: {}, toolkit: "gmail", app: "Gmail" }
    expect(getVoiceSession("user-1").pendingAction?.slug).toBe("gmail_send_email")
  })
})