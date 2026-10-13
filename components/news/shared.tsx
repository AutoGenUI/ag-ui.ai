import Link from "next/link";
import {
  categoryNames,
  evidenceNames,
  type Locale,
  type NewsItem,
} from "@/lib/news/types";
export function SectionTitle({
  label,
  title,
  href,
  locale,
}: {
  label: string;
  title: string;
  href?: string;
  locale: Locale;
}) {
  return (
    <div className="n-section-title">
      <div>
        <span className="n-kicker">{label}</span>
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href}>
          {locale === "zh" ? "查看全部" : "View all"}{" "}
          <span aria-hidden="true">↗</span>
        </Link>
      )}
    </div>
  );
}
export function ArticleCard({
  item,
  locale,
  compact = false,
}: {
  item: NewsItem;
  locale: Locale;
  compact?: boolean;
}) {
  const c = item[locale];
  return (
    <article className={`n-card ${compact ? "n-compact" : ""}`}>
      <div className="n-meta">
        <span className={`n-tag n-${item.category}`}>
          {categoryNames[item.category][locale]}
        </span>
        <time dateTime={item.eventDate}>{item.eventDate}</time>
      </div>
      <h3>
        <Link href={`/${locale}/news/${item.slug}`}>{c.title}</Link>
      </h3>
      {!compact && <p>{c.summary}</p>}
      <div className="n-byline">
        <span>{item.sourceName}</span>
        <span>{evidenceNames[item.evidence][locale]}</span>
      </div>
    </article>
  );
}
export function PageHead({
  locale,
  eyebrow,
  title,
  description,
}: {
  locale: Locale;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="n-page-head">
      <div className="n-kicker">AG-UI.AI / {eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link className="n-text-link" href={`/${locale}/methodology`}>
        {locale === "zh" ? "了解编辑与核验方法" : "Our editorial method"} ↗
      </Link>
    </header>
  );
}
export function SubscribeBand({ locale }: { locale: Locale }) {
  return (
    <section className="n-subscribe-band">
      <div>
        <span className="n-kicker">THE WEEKLY BRIEF</span>
        <h2>
          {locale === "zh"
            ? "理解变化，不必追逐每条消息。"
            : "Understand the shift. Skip the noise."}
        </h2>
        <p>
          {locale === "zh"
            ? "用一份精选，串起生成式 UI 的一周。通过 RSS 阅读，或确认邮箱后接收周报。"
            : "A considered view of the week in Generative UI. Read with RSS, or confirm your email for the digest."}
        </p>
      </div>
      <Link className="n-button" href={`/${locale}/subscribe`}>
        {locale === "zh" ? "订阅与 RSS" : "Subscribe & RSS"} <span>↗</span>
      </Link>
    </section>
  );
}
