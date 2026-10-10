import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { newsroom } from "@/lib/news/data";
import {
  ArticleCard,
  SectionTitle,
  SubscribeBand,
} from "@/components/news/shared";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata(
    locale,
    "",
    locale === "zh" ? "生成式 UI 新闻与趋势" : "Generative UI news & signals",
    locale === "zh"
      ? "持续追踪生成式 UI 的新闻、研究、技术脉络与趋势。"
      : "An independent, source-linked view of Generative UI news, research and emerging directions.",
  );
}
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const zh = locale === "zh";
  const { items, trends, freshness } = await newsroom();
  const lead =
    items.find((x) => x.slug === "openai-gpt6-intelligent-ui") || items[0];
  const supporting = items.filter((x) => x.slug !== lead.slug).slice(0, 3);
  const latest = items
    .filter(
      (x) => !supporting.some((s) => s.slug === x.slug) && x.slug !== lead.slug,
    )
    .slice(0, 6);
  return (
    <div className="newsroom">
      <div className="n-edition">
        <span>
          <i /> {zh ? "独立生成式 UI 观察站" : "THE GENERATIVE UI OBSERVATORY"}
        </span>
        <span>
          {zh ? "中英双语 · 原始来源可追溯" : "BILINGUAL · SOURCE-LINKED"}
        </span>
      </div>
      <header className="n-masthead">
        <h1>
          {zh ? (
            <>
              追踪界面的
              <br />
              <em>下一种可能。</em>
            </>
          ) : (
            <>
              The next interface.
              <br />
              <em>In perspective.</em>
            </>
          )}
        </h1>
        <div>
          <p>
            {zh
              ? "新闻、研究与实践，串起生成式 UI 的发展脉络。面向构建它、设计它，以及想理解它的人。"
              : "News, research and practice from the evolving world of Generative UI. For the people building it, designing it, and making sense of it."}
          </p>
          <Link href={`/${locale}/timeline`}>
            {zh ? "探索发展脉络" : "Explore the timeline"} <span>↗</span>
          </Link>
        </div>
      </header>
      <div className="n-status">
        {freshness.lastSuccess && !freshness.stale ? (
          <>
            <span className="n-status-dot" />
            {zh ? "最近采集" : "Last collection"}{" "}
            {freshness.lastSuccess.slice(0, 16).replace("T", " ")} UTC
          </>
        ) : (
          <>
            <span className="n-status-dot stale" />
            {zh
              ? "自动采集尚无近期成功记录，请以各条核验日期为准。"
              : "No recent successful automatic collection. Check each story’s verification date."}
          </>
        )}
        <Link href={`/${locale}/sources`}>
          {zh ? "来源与状态" : "Sources & status"} ↗
        </Link>
      </div>
      <section
        className="n-lead-grid"
        aria-label={zh ? "重点报道" : "Featured stories"}
      >
        <article className="n-lead">
          <div className="n-kicker">
            01 / {zh ? "焦点" : "IN FOCUS"} <span>{lead.eventDate}</span>
          </div>
          <h2>
            <Link href={`/${locale}/news/${lead.slug}`}>
              {lead[locale].title}
            </Link>
          </h2>
          <p>{lead[locale].summary}</p>
          <div className="n-interface-art" aria-hidden="true">
            <div className="n-art-prompt">
              <span>↗</span> From a question to an interface <i />
            </div>
            <div className="n-art-canvas">
              <div className="n-art-sidebar">
                <b />
                <span />
                <span />
                <span />
              </div>
              <div className="n-art-content">
                <div className="n-art-bars">
                  {[30, 52, 43, 74, 60, 93, 82].map((h, i) => (
                    <i key={i} style={{ height: h + "%" }} />
                  ))}
                </div>
                <div className="n-art-cards">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <span className="n-art-cursor">↖</span>
            </div>
            <div className="n-art-caption">
              INTENT → STRUCTURE → INTERACTION
            </div>
          </div>
          <div className="n-lead-bottom">
            <span>
              {lead.sourceName} · {zh ? "官方公告" : "Official announcement"}
            </span>
            <Link href={`/${locale}/news/${lead.slug}`}>
              {zh ? "阅读全文" : "Read the story"} ↗
            </Link>
          </div>
        </article>
        <aside className="n-briefs">
          <div className="n-kicker">{zh ? "最新信号" : "ON THE RADAR"}</div>
          {supporting.map((item, i) => (
            <div className="n-brief" key={item.slug}>
              <span className="n-brief-number">0{i + 2}</span>
              <ArticleCard item={item} locale={locale} compact />
            </div>
          ))}
        </aside>
      </section>
      <section>
        <SectionTitle
          locale={locale}
          label="LATEST DISPATCHES"
          title={zh ? "最新动态" : "Latest dispatches"}
          href={`/${locale}/news`}
        />
        <div className="n-news-grid">
          {latest.map((x) => (
            <ArticleCard key={x.slug} item={x} locale={locale} />
          ))}
        </div>
      </section>
      <section className="n-trend-section">
        <SectionTitle
          locale={locale}
          label="CONNECTING THE DOTS"
          title={zh ? "变化正在发生在哪里" : "Where the field is moving"}
          href={`/${locale}/trends`}
        />
        <div className="n-trends">
          {trends.map((t, i) => (
            <Link
              key={t.slug}
              className="n-trend"
              href={`/${locale}/trends/${t.slug}`}
            >
              <span>
                0{i + 1} <b>↗</b>
              </span>
              <h3>{t[locale].title}</h3>
              <p>{t[locale].summary}</p>
              <small>
                {t.items.length}{" "}
                {zh
                  ? "条支持事件 · 本站分析"
                  : "supporting events · Our analysis"}
              </small>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle
          locale={locale}
          label="A FIELD IN THE MAKING"
          title={zh ? "近期里程碑" : "Recent milestones"}
          href={`/${locale}/timeline`}
        />
        <div className="n-milestones">
          {items
            .filter((x) => x.evidence === "official")
            .slice(0, 4)
            .map((x) => (
              <Link href={`/${locale}/news/${x.slug}`} key={x.slug}>
                <time>{x.eventDate}</time>
                <span />
                <h3>{x[locale].title}</h3>
              </Link>
            ))}
        </div>
      </section>
      <SubscribeBand locale={locale} />
    </div>
  );
}
