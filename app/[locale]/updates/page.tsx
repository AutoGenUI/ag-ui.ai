import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarkdownArticle } from "@/components/markdown-article";
import { getCollection } from "@/lib/content";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { const { locale } = await params; return isLocale(locale) ? pageMetadata(locale, "/updates", locale === "zh" ? "生成式 UI 生态更新" : "Generative UI ecosystem updates", locale === "zh" ? "记录上游来源、成熟度、许可证和版本状态变化。" : "Verified changes to upstream sources, maturity, licenses and version status.") : {}; }
export default async function UpdatesPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); const posts = getCollection("updates", locale); return <div className="section-shell page-shell"><header className="page-header"><span className="eyebrow">Updates · <a href="/feed.xml">RSS ↗</a></span><h1>{locale === "zh" ? "变化被记录，结论才可信。" : "Guidance stays credible when change is recorded."}</h1><p>{locale === "zh" ? "每周巡检上游状态；任何内容变化都经过 Issue 与人工审核。" : "Upstream state is checked weekly; content changes remain issue- and review-driven."}</p></header><div className="updates-list">{posts.map((post) => <article id={post.slug} key={post.slug}><div className="update-meta"><time dateTime={post.publishedAt}>{post.publishedAt}</time><span>{locale === "zh" ? "核验快照" : "verified snapshot"}</span></div><h2>{post.title}</h2><p className="update-summary">{post.summary}</p><MarkdownArticle body={post.body} /></article>)}</div></div>; }
