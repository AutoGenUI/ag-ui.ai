import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { content } from "@/lib/content";
import { newsroom } from "@/lib/news/data";
import { NewsExplorer } from "@/components/news/explorer";
import { PageHead } from "@/components/news/shared";
export const dynamic = "force-dynamic";
export default async function News({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { items } = await newsroom();
  const docs = (["technologies", "learn", "updates"] as const).flatMap(
    (collection) =>
      content[collection][locale].map((x) => ({
        title: x.title,
        summary: x.summary || "",
        url: `/${locale}/${collection}/${x.slug}`,
      })),
  );
  return (
    <div className="newsroom">
      <PageHead
        locale={locale}
        eyebrow="NEWS DESK"
        title={locale === "zh" ? "生成式 UI 新闻" : "The news desk"}
        description={
          locale === "zh"
            ? "从公告到研究：按事件日期排列，以原始来源为依据。历史补录与最新发布在详情中明确区分。"
            : "From announcements to research, ordered by event date and grounded in original sources. Discovery dates and publication dates stay distinct."
        }
      />
      <NewsExplorer locale={locale} items={items} docs={docs} />
    </div>
  );
}
