"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/types";

export function LocaleSwitch({ locale, alternate }: { locale: Locale; alternate: Locale }) {
  const pathname = usePathname();
  const href = pathname?.startsWith(`/${locale}`) ? pathname.replace(`/${locale}`, `/${alternate}`) : `/${alternate}`;
  return <Link className="locale-switch" data-testid="locale-switch" href={href} hrefLang={alternate}>{alternate === "zh" ? "中文" : "EN"}</Link>;
}
