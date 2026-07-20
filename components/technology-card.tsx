import Link from "next/link";
import type { Locale, Technology } from "@/lib/types";

export function TechnologyCard({ locale, technology }: { locale: Locale; technology: Technology }) {
  return (
    <article className={`technology-card layer-border-${technology.layer}`}>
      <div className="card-kicker"><span>{technology.layer}</span><span>{technology.maturity.replace("-", " ")}</span></div>
      <h3><Link href={`/${locale}/technologies/${technology.slug}`}>{technology.title}</Link></h3>
      <p>{technology.summary}</p>
      <div className="card-footer">
        <span>{technology.kind}</span>
        <Link href={`/${locale}/technologies/${technology.slug}`}>{locale === "zh" ? "阅读档案 →" : "Read profile →"}</Link>
      </div>
    </article>
  );
}
