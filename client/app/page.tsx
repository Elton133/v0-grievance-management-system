"use client"

import { useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, FormEvent } from "react"
import Link from "next/link"
import { ArrowRight, BarChart3, Check, Clock3, FileCheck2, Layers3, Menu, MessageSquareText, Network, Send, ShieldCheck, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { useSettings } from "@/lib/settings-context"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { organizationHeaders } from "@/lib/organization"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
const features = [
  [Network, "Structured resolution workflows", "Route every case through the right people, with clear ownership, escalation levels and a complete timeline."],
  [MessageSquareText, "One place for every conversation", "Keep comments, evidence, updates and internal notes attached to the case instead of scattered across channels."],
  [BarChart3, "Decisions backed by data", "See recurring issues, response times and resolution trends so leadership can improve the institution—not just close tickets."],
] as const
const steps = [
  ["01", "Submit", "A student or staff member raises a concern through a guided, accessible form."],
  ["02", "Route", "The platform sends it to the appropriate reviewer and tracks each escalation."],
  ["03", "Resolve", "Everyone sees progress while authorized teams collaborate toward a documented outcome."],
]

export default function HomePage() {
  const { settings } = useSettings()
  const content = settings.marketingContent
  const pageRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function requestDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/demo-requests`, {
        method: "POST", headers: { "Content-Type": "application/json", ...organizationHeaders() },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "We could not send your request.")
      form.reset()
      toast.success("Demo request received", { description: "Thanks—we’ll be in touch to arrange a walkthrough." })
    } catch (error) {
      toast.error("Could not submit the request", { description: error instanceof Error ? error.message : "Please try again shortly." })
    } finally { setIsSubmitting(false) }
  }

  const brandStyle = {
    "--brand": settings.primaryColor || "#2563eb",
    "--brand-dark": settings.accentColor || "#0f172a",
  } as CSSProperties

  useLayoutEffect(() => {
    if (!pageRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    gsap.registerPlugin(ScrollTrigger)
    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .from("main > section:first-of-type > div:first-child > *", { y: 28, opacity: 0, duration: 0.75, stagger: 0.1 })
        .from("main > section:first-of-type > div:nth-child(2)", { x: 54, y: 20, opacity: 0, rotate: 1.5, duration: 1 }, "-=0.65")
        .from("main > section:first-of-type [style*='height']", { scaleY: 0, transformOrigin: "bottom", duration: 0.65, stagger: 0.045 }, "-=0.5")

      gsap.utils.toArray<HTMLElement>("#platform .max-w-2xl, #how > div > div:first-child").forEach((element) => {
        gsap.from(element, { y: 36, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 84%", once: true } })
      })
      gsap.from("#platform article", { y: 44, opacity: 0, duration: 0.75, stagger: 0.14, ease: "power3.out", scrollTrigger: { trigger: "#platform", start: "top 68%", once: true } })
      gsap.from("#how .divide-y > div", { x: 36, opacity: 0, duration: 0.7, stagger: 0.13, ease: "power3.out", scrollTrigger: { trigger: "#how", start: "top 70%", once: true } })
      gsap.from("#trust > div", { scale: 0.96, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: "#trust", start: "top 78%", once: true } })
      gsap.from("#demo > div > *", { y: 38, opacity: 0, duration: 0.8, stagger: 0.12, ease: "power3.out", scrollTrigger: { trigger: "#demo", start: "top 72%", once: true } })
    }, pageRef)
    return () => context.revert()
  }, [])

  return <main ref={pageRef} style={brandStyle} className="marketing-page min-h-screen overflow-hidden bg-[#f8fafc] text-[#0f172a]">
    <style>{`
      .marketing-page [class*="bg-[#d8ebcd]"] { background-color: #dbeafe !important; }
      .marketing-page [class*="border-[#b9d8c6]"] { border-color: #bfdbfe !important; }
      .marketing-page [class*="bg-[#eaf5ed]"] { background-color: #eff6ff !important; }
      .marketing-page [class*="bg-[#2b7957]"] { background-color: var(--brand) !important; }
      .marketing-page [class*="bg-[#cee2d4]"] { background-color: #bfdbfe !important; }
      .marketing-page [class*="bg-[#e7f5eb]"] { background-color: #dbeafe !important; }
      .marketing-page [class*="text-[#267151]"] { color: var(--brand) !important; }
      .marketing-page .bg-green-400 { background-color: #60a5fa !important; }
    `}</style>
    <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
      <Link href="/" className="flex items-center gap-2.5"><BrandLogo logoUrl={settings.logoUrl}/><span className="text-xl font-semibold tracking-[-.04em]">{settings.organizationName}</span></Link>
      <div className="hidden items-center gap-8 text-sm text-slate-600 md:flex"><a href="#platform">Platform</a><a href="#how">How it works</a><a href="#trust">Trust</a></div>
      <div className="hidden items-center gap-3 md:flex"><Link href="/login" className="px-4 py-2 text-sm font-medium">Sign in</Link><a href="#demo" className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white">Request a demo</a></div>
      <button className="p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X/> : <Menu/>}</button>
      {menuOpen && <div className="absolute left-5 right-5 top-16 rounded-2xl border bg-white p-4 shadow-xl md:hidden"><a href="#platform" className="block p-3">Platform</a><a href="#how" className="block p-3">How it works</a><Link href="/login" className="block p-3">Sign in</Link><a href="#demo" className="mt-2 block rounded-xl bg-[var(--brand)] p-3 text-center text-white">Request a demo</a></div>}
    </nav>

    <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-14 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:pb-32 lg:pt-24">
      <div className="relative z-10"><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-3.5 py-2 text-xs font-medium text-[var(--brand)]"><Sparkles className="size-3.5"/>{content.heroBadge}</div>
        <h1 className="max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-.055em] sm:text-6xl lg:text-[5.2rem]">{content.heroTitle} <span className="text-[var(--brand)]">{content.heroHighlight}</span></h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">{content.heroDescription}</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row"><a href="#demo" className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 py-3.5 font-medium text-white shadow-xl">{content.primaryCta} <ArrowRight className="size-4"/></a><Link href="/login" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/70 px-6 py-3.5 font-medium">Open the platform</Link></div>
        <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">{["Clear accountability","Configurable workflows","Live case tracking"].map(x=><span key={x} className="flex items-center gap-2"><Check className="size-4 text-[var(--brand)]"/>{x}</span>)}</div>
      </div>
      <DashboardPreview/>
    </section>

    <section id="platform" className="bg-[var(--brand-dark)] px-5 py-24 text-white lg:px-8 lg:py-32"><div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-sm uppercase tracking-[.18em] text-blue-300">A better way forward</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Good institutions don’t hide problems. They resolve them.</h2></div><div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-3">{features.map(([Icon,title,description])=><article key={title} className="bg-[var(--brand-dark)] p-8 lg:p-10"><span className="grid size-11 place-items-center rounded-xl bg-blue-100 text-[var(--brand)]"><Icon className="size-5"/></span><h3 className="mt-8 text-xl font-medium">{title}</h3><p className="mt-3 leading-7 text-slate-300">{description}</p></article>)}</div></div></section>

    <section id="how" className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32"><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm uppercase tracking-[.18em] text-[var(--brand)]">Simple by design</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">From voice to visible progress.</h2><p className="mt-5 max-w-md leading-7 text-slate-500">A clear journey for the person raising a concern and the team responsible for resolving it.</p></div><div className="divide-y divide-slate-200 border-y border-slate-200">{steps.map(([n,t,d])=><div key={n} className="grid gap-3 py-7 sm:grid-cols-[64px_130px_1fr]"><span className="font-mono text-sm text-[var(--brand)]">{n}</span><h3 className="text-lg font-medium">{t}</h3><p className="leading-7 text-slate-500">{d}</p></div>)}</div></div></section>

    <section id="trust" className="px-5 pb-24 lg:px-8 lg:pb-32"><div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] bg-slate-100 p-8 sm:p-12 lg:grid-cols-3 lg:p-16"><div><ShieldCheck className="size-10 text-[var(--brand)]"/><h2 className="mt-6 text-3xl font-semibold">Built around trust.</h2></div><div className="grid gap-6 sm:grid-cols-3 lg:col-span-2">{[["Role-aware access","People only see and act on cases appropriate to their responsibility."],["Complete audit trail","Changes, comments and decisions remain traceable from submission to resolution."],["Your workflow","Adapt roles, case types, branding and escalation paths to your teams."]].map(([t,d])=><div key={t}><h3 className="font-medium">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{d}</p></div>)}</div></div></section>

    <section id="demo" className="bg-blue-100 px-5 py-24 lg:px-8"><div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[.9fr_1.1fr]"><div><p className="text-sm uppercase tracking-[.18em] text-[var(--brand)]">See it in action</p><h2 className="mt-4 max-w-lg text-4xl font-semibold tracking-[-.045em] sm:text-5xl">{content.demoTitle}</h2><p className="mt-5 max-w-md leading-7 text-slate-600">{content.demoDescription}</p><div className="mt-8 flex items-center gap-3 text-sm"><Clock3 className="size-5"/>A focused, no-pressure walkthrough</div></div>
      <form onSubmit={requestDemo} className="grid gap-4 rounded-[1.5rem] bg-white p-6 shadow-xl sm:grid-cols-2 sm:p-8"><Field name="name" label="Your name" placeholder="Jane Doe"/><Field name="email" label="Work email" type="email" placeholder="jane@institution.edu"/><label className="text-sm font-medium sm:col-span-2">Institution<input required name="organization" className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-[var(--brand)]" placeholder="Your university or organization"/></label><label className="text-sm font-medium sm:col-span-2">What would you like to improve?<textarea required name="message" rows={4} className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white p-4 outline-none focus:border-[var(--brand)]" placeholder="Tell us about your current process and team..."/></label><button disabled={isSubmitting} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-6 font-medium text-white disabled:opacity-60 sm:col-span-2">{isSubmitting ? "Sending request…" : "Request my demo"}<Send className="size-4"/></button><p className="text-center text-xs text-slate-500 sm:col-span-2">By submitting, you agree to be contacted about your request.</p></form>
    </div></section>
    <footer className="bg-[var(--brand-dark)] px-5 py-8 text-slate-300"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm sm:flex-row sm:justify-between"><span className="font-medium text-white">{settings.organizationName}</span><p>{content.footerTagline}</p>{settings.supportEmail ? <a href={`mailto:${settings.supportEmail}`} className="text-white">{settings.supportEmail}</a> : <Link href="/login" className="text-white">Platform sign in</Link>}</div></footer>
  </main>
}

function Field({name,label,type="text",placeholder}:{name:string,label:string,type?:string,placeholder:string}) { return <label className="text-sm font-medium">{label}<input required name={name} type={type} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-[var(--brand)]" placeholder={placeholder}/></label> }

function BrandLogo({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) return <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-white shadow-sm"><img src={logoUrl} alt="" className="size-full object-contain" /></span>
  return <span className="grid size-9 place-items-center rounded-xl bg-[var(--brand)] text-white"><Layers3 className="size-5"/></span>
}

function DashboardPreview() { return <div className="relative"><div className="absolute -right-20 -top-20 size-80 rounded-full bg-[#d8ebcd] blur-3xl"/><div className="relative rounded-[2rem] border border-white bg-white/80 p-3 shadow-[0_30px_80px_rgba(32,51,40,.16)]"><div className="overflow-hidden rounded-[1.4rem] border bg-[#f9faf7]"><div className="flex items-center justify-between border-b bg-white px-5 py-4"><span className="flex gap-2"><i className="size-2.5 rounded-full bg-red-400"/><i className="size-2.5 rounded-full bg-amber-400"/><i className="size-2.5 rounded-full bg-green-400"/></span><span className="text-xs text-[#7a867e]">Institution overview</span></div><div className="p-6"><p className="text-xs text-[#8a958d]">Good morning</p><h3 className="mt-1 text-xl font-semibold">Case overview</h3><div className="mt-5 grid grid-cols-3 gap-3">{[["24","Open cases"],["86%","On time"],["4.2h","First reply"]].map(([v,l],i)=><div key={l} className={`rounded-xl border p-3 ${i===0?"border-[#b9d8c6] bg-[#eaf5ed]":"bg-white"}`}><p className="text-2xl font-semibold">{v}</p><p className="text-[11px] text-[#78847b]">{l}</p></div>)}</div><div className="mt-4 rounded-xl border bg-white p-4"><p className="text-xs font-medium">Resolution activity</p><div className="mt-5 flex h-28 items-end gap-2">{[36,52,44,72,58,86,66,92,74,100].map((h,i)=><span key={i} style={{height:`${h}%`}} className={`flex-1 rounded-t ${i>6?"bg-[#2b7957]":"bg-[#cee2d4]"}`}/>)}</div></div><div className="mt-4 space-y-2">{["Academic appeal","Campus facilities","Student services"].map((x,i)=><div key={x} className="flex items-center gap-3 rounded-xl border bg-white p-3"><span className="grid size-8 place-items-center rounded-lg bg-[#e7f5eb] text-[#267151]"><FileCheck2 className="size-4"/></span><div className="flex-1"><p className="text-xs font-medium">{x}</p><p className="text-[10px] text-[#89938c]">{i===2?"Resolved":"Under review"}</p></div></div>)}</div></div></div></div></div> }
