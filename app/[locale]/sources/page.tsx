import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHead } from "@/components/news/shared";
import { sourceDirectory } from "@/lib/news/store";
import { database } from "@/lib/news/runtime";
export const dynamic = "force-dynamic";
export default async function Sources({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const zh = locale === "zh";
  let sources: {
    id: string;
    name: string;
    url: string;
    kind: string;
    checked_at?: string;
    successful_at?: string;
    error?: string;
  }[] = sourceDirectory;
  try {
    const rows = await database()
      .prepare("SELECT * FROM sources ORDER BY name")
      .all<(typeof sources)[number]>();
    if (rows.results.length) sources = rows.results;
  } catch {}
  return (
    <div className="newsroom">
      <PageHead
        locale={locale}
        eyebrow="SOURCE DIRECTORY"
        title={zh ? "从原始证据出发。" : "Start at the source."}
        description={
          zh
            ? "持续扩展的来源目录：官方博客、规范、版本发布、研究与实践。目录收录不代表每轮均能成功访问；每条新闻另有核验日期。"
            : "An expanding directory of official blogs, specifications, releases, research and practice. Inclusion does not imply every check succeeds; each story has its own verification date."
        }
      />
      <div className="n-source-directory">
        {sources.map((s) => (
          <article key={s.id}>
            <span className="n-kicker">{s.kind}</span>
            <h2>
              <a href={s.url} data-source target="_blank" rel="noreferrer">
                {s.name} ↗
              </a>
            </h2>
            <p>{new URL(s.url).hostname}</p>
            <small>
              {s.successful_at
                ? (zh ? "最近成功检查：" : "Last successful check: ") +
                  s.successful_at.slice(0, 16)
                : zh
                  ? "尚无自动检查记录"
                  : "No automated check recorded"}
              {s.error && " · " + (zh ? "最近检查失败" : "Latest check failed")}
            </small>
          </article>
        ))}
      </div>
    </div>
  );
}
