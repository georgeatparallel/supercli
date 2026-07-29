"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import Navbar from "@/components/homepage/navbar"
import Footer from "@/components/homepage/footer"
import type { BlogPost } from "@/lib/utils"
import { formatDate } from "@/lib/utils"

interface PostPageProps {
  post: BlogPost
  children: React.ReactNode
}

const EASE = [0.23, 1, 0.32, 1] as const

export function PostPage({ post, children }: PostPageProps) {
  return (
    <main className="min-h-screen bg-background dark relative">
      <div className="fixed top-0 left-0 w-px h-full bg-border z-50" />
      <div className="fixed top-0 right-0 w-px h-full bg-border z-50" />
      <Navbar />

      <article className="pt-[120px] pb-24 px-6">
        {/* Post header */}
        <header className="max-w-[720px] mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Link
                href="/blog"
                className="text-[12px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to blog
              </Link>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-[11px] font-mono text-primary uppercase tracking-[0.15em]">
                {post.category}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {post.reading_time}
              </span>
            </div>

            <h1 className="text-[32px] md:text-[44px] font-semibold tracking-tight leading-[1.15] mb-6">
              {post.title}
            </h1>

            <p className="text-[18px] leading-relaxed text-foreground/60 mb-8 max-w-[640px]">
              {post.description}
            </p>

            <div className="flex items-center gap-3 pb-8 border-b border-border">
              <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                <img src="/supercode-logo.png" alt="Supercode" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-[14px] text-foreground/80 block">
                  {post.author}
                </span>
                <span className="text-[12px] font-mono text-muted-foreground">
                  {formatDate(post.date)}
                  {post.updated_at && (
                    <span> · Updated {formatDate(post.updated_at)}</span>
                  )}
                </span>
              </div>
            </div>
          </motion.div>
        </header>

        {/* Post content */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="max-w-[720px] mx-auto"
        >
          {children}
        </motion.div>

        {/* Post footer */}
        <div className="max-w-[720px] mx-auto mt-16 pt-8 border-t border-border">
          <Link
            href="/blog"
            className="text-[13px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to all posts
          </Link>
        </div>
      </article>

      <Footer />
    </main>
  )
}
