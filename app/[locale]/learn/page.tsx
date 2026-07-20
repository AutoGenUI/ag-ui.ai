import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCollection } from "@/lib/content";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { const { locale } = await params; return isLocale(locale) ? pageMetadata(locale, "/learn", locale === "zh" ? "生成式 UI 学习路径" : "Generative UI learning paths", locale === "zh" ? "从生态分层到架构决策和生产安全的三条学习路线。" : "Three learning routes from ecosystem layers to architecture decisions and production safety.") : {}; }
export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); const paths = getCollection("learn", locale); return <div className="section-shell page-shell"><header className="page-header"><span className="eyebrow">Learning paths</span><h1>{locale === "zh" ? "从看懂，到选对，再到安全运行。" : "Understand it. Choose it. Operate it safely."}</h1><p>{locale === "zh" ? "每条路径都有明确成果、练习和检查点，不依赖模型密钥。" : "Each route has a concrete outcome, practice and checkpoint—no model key required."}</p></header><div className="learning-list">{paths.map((path, index) => <article key={path.slug}><span className="path-number">0{index + 1}</span><div><small>{path.level} · {path.duration}</small><h2><Link href={`/${locale}/learn/${path.slug}`}>{path.title}</Link></h2><p>{path.summary}</p></div><Link className="button-secondary" href={`/${locale}/learn/${path.slug}`}>{locale === "zh" ? "开始 →" : "Begin →"}</Link></article>)}</div></div>; }
