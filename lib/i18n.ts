import type { Locale } from "@/lib/types";

export const locales: Locale[] = ["en", "zh"];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "zh" : "en";
}

export const dictionary = {
  en: {
    nav: { map: "Ecosystem map", compare: "Compare", learn: "Learn", lab: "Event lab", updates: "Updates", community: "Community" },
    source: "Primary source",
    verified: "Last verified",
    edit: "Edit this page",
    independent: "Independent community resource. Not affiliated with the maintainers of the technologies covered.",
  },
  zh: {
    nav: { map: "生态图谱", compare: "技术比较", learn: "学习路径", lab: "事件实验室", updates: "生态更新", community: "社区" },
    source: "主要来源",
    verified: "最后核验",
    edit: "编辑此页",
    independent: "独立社区资料，与所涵盖技术的维护方无官方隶属关系。",
  },
} as const;
