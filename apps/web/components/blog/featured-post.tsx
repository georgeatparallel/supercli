"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import type { BlogPostMeta } from "@/lib/utils"
import { formatDate } from "@/lib/utils"

interface FeaturedPostProps {
  post: BlogPostMeta
}

export function FeaturedPost({ post }: FeaturedPostProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
    >
      <Link
        href={`/blog/${post.slug}`}
        className="group block rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(217,161,49,0.08)]"
      >
        {post.image && (
          <div className="overflow-hidden border-b border-border">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-64 md:h-80 object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        )}

        <div className="p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] font-mono text-primary uppercase tracking-[0.15em]">
              {post.category}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {post.reading_time}
            </span>
          </div>

          <h2 className="text-[28px] md:text-[32px] font-semibold tracking-tight text-foreground mb-3 group-hover:text-primary transition-colors">
            {post.title}
          </h2>

          <p className="text-[16px] leading-relaxed text-foreground/60 mb-6 max-w-[640px]">
            {post.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-muted overflow-hidden">
                <img src="/supercode-logo.png" alt="Supercode" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-[13px] text-foreground/80 block">
                  {post.author}
                </span>
                <span className="text-[12px] font-mono text-muted-foreground">
                  {formatDate(post.date)}
                </span>
              </div>
            </div>
            <span className="text-[13px] font-mono text-foreground/40 group-hover:text-primary transition-colors">
              Read article →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
