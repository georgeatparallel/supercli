import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import readingTime from "reading-time"
import type { BlogPost, BlogPostMeta } from "./utils"

export type { BlogPost, BlogPostMeta }

const BLOG_DIR = path.join(process.cwd(), "content/blog")

function ensureBlogDir() {
  if (!fs.existsSync(BLOG_DIR)) {
    fs.mkdirSync(BLOG_DIR, { recursive: true })
  }
}

export function getAllPosts(): BlogPostMeta[] {
  ensureBlogDir()
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"))

  const posts = files.map((filename) => {
    const filePath = path.join(BLOG_DIR, filename)
    const fileContent = fs.readFileSync(filePath, "utf-8")
    const { data, content } = matter(fileContent)
    const stats = readingTime(content)

    return {
      slug: filename.replace(/\.mdx$/, ""),
      title: data.title || "Untitled",
      description: data.description || "",
      date: data.date || new Date().toISOString(),
      updated_at: data.updated_at,
      author: data.author || "Supercode Team",
      author_avatar: data.author_avatar,
      category: data.category || "general",
      image: data.image,
      featured: data.featured || false,
      reading_time: stats.text,
    }
  })

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

export function getPostBySlug(slug: string): BlogPost | null {
  ensureBlogDir()
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  const fileContent = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(fileContent)
  const stats = readingTime(content)

  return {
    slug,
    title: data.title || "Untitled",
    description: data.description || "",
    date: data.date || new Date().toISOString(),
    updated_at: data.updated_at,
    author: data.author || "Supercode Team",
    author_avatar: data.author_avatar,
    category: data.category || "general",
    image: data.image,
    featured: data.featured || false,
    reading_time: stats.text,
    content,
  }
}

export function getFeaturedPosts(): BlogPostMeta[] {
  return getAllPosts().filter((p) => p.featured)
}

export function getPostsByCategory(category: string): BlogPostMeta[] {
  return getAllPosts().filter((p) => p.category === category)
}

export function getAllCategories(): string[] {
  const posts = getAllPosts()
  const categories = new Set(posts.map((p) => p.category))
  return Array.from(categories).sort()
}
