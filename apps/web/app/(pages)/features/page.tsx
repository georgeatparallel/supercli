"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Navbar from "@/components/homepage/navbar"
import Footer from "@/components/homepage/footer"
import Link from "next/link"

interface Feature {
  title: string
  description: string
  code: string
}

interface Category {
  label: string
  icon: string
  features: Feature[]
}

const CATEGORIES: Category[] = [
  {
    label: "CLI",
    icon: ">_",
    features: [
      {
        title: "Terminal-native",
        description: "Full machine access from your terminal. Read files, run commands, edit code, open apps, search the web.",
        code: "$ supercode 'refactor the auth middleware'\n  ✓ src/auth/middleware.ts updated\n  ✓ tests/auth/middleware.test.ts added\n  ? Approve changes? [Y/n]",
      },
      {
        title: "Auto-update",
        description: "Always on the latest version. No manual downloads. No stale binaries.",
        code: "$ supercode --version\n  Supercode v0.1.56\n  Checking for updates...\n  Already up to date.",
      },
      {
        title: "Slash commands",
        description: "40+ built-in commands for every workflow. /build, /plan, /explore, /compact, /voice, and more.",
        code: "$ /help\n  Available commands:\n  /build    generate code\n  /plan     research & plan\n  /explore  navigate codebase\n  /voice    toggle voice mode",
      },
    ],
  },
  {
    label: "Taste",
    icon: "\u2B50",
    features: [
      {
        title: "Learns your style",
        description: "taste-1 observes your coding patterns and applies them automatically. No config files, no prompts.",
        code: "$ supercode 'add error handling'\n  [taste] Detected pattern: result<T>\n  [taste] Using your error boundary style\n  ✓ error handling added across 3 files",
      },
      {
        title: "Cross-session memory",
        description: "Remembers your preferences, project context, and decisions across sessions. Pick up where you left off.",
        code: "$ supercode 'continue the api work'\n  [memory] Restoring session...\n  [memory] Project: supercode-api\n  [memory] Last task: rate limiting middleware",
      },
      {
        title: "Permission profiles",
        description: "Granular control per file, command, or tool. Chat mode (read-only) or Agent mode (full access).",
        code: "$ /mode agent\n  [permissions] Switching to agent mode\n  [permissions] Allowed: read, write, exec\n  [permissions] Restricted: rm -rf, sudo",
      },
    ],
  },
  {
    label: "Models",
    icon: "\u25A1",
    features: [
      {
        title: "Multi-model support",
        description: "Claude, GPT, Gemini, DeepSeek, Llama, Mistral, Qwen — use any model, switch anytime.",
        code: "$ /model claude-sonnet-4\n  Switching to claude-sonnet-4...\n  $ /model deepseek-v4\n  Switching to deepseek-v4...\n  $ /model gpt-5\n  Switching to gpt-5...",
      },
      {
        title: "Bring your own key",
        description: "Use your own API keys for any provider. No lock-in, no markup, full control.",
        code: "$ /connect openai\n  Enter your OpenAI API key:\n  ********************\n  ✓ Connected. Using your key.",
      },
      {
        title: "Local models",
        description: "Run models locally with Ollama. Zero latency, zero data leaving your machine.",
        code: "$ /model local/llama-4\n  [ollama] Starting llama-4...\n  [ollama] Running on localhost:11434\n  ✓ Model ready (1.2s)",
      },
    ],
  },
  {
    label: "Agents",
    icon: "\u25C8",
    features: [
      {
        title: "7 built-in agents",
        description: "Specialized agents for building, planning, exploring, compacting, summarizing — each with tuned profiles.",
        code: "$ /build 'create a rest api'\n  ─────────────────────────────\n  Agent: build    Mode: agent\n  Plan: REST API scaffold\n  Files: 12  Est. time: 45s",
      },
      {
        title: "Context window",
        description: "Expansive context with transparent breakdown. See exactly what the agent sees.",
        code: "$ /context\n  Context window:\n  ─────────────────\n  Files:  24 (128K tokens)\n  Memory: 3 sessions\n  System: 2 rulesets",
      },
      {
        title: "Agent Handler",
        description: "Merge.dev integration for unified access to 100+ enterprise tools through a single interface.",
        code: "$ supercode 'sync jira tickets'\n  [handler] Connecting to Jira...\n  [handler] Fetching assigned tickets\n  [handler] Syncing to local context\n  ✓ 8 tickets loaded",
      },
    ],
  },
  {
    label: "Voice",
    icon: "\u266B",
    features: [
      {
        title: "Voice control",
        description: "Speak to your terminal. Ctrl+Shift+V to toggle, /voice to enable. Natural language, zero latency.",
        code: "[Voice mode enabled]\n  You: refactor the login component\n  Supercode: Analyzing login.tsx...\n  You: extract the validation logic\n  Supercode: Done. Review changes?",
      },
      {
        title: "Multi-provider STT",
        description: "Choose your speech-to-text engine — ElevenLabs, Groq, or custom. Switch providers on the fly.",
        code: "$ /settings stt groq\n  Speech-to-text: Groq\n  Model: whisper-large-v3\n  Latency: ~400ms",
      },
    ],
  },
  {
    label: "Privacy",
    icon: "\u25CB",
    features: [
      {
        title: "No training on your code",
        description: "Your code stays yours. We never train on your data. Period.",
        code: "$ supercode --privacy\n  Data policy:\n  ─────────────────\n  Training on your code: No\n  Data retention: 30 days\n  Encryption: AES-256",
      },
      {
        title: "Open source",
        description: "Fully open source. Audit every line, self-host if you want, contribute improvements.",
        code: "$ git clone github.com/yashdev9274/superCli\n  $ cd superCli && bun install\n  $ bun run dev\n  ✓ Supercode running locally",
      },
    ],
  },
]

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Install",
    description: "One command to install. Works on macOS, Linux, and Windows. No dependencies, no config.",
  },
  {
    step: 2,
    title: "Connect",
    description: "Bring your own API key or use our built-in free models. Connect your editor, GitHub, and tools.",
  },
  {
    step: 3,
    title: "Delegate",
    description: "Tell Supercode what to build in plain English. It plans, codes, debugs, and refactors — with your approval.",
  },
  {
    step: 4,
    title: "Iterate",
    description: "Refine with conversation. It remembers context across sessions. Your taste profile gets better over time.",
  },
]

const FEATURE_FAQ = [
  {
    q: "What models are available?",
    a: "Supercode supports Claude Opus 4.8, GPT-5, Gemini Ultra 2, DeepSeek V4 Pro, Llama 4, Mistral Large, Qwen 3, and MiniMax M3. You can switch between models mid-session with /model.",
  },
  {
    q: "How does taste-1 work?",
    a: "taste-1 observes your coding patterns — naming conventions, error handling style, import ordering — and applies them automatically. It learns locally and never leaves your machine. No telemetry, no training.",
  },
  {
    q: "Can I use Supercode offline?",
    a: "Yes. With local models (Ollama), Supercode works fully offline. All core features — commands, agents, taste, permissions — run without internet.",
  },
  {
    q: "What's the difference between Chat and Agent mode?",
    a: "Chat mode is read-only — the agent can view files and suggest changes, but you apply them manually. Agent mode grants full machine access with your approval per action. You choose what you're comfortable with.",
  },
  {
    q: "Is Supercode truly free?",
    a: "Yes. Open models are always free. You can bring your own API key for premium models with zero markup. The Spark plan ($1/year) is fully refundable. Pro and Ultra add higher limits and premium features.",
  },
  {
    q: "What editors does Supercode integrate with?",
    a: "Supercode works in any terminal — no editor plugin needed. We also have extensions for VS Code, Cursor, Zed, Windsurf, and VSCodium for a richer experience.",
  },
]

const STATS = [
  { value: "40+", label: "slash commands", icon: ">" },
  { value: "7", label: "built-in agents", icon: "\u25C8" },
  { value: "15+", label: "model providers", icon: "\u25A1" },
  { value: "100%", label: "open source", icon: "\u25CB" },
]

function TerminalWindow({ code, className }: { code: string; className?: string }) {
  return (
    <div className={`rounded-lg border border-border/40 bg-[#0a0a0b] overflow-hidden ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/30">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
      </div>
      <pre className="p-3 text-[11px] leading-relaxed font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}

function FeatureCard({ feature, index, categoryIndex }: { feature: Feature; index: number; categoryIndex: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, translateY: 12 }}
      whileInView={{ opacity: 1, translateY: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.06 + categoryIndex * 0.04, ease: [0.23, 1, 0.32, 1] }}
      className="group relative flex flex-col rounded-xl border border-border bg-card p-5 hover:border-border/70 transition-colors duration-200"
    >
      <h3 className="text-[14px] font-semibold text-foreground font-mono mb-2">{feature.title}</h3>
      <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">{feature.description}</p>
      <TerminalWindow code={feature.code} className="mt-auto" />
    </motion.div>
  )
}

function StatCard({ stat, index }: { stat: typeof STATS[number]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="border border-border/40 rounded-xl p-6 bg-card/50 backdrop-blur-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200 ease-out"
    >
      <div className="text-[28px] mb-2 font-mono text-primary">{stat.icon}</div>
      <div className="text-[28px] font-semibold tracking-tight text-foreground font-mono">{stat.value}</div>
      <div className="text-[13px] text-foreground/70 font-mono mt-1">{stat.label}</div>
    </motion.div>
  )
}

function StaggerFadeIn({
  children,
  className,
  index = 0,
}: {
  children: React.ReactNode
  className?: string
  index?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, translateY: 8 }}
      whileInView={{ opacity: 1, translateY: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function FeaturesPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  return (
    <main className="min-h-screen bg-background dark relative">
      <div className="fixed top-0 left-0 w-px h-full bg-border z-50" />
      <div className="fixed top-0 right-0 w-px h-full bg-border z-50" />

      <Navbar />

      {/* Hero */}
      <section className="pt-[140px] pb-16 px-6">
        <div className="max-w-[900px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="flex justify-center mb-6">
              <div className="px-3 py-1 bg-primary/10 text-primary text-[12px] font-mono rounded-md">
                Features
              </div>
            </div>

            <h1 className="text-[32px] md:text-[56px] text-[#A1A1AA] leading-[1.1] mb-6 tracking-tight font-semibold">
              Everything you need in a&nbsp;
              <span className="bg-gradient-to-r from-primary via-amber-300 to-primary bg-clip-text text-transparent">
                terminal AI agent
              </span>
            </h1>

            <p className="text-[16px] md:text-[18px] text-muted-foreground leading-relaxed max-w-[600px] mx-auto mb-10">
              CLI power, taste-driven code, multi-model flexibility, voice control, and
              privacy-first design — all in one terminal-native agent.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Link
                href="/login"
                className="px-7 py-3 bg-primary text-primary-foreground rounded-lg text-[14px] font-medium font-mono hover:opacity-90 active:scale-[0.97] transition-all duration-150 ease-out"
              >
                Get started free
              </Link>
              <Link
                href="/download"
                className="px-7 py-3 border border-border rounded-lg text-[14px] font-mono text-foreground/85 hover:text-foreground active:scale-[0.97] transition-all duration-150 ease-out"
              >
                Download
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-20">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((stat, i) => (
              <StatCard key={stat.label} stat={stat} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Feature categories */}
      <section className="px-6 pb-24">
        <div className="max-w-[1100px] mx-auto">
          {CATEGORIES.map((category, ci) => (
            <div key={category.label} className="mb-16 last:mb-0">
              <StaggerFadeIn index={ci}>
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-[18px] font-mono text-primary">{category.icon}</span>
                  <h2 className="text-[13px] font-mono uppercase tracking-[0.2em] text-foreground">
                    {category.label}
                  </h2>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
              </StaggerFadeIn>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {category.features.map((feature, fi) => (
                  <FeatureCard
                    key={feature.title}
                    feature={feature}
                    index={fi}
                    categoryIndex={ci}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-24">
        <div className="max-w-[900px] mx-auto">
          <StaggerFadeIn>
            <div className="text-center mb-14">
              <div className="flex justify-center mb-6">
                <div className="px-3 py-1 bg-primary/10 text-primary text-[12px] font-mono rounded-md">
                  Workflow
                </div>
              </div>
              <h2 className="text-[22px] md:text-[28px] text-foreground font-semibold tracking-tight mb-3">
                How it works
              </h2>
              <p className="text-[14px] text-muted-foreground max-w-[550px] mx-auto leading-relaxed">
                From zero to shipping in four steps. No config, no onboarding flow.
              </p>
            </div>
          </StaggerFadeIn>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, translateY: 16 }}
                whileInView={{ opacity: 1, translateY: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.23, 1, 0.32, 1] }}
                className="relative"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-[13px] font-mono font-semibold">
                    {step.step}
                  </span>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block flex-1 h-px bg-border/30" />
                  )}
                </div>
                <h3 className="text-[15px] font-semibold text-foreground font-mono mb-2">{step.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="px-6 pb-24">
        <div className="max-w-[900px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="border border-border/40 rounded-2xl p-8 md:p-12 bg-card/50 text-center"
          >
            <div className="text-4xl text-primary/30 font-mono leading-none mb-4">&ldquo;</div>
            <blockquote className="text-[18px] md:text-[22px] text-foreground/85 font-mono leading-relaxed max-w-[650px] mx-auto mb-8">
              Supercode is the first AI coding tool that actually feels like it belongs
              in the terminal. The taste system is a game-changer &mdash; it writes code
              that looks like I wrote it.
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-[13px] font-mono text-primary border border-primary/20">
                AD
              </div>
              <div className="text-left">
                <div className="text-[13px] font-mono text-foreground">Alex Dominguez</div>
                <div className="text-[11px] font-mono text-muted-foreground">Senior Engineer, Vercel</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24">
        <div className="max-w-[700px] mx-auto">
          <StaggerFadeIn>
            <h2 className="text-[22px] md:text-[28px] text-foreground font-semibold tracking-tight text-center mb-12">
              Frequently asked questions
            </h2>
          </StaggerFadeIn>

          <div className="space-y-3">
            {FEATURE_FAQ.map((item, i) => {
              const isOpen = expandedFaq === i
              return (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card overflow-hidden transition-all duration-200"
                >
                  <button
                    onClick={() => setExpandedFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-all duration-200 active:scale-[0.99]"
                  >
                    <span className="text-[14px] font-medium text-foreground font-mono">
                      {item.q}
                    </span>
                    <span
                      className={`text-muted-foreground text-lg transition-transform duration-200 shrink-0 ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-200 ${
                      isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <p className="px-5 pb-4 text-[13px] text-muted-foreground leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-32">
        <div className="max-w-[1100px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="border border-border/40 rounded-2xl p-12 md:p-16 text-center bg-card/50"
          >
            <h2 className="text-[32px] text-[#A1A1AA] md:text-[44px] font-semibold tracking-tight mb-4 font-mono">
              Ready to ship faster?
            </h2>
            <p className="text-[15px] text-foreground/70 font-mono max-w-[450px] mx-auto mb-8 leading-relaxed">
              Free and open source. Bring your own API key or use our built-in models. No credit card needed.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/login"
                className="px-7 py-3 bg-primary text-primary-foreground rounded-lg text-[14px] font-medium font-mono hover:opacity-90 active:scale-[0.97] transition-all duration-150 ease-out"
              >
                Get started free
              </Link>
              <a
                href="https://github.com/yashdev9274/superCli"
                target="_blank"
                rel="noopener noreferrer"
                className="px-7 py-3 border border-border rounded-lg text-[14px] font-mono text-foreground/85 hover:text-foreground active:scale-[0.97] transition-all duration-150 ease-out"
              >
                View on GitHub
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
