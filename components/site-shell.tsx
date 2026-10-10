import Link from "next/link";
import { dictionary, otherLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { LocaleSwitch } from "@/components/locale-switch";
import { Metrics } from "@/components/news/metrics";
export function SiteShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const zh = locale === "zh";
  return (
    <div className="site-shell" lang={zh ? "zh-Hans" : "en"}>
      <a className="skip-link" href="#main">
        {zh ? "跳到正文" : "Skip to content"}
      </a>
      <header className="site-header n-header">
        <div className="header-inner">
          <Link
            className="brand"
            href={`/${locale}`}
            aria-label="AG-UI.AI home"
          >
            <span className="brand-mark" aria-hidden="true">
              A/
            </span>
            <span>
              <strong>AG-UI.AI</strong>
              <small>GENERATIVE UI INTELLIGENCE</small>
            </span>
          </Link>
          <nav
            className="main-nav"
            aria-label={zh ? "主导航" : "Main navigation"}
          >
            {[
              ["news", zh ? "新闻" : "News"],
              ["timeline", zh ? "发展脉络" : "Timeline"],
              ["trends", zh ? "趋势专题" : "Perspectives"],
              ["knowledge", zh ? "知识库" : "Knowledge"],
            ].map(([path, label]) => (
              <Link key={path} href={`/${locale}/${path}`}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <LocaleSwitch locale={locale} alternate={otherLocale(locale)} />
            <Link className="n-nav-subscribe" href={`/${locale}/subscribe`}>
              {zh ? "订阅" : "Subscribe"} ↗
            </Link>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer n-footer">
        <div>
          <p className="footer-brand">
            AG-UI.AI <span>— Generative UI intelligence</span>
          </p>
          <p>{dictionary[locale].independent}</p>
          <Metrics locale={locale} />
        </div>
        <div className="footer-links">
          <Link href={`/${locale}/sources`}>{zh ? "来源目录" : "Sources"}</Link>
          <Link href={`/${locale}/methodology`}>
            {zh ? "编辑方法" : "Methodology"}
          </Link>
          <Link href={`/${locale}/privacy`}>{zh ? "隐私" : "Privacy"}</Link>
          <Link href={`/${locale}/community`}>{zh ? "社区" : "Community"}</Link>
          <a href={`/${locale}/feed.xml`}>RSS</a>
          <Link href="/admin" prefetch={false}>
            {zh ? "管理" : "Owner"}
          </Link>
        </div>
        <p className="license-note">Code MIT · Original content CC BY 4.0</p>
      </footer>
    </div>
  );
}
