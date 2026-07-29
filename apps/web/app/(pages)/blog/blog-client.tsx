"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Navbar from "@/components/homepage/navbar"
import Footer from "@/components/homepage/footer"
import { BlogCard } from "@/components/blog/blog-card"
import { FeaturedPost } from "@/components/blog/featured-post"
import type { BlogPostMeta } from "@/lib/utils"

interface BlogPageProps {
  posts: BlogPostMeta[]
  featured: BlogPostMeta[]
}

const EASE = [0.23, 1, 0.32, 1] as const

export function BlogPage({ posts, featured }: BlogPageProps) {
  const categories = ["all", ...new Set(posts.map((p) => p.category))]
  const [activeCategory, setActiveCategory] = useState("all")

  const filtered =
    activeCategory === "all"
      ? posts
      : posts.filter((p) => p.category === activeCategory)

  const latest = filtered.slice(0, 2)
  const otherPosts = filtered.slice(2)

  return (
    <main className="min-h-screen bg-background dark relative">
      <div className="fixed top-0 left-0 w-px h-full bg-border z-50" />
      <div className="fixed top-0 right-0 w-px h-full bg-border z-50" />
      <Navbar />

      <div className="pt-[120px] pb-24 px-6">
        {/* Header */}
        <div className="max-w-[1100px] mx-auto mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="text-[36px] md:text-[48px] font-semibold tracking-tight mb-4"
          >
            Blog
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06, ease: EASE }}
            className="text-muted-foreground text-[16px]"
          >
            Insights on developer tools, AI agents, and the future of software
            engineering.
          </motion.p>
        </div>

        {/* Category filter */}
        <div className="max-w-[1100px] mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="flex items-center gap-2 overflow-x-auto pb-2"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-mono whitespace-nowrap transition-all duration-200 ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Latest posts — 2 column grid */}
        {latest.length > 0 && (
          <div className="max-w-[1100px] mx-auto mb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {latest.map((post, i) => (
                <BlogCard key={post.slug} post={post} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Other posts — 3 column grid */}
        {otherPosts.length > 0 && (
          <div className="max-w-[1100px] mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-[20px] font-semibold tracking-tight text-foreground mb-8"
            >
              Other Posts
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherPosts.map((post, i) => (
                <BlogCard key={post.slug} post={post} index={i} />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="max-w-[1100px] mx-auto text-center py-24">
            <p className="text-muted-foreground text-[14px] font-mono">
              No posts yet. Check back soon.
            </p>
          </div>
        )}
      </div>

      <Footer />
    </main>
  )
}
