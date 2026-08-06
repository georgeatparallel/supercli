import { describe, it, expect, beforeEach, afterEach } from "bun:test"

describe("canVoiceCapture", () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    process.env = { PATH: origEnv.PATH, FFMPEG_PATH: origEnv.FFMPEG_PATH }
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.GROQ_API_KEY
    delete process.env.SMALLEST_API_KEY
    delete process.env.STT_PROVIDER
  })

  afterEach(() => {
    process.env = { ...origEnv }
  })

  it("returns ok=false when SMALLEST_API_KEY is missing", async () => {
    const { canVoiceCapture } = await import("../speech.ts")
    const result = canVoiceCapture()
    expect(result.ok).toBe(false)
    expect(result.reason).toContain("SMALLEST_API_KEY")
  })

  it("returns ok=false with ffmpeg reason when ffmpeg is missing", async () => {
    process.env.SMALLEST_API_KEY = "sk-test"
    process.env.FFMPEG_PATH = "/nonexistent/ffmpeg"
    const { canVoiceCapture } = await import("../speech.ts")
    const result = canVoiceCapture()
    expect(result.ok).toBe(false)
    expect(result.reason).toContain("ffmpeg")
  })
})

describe("getSttProvider", () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    process.env = { PATH: origEnv.PATH }
    delete process.env.STT_PROVIDER
  })

  afterEach(() => {
    process.env = { ...origEnv }
  })

  it('always returns "smallest" (Smallest.ai is the only STT provider)', async () => {
    const mod = await import("../speech.ts")
    expect((mod as any).getSttProvider()).toBe("smallest")
  })

  it('ignores STT_PROVIDER and still returns "smallest"', async () => {
    process.env.STT_PROVIDER = "groq"
    const mod = await import("../speech.ts")
    expect((mod as any).getSttProvider()).toBe("smallest")
  })
})

describe("stripForSpeech", () => {
  it("removes code fences and inline code", async () => {
    const mod = await import("../speech.ts")
    const out = (mod as any).stripForSpeech(
      "Here is the fix:\n```ts\nconst x = 1\n```\nUse `y` instead.",
    )
    expect(out).not.toContain("```")
    expect(out).not.toContain("const x = 1")
    expect(out).toContain("Here is the fix")
    expect(out).toContain("y instead")
  })

  it("strips markdown symbols, links, and headings", async () => {
    const mod = await import("../speech.ts")
    const out = (mod as any).stripForSpeech(
      "# Title\n\n- one\n- two\n\nSee [docs](https://example.com) for **more**.",
    )
    expect(out).not.toContain("#")
    expect(out).not.toContain("https://example.com")
    expect(out).toContain("docs")
    expect(out).toContain("more")
  })

  it("truncates to SPEECH_MAX_CHARS", async () => {
    const mod = await import("../speech.ts")
    const long = "word ".repeat(2000)
    const out = (mod as any).stripForSpeech(long)
    expect(out.length).toBeLessThanOrEqual(3000)
  })
})

describe("isTtsAvailable", () => {
  it("returns a boolean reflecting the platform (darwin only)", async () => {
    const mod = await import("../speech.ts")
    const result = (mod as any).isTtsAvailable()
    expect(typeof result).toBe("boolean")
    expect(result).toBe(process.platform === "darwin")
  })
})
