"use client"

import Script from "next/script"

export function DodoPaymentsScript() {
  return (
    <Script
      src="https://checkout.dodopayments.com/sdk.js"
      strategy="afterInteractive"
      data-publishable-key={process.env.NEXT_PUBLIC_DODO_PUBLISHABLE_KEY}
    />
  )
}
