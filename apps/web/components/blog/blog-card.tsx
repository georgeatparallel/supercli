"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import type { BlogPostMeta } from "@/lib/utils"
import { formatDate } from "@/lib/utils"

interface BlogCardProps {
  post: BlogPostMeta
  index: number
}

export function BlogCard({ post, index }: BlogCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.06,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      <Link
        href={`/blog/${post.slug}`}
        className="group block rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(217,161,49,0.05)]"
      >
        {post.image && (
          <div className="mb-4 overflow-hidden rounded-lg border border-border">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        )}

        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] font-mono text-primary uppercase tracking-[0.15em]">
            {post.category}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {post.reading_time}
          </span>
        </div>

        <h3 className="text-[18px] font-semibold tracking-tight text-foreground mb-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>

        <p className="text-[14px] leading-relaxed text-foreground/60 mb-4 line-clamp-2">
          {post.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-[12px] font-mono text-muted-foreground">
            {formatDate(post.date)}
          </span>
          <span className="text-[12px] font-mono text-foreground/40 group-hover:text-primary transition-colors">
            Read more →
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
