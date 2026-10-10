import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHead } from "@/components/news/shared";
export default async function Knowledge({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const zh = locale === "zh";
  const links = [
    [
      "map",
      zh ? "技术图谱" : "Technology map",
      zh
        ? "理解事件协议、声明式界面、嵌入式应用与实现工具的分工。"
        : "Understand events, declarative interfaces, embedded apps and implementation tools.",
    ],
    [
      "compare",
      zh ? "技术比较" : "Compare approaches",
      zh
        ? "在架构与约束之间选择适合的组合。"
        : "Choose an approach through its architecture and constraints.",
    ],
    [
      "learn",
      zh ? "学习路径" : "Learning paths",
      zh
        ? "从概念到实践，沿着可复用的路线学习。"
        : "Practical routes from first principles to working implementations.",
    ],
    [
      "learn/academy",
      zh ? "AI 课堂" : "The interactive academy",
      zh
        ? "用规则驱动的课堂复刻应用；默认不调用付费模型。"
        : "Learn by rebuilding an app. Rules-based by default, with no paid model calls.",
    ],
    [
      "lab/ag-ui-events",
      zh ? "交互实验室" : "Interactive lab",
      zh
        ? "动手观察 Agent 事件与界面状态的关系。"
        : "Explore how agent events become interface state.",
    ],
    [
      "updates",
      zh ? "资料更新档案" : "Atlas changelog",
      zh
        ? "保留旧版技术资料的更新记录与永久链接。"
        : "The retained update archive and permanent links from the atlas.",
    ],
  ];
  return (
    <div className="newsroom">
      <PageHead
        locale={locale}
        eyebrow="KNOWLEDGE BASE"
        title={zh ? "读懂新闻背后的技术。" : "The ideas behind the news."}
        description={
          zh
            ? "知识库保留完整的技术图谱、比较、学习资料与实验室。与新闻一起搜索，也可以从这里开始。"
            : "Explore the retained technology map, comparisons, learning paths and experiments. Search these resources alongside the news."
        }
      />
      <div className="n-knowledge-grid">
        {links.map(([path, title, desc], i) => (
          <Link key={path} href={`/${locale}/${path}`}>
            <span className="n-kicker">0{i + 1} ↗</span>
            <h2>{title}</h2>
            <p>{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
