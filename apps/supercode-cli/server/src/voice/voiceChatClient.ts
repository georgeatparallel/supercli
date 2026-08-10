import { spawn } from "node:child_process"
import { tmpdir } from "os"
import { join } from "path"
import { writeFileSync, unlinkSync } from "fs"
import { randomUUID } from "crypto"
import { getStoredToken } from "../lib/token"
import { voiceCaptureFlow, stripForSpeech } from "./speech"

const BASE_URL = process.env.SUPERCODE_SERVER_URL || "http://localhost:3004"
const VOICE_REPLY = (process.env.VOICE_REPLY ?? "on").toLowerCase() !== "off"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

// ─── Server-side /api/voice/chat ─────────────────────────────────────────────
async function chatWithLLM(messages: ChatMessage[]): Promise<string> {
  const token = await getStoredToken()
  if (!token?.access_token) throw new Error("Not authenticated. Run `supercode login` first.")

  const res = await fetch(`${BASE_URL}/api/voice/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.access_token}`,
    },
    body: JSON.stringify({
      messages,
      provider: "concentrateai",
      model: "deepseek-v4-flash",
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Chat API error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as { reply?: string }
  return data.reply ?? ""
}

// ─── Server-side /api/voice/tts ──────────────────────────────────────────────
async function speakViaServer(text: string): Promise<void> {
  const clean = stripForSpeech(text)
  if (!clean) return

  const token = await getStoredToken()
  if (!token?.access_token) {
    await speakWithSay(clean)
    return
  }

  try {
    const res = await fetch(`${BASE_URL}/api/voice/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.access_token}`,
      },
      body: JSON.stringify({ text: clean }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`TTS API error ${res.status}: ${err}`)
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer())
    const tmpFile = join(tmpdir(), `voice-tts-${randomUUID()}.mp3`)
    writeFileSync(tmpFile, audioBuffer)
    await playAudioFile(tmpFile)
  } catch (e) {
    console.error(`TTS server failed, falling back to say: ${(e as Error).message}`)
    await speakWithSay(clean)
  }
}

// ─── Local fallback: macOS `say` ─────────────────────────────────────────────
function speakWithSay(text: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("say", [])
    proc.on("exit", () => resolve())
    proc.on("error", () => resolve())
    proc.stdin?.write(text)
    proc.stdin?.end()
  })
}

function playAudioFile(filePath: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("afplay", [filePath])
    proc.on("exit", () => {
      try { unlinkSync(filePath) } catch {}
      resolve()
    })
    proc.on("error", () => {
      try { unlinkSync(filePath) } catch {}
      resolve()
    })
  })
}

// ─── Public API ──────────────────────────────────────────────────────────────
export interface VoiceChatOptions {
  systemPrompt?: string
  /** Max consecutive voice rounds before auto-stopping (0 = unlimited) */
  maxRounds?: number
}

/**
 * Voice chat loop: listen → STT → LLM → TTS → listen again.
 * Ctrl+C to exit.
 */
export async function startVoiceChat(options: VoiceChatOptions = {}): Promise<void> {
  const { systemPrompt = "You are Jarvis, a concise and helpful AI assistant. Keep replies under 2 sentences unless asked for detail.", maxRounds = 0 } = options

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ]

  console.log(`\n🎙️  Voice chat started — speak to Jarvis. Ctrl+C to exit.\n`)

  let rounds = 0
  while (maxRounds === 0 || rounds < maxRounds) {
    try {
      // 1. Capture voice → text
      const userText = await voiceCaptureFlow()
      if (!userText) {
        console.log("  (no speech detected — try again)")
        continue
      }

      console.log(`  You: ${userText}`)
      messages.push({ role: "user", content: userText })

      // 2. Get LLM reply
      const reply = await chatWithLLM(messages)
      messages.push({ role: "assistant", content: reply })

      console.log(`  Jarvis: ${reply}`)

      // 3. Speak the reply
      if (VOICE_REPLY) {
        await speakViaServer(reply)
      }

      rounds++
    } catch (e) {
      if ((e as any)?.code === "ERR_INTERRUPTED" || (e as Error).message?.includes("interrupt")) {
        break
      }
      console.error(`  Error: ${(e as Error).message}`)
    }
  }

  console.log("\n🎙️  Voice chat ended.\n")
}
