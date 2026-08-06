import { DodoPayments } from "dodopayments"

export type DodoEnvironment = "test_mode" | "live_mode"

export function getDodoEnvironment(): DodoEnvironment {
  return process.env.DODO_MODE === "test" ? "test_mode" : "live_mode"
}

/** Shared Dodo SDK client. Honors DODO_MODE so test keys hit the test API. */
export function getDodo(options?: { webhookKey?: boolean }): DodoPayments | null {
  const key = process.env.DODO_PAYMENTS_API_KEY
  if (!key) return null

  return new DodoPayments({
    bearerToken: key,
    environment: getDodoEnvironment(),
    ...(options?.webhookKey
      ? { webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY }
      : {}),
  })
}
