import { test, expect } from "bun:test"
import { isJarvisWake, getWakePhrases, buildJarvisTargets } from "src/voice/jarvis.ts"

test("default wake phrases cover bare Jarvis and wake up variants", () => {
  const phrases = getWakePhrases()
  expect(phrases).toContain("jarvis")
  expect(phrases).toContain("jarvis wake up")
  expect(phrases).toContain("jarvis wakeup")
})

test("isJarvisWake matches exact, suffixed, and punctuation variants", () => {
  expect(isJarvisWake("jarvis wake up")).toBe(true)
  expect(isJarvisWake("Jarvis wake up please")).toBe(true)
  expect(isJarvisWake("Jarvis, wake up!")).toBe(true)
  expect(isJarvisWake("JARVIS")).toBe(true)
})

test("isJarvisWake rejects ordinary commands", () => {
  expect(isJarvisWake("open github")).toBe(false)
  expect(isJarvisWake("hello there")).toBe(false)
  expect(isJarvisWake("")).toBe(false)
})

test("isJarvisWake catches STT mispronunciations of Jarvis", () => {
  expect(isJarvisWake("Java, wake up.")).toBe(true)
  expect(isJarvisWake("Java wakeup")).toBe(true)
  expect(isJarvisWake("jarve wake up please")).toBe(true)
  expect(isJarvisWake("hervis wake")).toBe(true)
  expect(isJarvisWake("hey jarvis wake up")).toBe(true)
})

test("isJarvisWake does not fire on a jarvis-like name without a wake signal", () => {
  expect(isJarvisWake("java is a programming language")).toBe(false)
  expect(isJarvisWake("java is good")).toBe(false)
})

test("buildJarvisTargets uses defaults for the daily workspace set", () => {
  const targets = buildJarvisTargets()
  const names = targets.map((t) => t.name)
  expect(names).toContain("github")
  expect(names).toContain("whatsapp")
  expect(names).toContain("slack")
  expect(names).toContain("linear")
  expect(names).toContain("twitter")
  const github = targets.find((t) => t.name === "github")
  expect(github?.url).toBe("https://github.com/yashdev9274/supercli")
  const slack = targets.find((t) => t.name === "slack")
  expect(slack?.url).toContain("join.slack.com/t/supercodeai")
  const linear = targets.find((t) => t.name === "linear")
  expect(linear?.url).toBe("https://linear.app/supercodeai/projects/all")
})

test("warp target opens a new tab via the warp deep link", () => {
  const warp = buildJarvisTargets().find((t) => t.name === "warp")
  expect(warp?.uri).toBe(
    "warp://action/new_tab?path=%2FUsers%2Fyashdewasthale%2Fdev%2Fsaas%2Fsupercli",
  )
})

test("whatsapp target opens the native macOS desktop app", () => {
  const whatsapp = buildJarvisTargets().find((t) => t.name === "whatsapp")
  expect(whatsapp?.app).toBe("WhatsApp")
  expect(whatsapp?.url).toBe("https://web.whatsapp.com")
})

test("JARVIS_WAKE_PHRASE env overrides defaults", () => {
  const prev = process.env.JARVIS_WAKE_PHRASE
  process.env.JARVIS_WAKE_PHRASE = "ready set go"
  try {
    expect(getWakePhrases()).toContain("ready set go")
    expect(isJarvisWake("ready set go now")).toBe(true)
    // A jarvis-like name + wake keyword still fires even with a custom phrase.
    expect(isJarvisWake("java wake up")).toBe(true)
  } finally {
    if (prev === undefined) delete process.env.JARVIS_WAKE_PHRASE
    else process.env.JARVIS_WAKE_PHRASE = prev
  }
})
