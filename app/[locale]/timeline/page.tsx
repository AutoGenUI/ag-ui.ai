import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { newsroom } from "@/lib/news/data";
import { NewsExplorer } from "@/components/news/explorer";
import { PageHead } from "@/components/news/shared";
export const dynamic = "force-dynamic";
export default async function Timeline({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { items } = await newsroom();
  return (
    <div className="newsroom">
      <PageHead
        locale={locale}
        eyebrow="TIMELINE"
        title={
          locale === "zh"
            ? "从单点突破，到领域演进。"
            : "A field, taking shape."
        }
        description={
          locale === "zh"
            ? "按模型、产品、协议、框架、研究与应用梳理发展脉络。每个节点都能回到证据。"
            : "Follow the models, products, protocols, frameworks and research shaping Generative UI. Every point leads back to evidence."
        }
      />
      <NewsExplorer locale={locale} items={items} timeline />
    </div>
  );
}
