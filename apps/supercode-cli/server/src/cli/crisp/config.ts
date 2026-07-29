import fs from "fs"
import path from "path"
import os from "os"

export type CrispMode = "off" | "lite" | "full" | "ultra"

export const CRISP_MODES: CrispMode[] = ["off", "lite", "full", "ultra"]

export const CRISP_MODE_LABELS: Record<CrispMode, string> = {
  off: "Off — Crisp disabled",
  lite: "Lite — helpful guidelines, gentle nudges toward simplicity",
  full: "Full — binding constraints, every abstraction must be justified",
  ultra: "Ultra — hard constraints, burden of proof on complexity",
}

const CONFIG_DIR = path.join(os.homedir(), ".config", "supercode")
const CONFIG_FILE = path.join(CONFIG_DIR, "cli-config.json")

export function getCrispModeSync(): CrispMode {
  try {
    const data = fs.readFileSync(CONFIG_FILE, "utf-8")
    const config = JSON.parse(data)
    const mode = config.crispMode as CrispMode
    if (CRISP_MODES.includes(mode)) return mode
  } catch {}
  return "off"
}

export async function setCrispMode(mode: CrispMode): Promise<void> {
  const { saveCliConfig } = await import("src/lib/cli-config.ts")
  await saveCliConfig({ crispMode: mode } as any)
}
