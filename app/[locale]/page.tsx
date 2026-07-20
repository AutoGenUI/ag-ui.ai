import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DecisionTool } from "@/components/decision-tool";
import { LayerMap } from "@/components/layer-map";
import { SearchPanel } from "@/components/search-panel";
import { TechnologyCard } from "@/components/technology-card";
import { getCollection } from "@/lib/content";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

const homeCopy = {
  en: {
    label: "Independent · Source-verified · Open",
    title: "Choose the right layer for your Generative UI stack.",
    intro: "A field guide to the protocols, declarative specifications, renderers and host surfaces behind interfaces that agents can shape at runtime.",
    explore: "Explore the ecosystem", lab: "Open the event lab", mapTitle: "One ecosystem. Four architectural questions.", mapText: "These technologies compose across layers. Compare their responsibilities before comparing their APIs.",
    profiles: "Core technology profiles", profilesText: "Seven source-backed guides using the same decision framework—without a winner-takes-all ranking.", all: "Compare all technologies",
    learn: "From mental model to production boundary", learnText: "Three focused routes for understanding the stack, making an architecture decision, and operating it safely.",
  },
  zh: {
    label: "独立 · 来源核验 · 开放共建",
    title: "看懂生成式 UI 技术栈的每一层，并做对选择。",
    intro: "一份面向开发者的技术图谱，解释 Agent 在运行时塑造界面所涉及的协议、声明式规格、渲染器和宿主表面。",
    explore: "浏览生态图谱", lab: "打开事件实验室", mapTitle: "一个生态，四个架构问题。", mapText: "这些技术跨层组合。比较 API 之前，先区分它们各自承担的职责。",
    profiles: "核心技术档案", profilesText: "七份使用同一决策框架的一手来源指南，不做赢家通吃式排名。", all: "比较全部技术",
    learn: "从心智模型到生产边界", learnText: "三条聚焦路线，依次帮助你理解技术栈、做出架构选择，并安全地投入运行。",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = homeCopy[locale];
  return pageMetadata(locale, "", "Generative UI Atlas", c.intro);
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = homeCopy[locale];
  const technologies = getCollection("technologies", locale);
  const paths = getCollection("learn", locale);
  return <>
    <section className="hero section-shell">
      <div className="hero-copy"><span className="eyebrow"><i />{c.label}</span><h1>{c.title}</h1><p>{c.intro}</p><div className="hero-actions"><Link className="button-primary" href={`/${locale}/map`}>{c.explore} →</Link><Link className="button-secondary" href={`/${locale}/lab/ag-ui-events`}>{c.lab}</Link></div></div>
      <div className="hero-signal" aria-label={locale === "zh" ? "生成式 UI 事件流示意" : "Generative UI event flow illustration"}>
        <div className="signal-header"><span>LIVE EVENT TRACE</span><span>RUN_8F2A</span></div>
        <div className="signal-line"><b>01</b><span className="signal-dot signal-blue" /><code>RUN_STARTED</code><small>agent → client</small></div>
        <div className="signal-line"><b>02</b><span className="signal-dot signal-violet" /><code>TEXT_MESSAGE_CONTENT</code><small>streaming</small></div>
        <div className="signal-line"><b>03</b><span className="signal-dot signal-coral" /><code>TOOL_CALL_START</code><small>render_card</small></div>
        <div className="signal-card"><span>GENERATED SURFACE</span><strong>{locale === "zh" ? "架构建议已就绪" : "Architecture recommendation ready"}</strong><div><i /><i /><i /></div></div>
        <div className="signal-line"><b>04</b><span className="signal-dot signal-green" /><code>USER_ACTION</code><small>approved</small></div>
      </div>
    </section>
    <section className="section-shell section-block">
      <div className="section-heading"><div><span className="eyebrow">Ecosystem / 01</span><h2>{c.mapTitle}</h2><p>{c.mapText}</p></div><Link href={`/${locale}/map`}>{c.explore} →</Link></div>
      <LayerMap locale={locale} compact />
    </section>
    <section className="section-shell section-block section-rule">
      <div className="section-heading"><div><span className="eyebrow">Profiles / 02</span><h2>{c.profiles}</h2><p>{c.profilesText}</p></div><Link href={`/${locale}/compare`}>{c.all} →</Link></div>
      <div className="technology-grid">{technologies.map((technology) => <TechnologyCard locale={locale} technology={technology} key={technology.slug} />)}</div>
    </section>
    <section className="section-shell section-block section-rule"><DecisionTool locale={locale} /></section>
    <section className="section-shell section-block section-rule learning-section">
      <div className="section-heading"><div><span className="eyebrow">Learning / 03</span><h2>{c.learn}</h2><p>{c.learnText}</p></div><Link href={`/${locale}/learn`}>{locale === "zh" ? "全部学习路径 →" : "All learning paths →"}</Link></div>
      <div className="path-grid">{paths.map((path, index) => <Link href={`/${locale}/learn/${path.slug}`} className="path-card" key={path.slug}><span>0{index + 1}</span><small>{path.level} · {path.duration}</small><h3>{path.title}</h3><p>{path.summary}</p><b>{locale === "zh" ? "开始学习 →" : "Start path →"}</b></Link>)}</div>
    </section>
    <section className="section-shell search-section"><div><span className="eyebrow">Index / 04</span><h2>{locale === "zh" ? "从一个问题开始" : "Start with a question"}</h2></div><SearchPanel locale={locale} /></section>
  </>;
}
