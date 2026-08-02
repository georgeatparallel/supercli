import Navbar from "@/components/homepage/navbar"
import Footer from "@/components/homepage/footer"
import Link from "next/link"

const caseStudies = [
  {
    slug: "dodo-payments",
    company: "Supercode",
    title: "How Supercode migrated from Polar to Dodo Payments",
    description:
      "A complete payment migration for 3200+ customers — zero downtime, zero lost revenue.",
    date: "Aug 02, 2026",
    tag: "Payments",
    color: "bg-emerald-100 dark:bg-emerald-900/30",
  },
]

export default function CaseStudyPage() {
  return (
    <main className="min-h-screen bg-background dark relative">
      <div className="fixed top-0 left-0 w-px h-full bg-border z-50" />
      <div className="fixed top-0 right-0 w-px h-full bg-border z-50" />

      <Navbar />

      <div className="pt-[120px] pb-24 px-6 max-w-[900px] mx-auto">
        <div className="text-center mb-20">
          <h1 className="text-[36px] md:text-[56px] font-serif italic font-semibold tracking-tight mb-4">
            Case Studies,
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[520px] mx-auto leading-relaxed">
            Learn how companies around the world are transforming with Supercode AI
            Payments.
          </p>
        </div>

        <div className="space-y-4">
          {caseStudies.map((study) => (
            <Link
              key={study.slug}
              href={`/case-study/${study.slug}`}
              className="group block"
            >
              <div className="flex flex-col md:flex-row rounded-2xl border border-border bg-card overflow-hidden [@media(hover:hover)]:hover:bg-accent/30 active:scale-[0.98] transition-[background-color,border-color,transform] duration-150 ease-out">
                <div className="relative shrink-0 md:w-[280px] aspect-[4/3] md:aspect-auto overflow-hidden bg-muted/50">
                  <img
                    src="/supercode-ddp.png"
                    alt={`${study.company} x Dodo Payments`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[12px] font-mono font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {study.tag}
                    </span>
                    <span className="text-[13px] text-muted-foreground font-mono">
                      {study.date}
                    </span>
                  </div>

                  <h2 className="text-[20px] md:text-[24px] font-semibold tracking-tight mb-3 group-hover:text-primary transition-colors duration-200">
                    {study.title}
                  </h2>

                  <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">
                    {study.description}
                  </p>

                  <span className="text-[13px] font-mono text-muted-foreground group-hover:text-foreground transition-colors duration-200">
                    Read more →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  )
}
