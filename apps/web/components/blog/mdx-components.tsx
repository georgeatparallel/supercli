import type { MDXComponents } from "mdx/types"
import Link from "next/link"

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ")
}

export const mdxComponents: MDXComponents = {
  h1: ({ className, children, ...props }) => (
    <h1
      className={cn(
        "text-[32px] md:text-[40px] font-semibold tracking-tight text-foreground mt-16 mb-6 first:mt-0",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ className, children, ...props }) => (
    <h2
      className={cn(
        "text-[24px] font-semibold tracking-tight text-foreground mt-12 mb-4",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ className, children, ...props }) => (
    <h3
      className={cn(
        "text-[20px] font-semibold tracking-tight text-foreground mt-8 mb-3",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ className, children, ...props }) => (
    <p
      className={cn(
        "text-[16px] leading-[1.75] text-foreground/80 mb-6",
        className
      )}
      {...props}
    >
      {children}
    </p>
  ),
  a: ({ className, href, children, ...props }) => {
    const isExternal = href?.startsWith("http")
    if (isExternal) {
      return (
        <a
          className={cn(
            "text-primary underline underline-offset-4 hover:text-primary/80 transition-colors",
            className
          )}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      )
    }
    return (
      <Link
        className={cn(
          "text-primary underline underline-offset-4 hover:text-primary/80 transition-colors",
          className
        )}
        href={href || "#"}
        {...props}
      >
        {children}
      </Link>
    )
  },
  ul: ({ className, children, ...props }) => (
    <ul
      className={cn("list-disc list-inside mb-6 space-y-2 text-foreground/80", className)}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ className, children, ...props }) => (
    <ol
      className={cn("list-decimal list-inside mb-6 space-y-2 text-foreground/80", className)}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ className, children, ...props }) => (
    <li
      className={cn("text-[16px] leading-[1.75]", className)}
      {...props}
    >
      {children}
    </li>
  ),
  blockquote: ({ className, children, ...props }) => (
    <blockquote
      className={cn(
        "border-l-2 border-primary pl-6 my-8 text-foreground/70 italic",
        className
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className
    if (isInline) {
      return (
        <code
          className={cn(
            "text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[14px] font-mono",
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code className={cn("text-[14px] font-mono", className)} {...props}>
        {children}
      </code>
    )
  },
  pre: ({ className, children, ...props }) => (
    <div className="relative mb-8 rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-foreground/10" />
          <div className="w-3 h-3 rounded-full bg-foreground/10" />
          <div className="w-3 h-3 rounded-full bg-foreground/10" />
        </div>
      </div>
      <pre
        className={cn(
          "p-4 overflow-x-auto bg-[#0a0a0a] text-foreground/90 text-[14px] leading-relaxed font-mono",
          className
        )}
        {...props}
      >
        {children}
      </pre>
    </div>
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cn("border-border my-12", className)}
      {...props}
    />
  ),
  strong: ({ className, children, ...props }) => (
    <strong className={cn("text-foreground font-semibold", className)} {...props}>
      {children}
    </strong>
  ),
  em: ({ className, children, ...props }) => (
    <em className={cn("text-foreground/80 italic", className)} {...props}>
      {children}
    </em>
  ),
  img: ({ className, src, alt, ...props }) => (
    <img
      className={cn("rounded-xl border border-border my-8 w-full", className)}
      src={src}
      alt={alt || ""}
      {...props}
    />
  ),
  table: ({ className, children, ...props }) => (
    <div className="overflow-x-auto mb-8 rounded-xl border border-border">
      <table className={cn("w-full text-[14px]", className)} {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ className, children, ...props }) => (
    <thead className={cn("bg-muted/50 border-b border-border", className)} {...props}>
      {children}
    </thead>
  ),
  tbody: ({ className, children, ...props }) => (
    <tbody className={cn("divide-y divide-border", className)} {...props}>
      {children}
    </tbody>
  ),
  th: ({ className, children, ...props }) => (
    <th
      className={cn(
        "px-4 py-3 text-left font-mono text-[13px] text-muted-foreground uppercase tracking-wider",
        className
      )}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ className, children, ...props }) => (
    <td className={cn("px-4 py-3 text-foreground/80", className)} {...props}>
      {children}
    </td>
  ),
}
