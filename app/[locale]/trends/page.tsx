import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { newsroom } from "@/lib/news/data";
import { PageHead } from "@/components/news/shared";
export const dynamic = "force-dynamic";
export default async function Trends({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { trends } = await newsroom();
  return (
    <div className="newsroom">
      <PageHead
        locale={locale}
        eyebrow="PERSPECTIVES"
        title={locale === "zh" ? "把新闻串成方向。" : "Connect the dots."}
        description={
          locale === "zh"
            ? "趋势是可以被检验的判断。每个专题列出支持事件、限制和相反证据；报道数量不代表采用率。"
            : "Trends are claims to examine. Each perspective links to supporting events and acknowledges limits and counterevidence. Coverage is not adoption."
        }
      />
      <div className="n-trends n-trends-index">
        {trends.map((t, i) => (
          <Link
            className="n-trend"
            href={`/${locale}/trends/${t.slug}`}
            key={t.slug}
          >
            <span>
              0{i + 1} <b>↗</b>
            </span>
            <h2>{t[locale].title}</h2>
            <p>{t[locale].summary}</p>
            <small>
              {t.items.length}{" "}
              {locale === "zh"
                ? "条支持事件 · 本站分析"
                : "supporting events · Our analysis"}
            </small>
          </Link>
        ))}
      </div>
    </div>
  );
}
