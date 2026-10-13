"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/types";
import { subscriptionLocaleHref } from "@/lib/news/subscription-ui";

export function LocaleSwitch({ locale, alternate }: { locale: Locale; alternate: Locale }) {
  const pathname = usePathname();
  const query = useSearchParams();
  const href = subscriptionLocaleHref(pathname, locale, alternate, query.toString());
  return <Link className="locale-switch" data-testid="locale-switch" href={href} hrefLang={alternate} prefetch={pathname === `/${locale}/subscribe` ? false : undefined}>{alternate === "zh" ? "中文" : "EN"}</Link>;
}
