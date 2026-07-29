import { getAllPosts, getFeaturedPosts } from "@/lib/blog"
import { BlogPage } from "./blog-client"

export const metadata = {
  title: "Blog - Supercode",
  description:
    "Insights on developer tools, AI agents, and the future of software engineering.",
}

export default function Page() {
  const posts = getAllPosts()
  const featured = getFeaturedPosts()

  return <BlogPage posts={posts} featured={featured} />
}
