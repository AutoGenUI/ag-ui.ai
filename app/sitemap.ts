import type { MetadataRoute } from "next";
import { content } from "@/lib/content";
import { locales } from "@/lib/i18n";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://ag-ui.ai";
  const routes = ["", "/map", "/compare", "/learn", "/lab/ag-ui-events", "/updates", "/community"];
  const staticEntries = locales.flatMap((locale) => routes.map((route) => ({ url: `${base}/${locale}${route}`, lastModified: new Date("2026-07-20"), changeFrequency: route === "/updates" ? "weekly" as const : "monthly" as const, priority: route === "" ? 1 : 0.7, alternates: { languages: { en: `${base}/en${route}`, zh: `${base}/zh${route}` } } })));
  const technologyEntries = locales.flatMap((locale) => content.technologies[locale].map((item) => ({ url: `${base}/${locale}/technologies/${item.slug}`, lastModified: new Date(item.lastVerified), changeFrequency: "monthly" as const, priority: 0.8 })));
  const learningEntries = locales.flatMap((locale) => content.learn[locale].map((item) => ({ url: `${base}/${locale}/learn/${item.slug}`, lastModified: new Date(item.lastVerified), changeFrequency: "monthly" as const, priority: 0.6 })));
  return [...staticEntries, ...technologyEntries, ...learningEntries];
}
