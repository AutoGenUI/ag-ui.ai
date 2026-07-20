import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarkdownArticle } from "@/components/markdown-article";
import { content, getTechnology, getTechnologyName } from "@/lib/content";
import { dictionary, isLocale, locales } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export function generateStaticParams() { return locales.flatMap((locale) => content.technologies[locale].map(({ slug }) => ({ locale, slug }))); }
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> { const { locale, slug } = await params; if (!isLocale(locale)) return {}; const item = getTechnology(locale, slug); return item ? pageMetadata(locale, `/technologies/${slug}`, item.title, item.summary) : {}; }

export default async function TechnologyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params; if (!isLocale(locale)) notFound(); const item = getTechnology(locale, slug); if (!item) notFound(); const t = dictionary[locale];
  const articleJsonLd = { "@context": "https://schema.org", "@type": "TechArticle", headline: item.title, description: item.summary, inLanguage: locale === "zh" ? "zh-Hans" : "en", dateModified: item.lastVerified, author: { "@type": "Organization", name: "AG-UI.AI Community" }, publisher: { "@type": "Organization", name: "AG-UI.AI" }, mainEntityOfPage: `https://ag-ui.ai/${locale}/technologies/${slug}` };
  const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "AG-UI.AI", item: `https://ag-ui.ai/${locale}` }, { "@type": "ListItem", position: 2, name: locale === "zh" ? "技术比较" : "Compare", item: `https://ag-ui.ai/${locale}/compare` }, { "@type": "ListItem", position: 3, name: item.title, item: `https://ag-ui.ai/${locale}/technologies/${slug}` }] };
  return <div className="section-shell article-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c") }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }} />
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href={`/${locale}`}>Atlas</Link><span>/</span><Link href={`/${locale}/compare`}>{locale === "zh" ? "技术比较" : "Compare"}</Link><span>/</span><span>{item.title}</span></nav>
    <header className={`technology-hero layer-bg-${item.layer}`}><div><span className="eyebrow">{item.layer} / {item.kind}</span><h1>{item.title}</h1><p>{item.summary}</p></div><div className="tech-facts"><div><small>{locale === "zh" ? "成熟度" : "Maturity"}</small><strong>{item.maturity.replace("-", " ")}</strong></div><div><small>{locale === "zh" ? "来源级别" : "Source authority"}</small><strong>{item.sourceAuthority}</strong></div><div><small>{locale === "zh" ? "许可证" : "License"}</small><strong>{item.license}</strong></div></div></header>
    {item.sourceAuthority === "ecosystem" && <aside className="source-warning"><strong>{locale === "zh" ? "来源说明" : "Source note"}</strong><p>{locale === "zh" ? "本条目依据生态实现文档描述，不代表已核验的独立官方标准。" : "This profile is described from ecosystem implementation documentation and is not presented as a verified independent official standard."}</p></aside>}
    <div className="article-grid"><article><MarkdownArticle body={item.body} /></article><aside className="article-aside">
      <section><h2>{locale === "zh" ? "适合选择" : "Choose when"}</h2><ul>{item.chooseWhen.map((value) => <li key={value}>{value}</li>)}</ul></section>
      <section><h2>{locale === "zh" ? "不适合选择" : "Avoid when"}</h2><ul>{item.avoidWhen.map((value) => <li key={value}>{value}</li>)}</ul></section>
      <section><h2>{locale === "zh" ? "常见组合" : "Composes with"}</h2><div className="compose-list">{item.composesWith.length ? item.composesWith.map((value) => <span key={value}>{getTechnologyName(locale, value)}</span>) : <span>—</span>}</div></section>
      <section><h2>{locale === "zh" ? "已核验来源" : "Verified sources"}</h2><ol className="source-list">{item.officialSources.map((source, index) => <li key={source}><a href={source} target="_blank" rel="noreferrer">{index === 0 ? t.source : `${t.source} ${index + 1}`} ↗</a></li>)}</ol><p className="verified-date">{t.verified}: <time dateTime={item.lastVerified}>{item.lastVerified}</time></p></section>
      <a className="edit-link" href={`https://github.com/AutoGenUI/ag-ui.ai/edit/main/content/${locale}/technologies/${slug}.md`}>{t.edit} ↗</a>
    </aside></div>
  </div>;
}
