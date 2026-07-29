import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  date: string
  updated_at?: string
  author: string
  author_avatar?: string
  category: string
  image?: string
  featured?: boolean
  reading_time: string
}

export interface BlogPost extends BlogPostMeta {
  content: string
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
