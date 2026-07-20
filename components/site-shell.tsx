import Link from "next/link";
import { dictionary, otherLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { LocaleSwitch } from "@/components/locale-switch";

export function SiteShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = dictionary[locale];
  const alternate = otherLocale(locale);
  return (
    <div className="site-shell" lang={locale === "zh" ? "zh-Hans" : "en"}>
      <a className="skip-link" href="#main">{locale === "zh" ? "跳到正文" : "Skip to content"}</a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href={`/${locale}`} aria-label="AG-UI.AI home">
            <span className="brand-mark" aria-hidden="true">A/</span>
            <span><strong>AG-UI.AI</strong><small>Generative UI Atlas</small></span>
          </Link>
          <nav className="main-nav" aria-label={locale === "zh" ? "主导航" : "Main navigation"}>
            <Link href={`/${locale}/map`}>{t.nav.map}</Link>
            <Link href={`/${locale}/compare`}>{t.nav.compare}</Link>
            <Link href={`/${locale}/learn`}>{t.nav.learn}</Link>
            <Link href={`/${locale}/lab/ag-ui-events`}>{t.nav.lab}</Link>
            <Link href={`/${locale}/updates`}>{t.nav.updates}</Link>
          </nav>
          <div className="header-actions">
            <Link className="community-link" href={`/${locale}/community`}>{t.nav.community}</Link>
            <LocaleSwitch locale={locale} alternate={alternate} />
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div>
          <p className="footer-brand">AG-UI.AI <span>— Generative UI Atlas</span></p>
          <p>{t.independent}</p>
        </div>
        <div className="footer-links">
          <Link href={`/${locale}/community`}>{t.nav.community}</Link>
          <a href="https://github.com/AutoGenUI/ag-ui.ai">GitHub</a>
          <a href="https://github.com/AutoGenUI/ag-ui.ai/discussions">Discussions</a>
          <a href="/feed.xml">RSS</a>
        </div>
        <p className="license-note">Code MIT · Original content CC BY 4.0</p>
      </footer>
    </div>
  );
}
