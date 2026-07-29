import type { CrispMode } from "./config.ts"

export function crispLadderPrompt(mode: CrispMode): string | null {
  if (mode === "off") return null

  const intensity: Record<CrispMode, string> = {
    off: "",
    lite:
      "Apply these principles as helpful guidelines \u2014 prefer simplicity but don\u2019t over-enforce.",
    full:
      "Apply these principles as binding constraints. Every abstraction, dependency, and pattern must be justified against this ladder.",
    ultra:
      "Enforce these principles as hard constraints. The burden of proof is on the developer adding any complexity.",
  }

  const lines: string[] = [
    `## Supercode Crisp (${mode}) \u2014 The Simplicity Ladder`,
    "",
    intensity[mode],
    "",
    "When writing or reviewing code, evaluate EVERY design decision against this ladder from top to bottom:",
    "",
    "1. **YAGNI** \u2014 You Aren\u2019t Gonna Need It. If it\u2019s not needed right now, don\u2019t build it. No future-proofing, no speculative abstractions.",
    `   \u2192 Tag: [crisp:1]`,
    "",
    "2. **Reuse what exists** \u2014 Before writing anything new, check if the language/stdlib/project already has it. Copy-paste-modify beats import-a-library.",
    `   \u2192 Tag: [crisp:2]`,
    "",
    "3. **Standard library first** \u2014 Use built-in APIs over third-party packages. OS features over npm/crates/pip.",
    `   \u2192 Tag: [crisp:3]`,
    "",
    "4. **Native platform APIs** \u2014 Prefer OS/platform built-ins over userland solutions. Shell over Python. CSS over JS. HTML over framework.",
    `   \u2192 Tag: [crisp:4]`,
    "",
    "5. **Dependencies are debt** \u2014 Every dependency is a liability. Before adding one: can you inline it? Can you strip it? Can you replace 50 lines of deps with 10 lines of code?",
    `   \u2192 Tag: [crisp:5]`,
    "",
    "6. **One line > many** \u2014 If you can express the logic in a single expression, do it. Each temporary variable is a concept the reader must hold in working memory.",
    `   \u2192 Tag: [crisp:6]`,
    "",
    "7. **Minimum code to satisfy the spec** \u2014 The best code is the code you didn\u2019t write. Delete unused imports. Remove dead branches.",
    `   \u2192 Tag: [crisp:7]`,
    "",
    "### Rules",
    "- No unrequested abstractions: no interface with one implementation, no factory for one product, no config for a value that never changes.",
    "- No boilerplate, no scaffolding for later. Later can scaffold for itself.",
    "- Deletion over addition. Boring over clever. Clever is what someone decodes at 3am.",
    "- Fewest files possible. Shortest working diff wins.",
    "- Bug fix = root cause, not symptom. Grep every caller before editing. One guard in the shared function beats a guard in every caller.",
    "",
    "### When NOT to be crisp",
    "Never simplify away: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, anything explicitly requested.",
    "If the user insists on the full version, build it. No re-arguing.",
    "",
    "### Tests are not optional",
    "Non-trivial logic (a branch, a loop, a parser, a money/security path) leaves ONE runnable check behind: an assert-based self-check or one small test file. No frameworks, no fixtures, no per-function suites unless asked. Trivial one-liners need no test (YAGNI applies to tests too).",
    "",
    "### Output discipline",
    "Code first. Then at most three short lines: what was skipped, when to add it. No essays, no feature tours, no design notes.",
    "If the explanation is longer than the code, delete the explanation. Every paragraph defending a simplification is complexity smuggled back in as prose.",
    "",
    "Mark deliberate simplifications that cut a real corner with a known ceiling with a `crisp:` comment naming the ceiling and upgrade path: `// crisp: global lock, per-account locks if throughput matters`",
    "",
    "### How to apply",
    "- When reviewing code, reference the rung number: [crisp:3] use URL constructor instead of parsing manually",
    "- When adding an abstraction, ask: which rung of the ladder does this serve?",
    "- When you see over-engineering, tag it: [crisp:1] YAGNI \u2014 this config system supports use cases that don\u2019t exist yet",
    '- Tag findings with [crisp:N] so the debt tracker can find them. Mark deliberate corner-cuts with `crisp:` comment + ceiling + upgrade path.',
    "",
  ]

  if (mode === "ultra") {
    lines.push(
      "### Ultra mode additions",
      "- No new npm/crates/pip dependencies without explicit approval",
      "- No new types/interfaces unless the function signature would be ambiguous without them",
      "- No new files unless the existing file exceeds 400 lines",
      "- Any abstraction must prove it eliminates more code than it adds (negative LoC)",
      "- YAGNI extremist: deletion before addition. Challenge requirements before building.",
      "",
    )
  }

  return lines.join("\n")
}
