import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Code Review — Supercode",
  description:
    "AI code review that catches bugs, security issues, and performance problems before they ship. Reviews every PR in seconds with full codebase context.",
  openGraph: {
    title: "AI Code Review — Supercode",
    description:
      "AI code review that catches bugs, security issues, and performance problems before they ship.",
    url: "https://supercli.vercel.app/code-review",
    siteName: "Supercode",
    images: [
      {
        url: "/code-review-og-img.png",
        width: 1200,
        height: 630,
        alt: "Supercode AI Code Review",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Code Review — Supercode",
    description:
      "AI code review that catches bugs, security issues, and performance problems before they ship.",
    images: ["/code-review-og-img.png"],
  },
}

export default function CodeReviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
