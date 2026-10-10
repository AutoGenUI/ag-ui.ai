import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { newsroom } from "@/lib/news/data";
import { PageHead, ArticleCard } from "@/components/news/shared";
export const dynamic = "force-dynamic";
export default async function Trend({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const { items, trends } = await newsroom(),
    t = trends.find((t) => t.slug === slug);
  if (!t) notFound();
  return (
    <div className="newsroom">
      <PageHead
        locale={locale}
        eyebrow="OUR ANALYSIS"
        title={t[locale].title}
        description={t[locale].summary}
      />
      <p className="n-meta">
        {locale === "zh" ? "专题更新" : "Updated"} {t.updatedAt.slice(0, 10)}
      </p>
      <aside className="n-evidence-note">
        <h2>
          {locale === "zh"
            ? "局限与需要检验的反例"
            : "Limits & counterevidence to examine"}
        </h2>
        <p>{t[locale].limitation}</p>
      </aside>
      <h2>{locale === "zh" ? "支持事件与证据链" : "The supporting events"}</h2>
      <div className="n-news-grid">
        {t.items
          .map((s) => items.find((x) => x.slug === s))
          .filter((x) => !!x)
          .map((x) => (
            <ArticleCard key={x.slug} item={x} locale={locale} />
          ))}
      </div>
    </div>
  );
}
