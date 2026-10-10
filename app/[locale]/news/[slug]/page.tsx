import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { newsroom } from "@/lib/news/data";
import { categoryNames, evidenceNames } from "@/lib/news/types";
import { ArticleCard } from "@/components/news/shared";
import { pageMetadata } from "@/lib/metadata";
import { database } from "@/lib/news/runtime";
import { articles } from "@/lib/news/store";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const x = (await newsroom()).items.find((x) => x.slug === slug);
  return x
    ? pageMetadata(locale, `news/${slug}`, x[locale].title, x[locale].summary)
    : {};
}
export default async function Article({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const zh = locale === "zh";
  const { items, trends } = await newsroom();
  let item = items.find((x) => x.slug === slug);
  let revisions: { reason: string; created_at: string }[] = [];
  try {
    const db = database();
    if (!item)
      item = (await articles(db, true)).find(
        (x) => x.slug === slug && x.status === "withdrawn",
      );
    revisions = (
      await db
        .prepare(
          "SELECT reason,created_at FROM revisions WHERE slug=? ORDER BY created_at DESC",
        )
        .bind(slug)
        .all<{ reason: string; created_at: string }>()
    ).results;
  } catch {}
  if (!item) notFound();
  const c = item[locale];
  const related = items
    .filter(
      (x) =>
        x.slug !== slug &&
        (x.project === item.project || x.category === item.category),
    )
    .slice(0, 3);
  return (
    <div className="newsroom">
      <nav className="n-breadcrumb">
        <Link href={`/${locale}/news`}>{zh ? "新闻" : "News"}</Link>
        <span>/ {item.project}</span>
      </nav>
      <div className="n-article-layout">
        <article className="n-article">
          <div className="n-meta">
            <span className="n-tag">
              {categoryNames[item.category][locale]}
            </span>
            <span>{evidenceNames[item.evidence][locale]}</span>
          </div>
          <h1>{c.title}</h1>
          <p className="n-deck">{c.summary}</p>
          {item.status === "withdrawn" && (
            <p className="n-warning">
              {zh
                ? "此条目已撤回，请查看修订记录。"
                : "This item has been withdrawn. See the revision record."}
            </p>
          )}
          <div className="n-article-dates">
            <span>
              {zh ? "事件" : "Event"} <time>{item.eventDate}</time>
            </span>
            <span>
              {zh ? "原文发布" : "Source published"}{" "}
              <time>{item.publishedAt}</time>
            </span>
            <span>
              {zh ? "本站收录" : "Indexed"}{" "}
              <time>{item.indexedAt.slice(0, 10)}</time>
            </span>
            <span>
              {zh ? "最后核验" : "Verified"} <time>{item.verifiedAt}</time>
            </span>
          </div>
          <h2>{zh ? "为什么值得关注" : "Why it matters"}</h2>
          <p>{c.why}</p>
          <h2>{zh ? "技术细节" : "A closer look"}</h2>
          <p>{c.details}</p>
          <aside className="n-evidence-note">
            <span className="n-kicker">
              {zh ? "证据边界" : "THE LIMITS OF THE EVIDENCE"}
            </span>
            <p>{c.caveat}</p>
          </aside>
          <h2>{zh ? "适合哪些读者" : "Who this is for"}</h2>
          <p>{c.audience}</p>
          <h2>{zh ? "原始来源" : "Original sources"}</h2>
          <ul className="n-source-links">
            {[
              { url: item.canonicalUrl, label: item.sourceName },
              ...(item.sources || []).filter(
                (s) => s.url !== item.canonicalUrl,
              ),
            ].map((s) => (
              <li key={s.url}>
                <a
                  data-source
                  href={s.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {s.label} ↗<small>{new URL(s.url).hostname}</small>
                </a>
              </li>
            ))}
          </ul>
          <details className="n-revisions">
            <summary>
              {zh ? "修订与更正记录" : "Revisions & corrections"} (
              {revisions.length || 1})
            </summary>
            {revisions.length ? (
              revisions.map((r, i) => (
                <p key={i}>
                  <time>{r.created_at.slice(0, 10)}</time> — {r.reason}
                </p>
              ))
            ) : (
              <p>
                {item.indexedAt.slice(0, 10)} —{" "}
                {zh
                  ? "首次收录，已核验原始来源。"
                  : "Initial collection; original source reviewed."}
              </p>
            )}
          </details>
        </article>
        <aside className="n-article-aside">
          <span className="n-kicker">
            {zh ? "关联趋势" : "PART OF THE PICTURE"}
          </span>
          {trends
            .filter((t) => t.items.includes(slug))
            .map((t) => (
              <Link key={t.slug} href={`/${locale}/trends/${t.slug}`}>
                {t[locale].title} ↗
              </Link>
            ))}
          <Link href={`/${locale}/timeline`}>
            {zh ? "在时间线中探索" : "Explore the timeline"} ↗
          </Link>
          <p>
            {zh
              ? "独立编辑，不代表相关项目或公司。内容是基于来源的摘要与解读，非产品背书。"
              : "Independent coverage, unaffiliated with the projects and companies described. Summaries and analysis are not endorsements."}
          </p>
        </aside>
      </div>
      {related.length > 0 && (
        <section>
          <h2>{zh ? "相关事件" : "Related events"}</h2>
          <div className="n-news-grid">
            {related.map((x) => (
              <ArticleCard key={x.slug} item={x} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
