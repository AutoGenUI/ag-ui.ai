import type { Metadata } from "next";
import type { Locale } from "@/lib/types";

const siteName = "AG-UI.AI — Generative UI intelligence";

export function pageMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  path = path && !path.startsWith("/") ? `/${path}` : path;
  const localizedPath = `/${locale}${path}`.replace(/\/$/, "") || `/${locale}`;
  const enPath = `/en${path}`.replace(/\/$/, "") || "/en";
  const zhPath = `/zh${path}`.replace(/\/$/, "") || "/zh";
  return {
    title,
    description,
    alternates: {
      canonical: localizedPath,
      languages: { en: enPath, "zh-Hans": zhPath, "x-default": enPath },
    },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: localizedPath,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      images: [{ url: "/og.png", width: 1536, height: 1024, alt: siteName }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}
