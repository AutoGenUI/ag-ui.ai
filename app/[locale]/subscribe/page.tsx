import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHead } from "@/components/news/shared";
import { Subscription } from "@/components/news/subscription";
export const metadata = {
  robots: { index: false, follow: true },
  referrer: "no-referrer" as const,
};
export default async function Subscribe({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <div className="newsroom">
      <PageHead
        locale={locale}
        eyebrow="STAY IN THE LOOP"
        title={
          locale === "zh"
            ? "少一些噪声，多一些理解。"
            : "Less noise. More understanding."
        }
        description={
          locale === "zh"
            ? "为关注生成式 UI 的开发者、设计师、产品人员和研究者而写。"
            : "For developers, designers, product people and researchers interested in Generative UI."
        }
      />
      <Subscription locale={locale} />
    </div>
  );
}
