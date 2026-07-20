import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarkdownArticle } from "@/components/markdown-article";
import { content } from "@/lib/content";
import { isLocale, locales } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export function generateStaticParams() { return locales.flatMap((locale) => content.learn[locale].map(({ slug }) => ({ locale, slug }))); }
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> { const { locale, slug } = await params; if (!isLocale(locale)) return {}; const item = content.learn[locale].find((entry) => entry.slug === slug); return item ? pageMetadata(locale, `/learn/${slug}`, item.title, item.summary) : {}; }
export default async function LearningPathPage({ params }: { params: Promise<{ locale: string; slug: string }> }) { const { locale, slug } = await params; if (!isLocale(locale)) notFound(); const item = content.learn[locale].find((entry) => entry.slug === slug); if (!item) notFound(); return <div className="section-shell article-shell learning-article"><nav className="breadcrumbs"><Link href={`/${locale}`}>Atlas</Link><span>/</span><Link href={`/${locale}/learn`}>{locale === "zh" ? "学习路径" : "Learn"}</Link><span>/</span><span>{item.title}</span></nav><header className="page-header"><span className="eyebrow">{item.level} · {item.duration}</span><h1>{item.title}</h1><p>{item.summary}</p></header><article className="single-article"><MarkdownArticle body={item.body} /><div className="article-next"><Link href={`/${locale}/lab/ag-ui-events`}>{locale === "zh" ? "继续：打开事件实验室 →" : "Continue: open the event lab →"}</Link></div></article></div>; }
