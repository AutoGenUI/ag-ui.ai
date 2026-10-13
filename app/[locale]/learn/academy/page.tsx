import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademyChat } from "@/components/academy/academy-chat";
import { localizeAcademyCourse } from "@/lib/academy/course";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

const metadataCopy = {
  en: {
    title: "Build Generative UI with an AI tutor",
    description: "Learn AG-UI, AI SDK, shadcn/ui, json-render, OpenUI, A2UI, MCP, Skills, RAG, agents, and model integration by rebuilding this application.",
  },
  zh: {
    title: "通过 AI 导师学习构建生成式 UI",
    description: "在复刻本应用的过程中，学习 AG-UI、AI SDK、shadcn/ui、json-render、OpenUI、A2UI、MCP、Skills、RAG、Agent 与模型接入。",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata(locale, "learn/academy", metadataCopy[locale].title, metadataCopy[locale].description);
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AcademyChat locale={locale} {...localizeAcademyCourse(locale)} />;
}
