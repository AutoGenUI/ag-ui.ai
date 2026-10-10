import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { academyLessons, lessonHref, phaseCopy, type AcademyLesson } from "@/lib/academy/course";
import type { Locale } from "@/lib/types";

export function LessonArtifact({ lesson, locale, providerLabel }: { lesson: AcademyLesson; locale: Locale; providerLabel?: string }) {
  const progress = Math.round((lesson.order / academyLessons.length) * 100);
  const href = lessonHref(locale, lesson);
  return (
    <section className="lesson-artifact" aria-labelledby="active-lesson-title">
      <div className="lesson-artifact-head">
        <Badge variant="outline">{phaseCopy[lesson.phase][locale]}</Badge>
        <span>{String(lesson.order).padStart(2, "0")} / {academyLessons.length}</span>
      </div>
      <h2 id="active-lesson-title">{lesson.title[locale]}</h2>
      <p>{lesson.summary[locale]}</p>
      <Progress value={progress} aria-label={`${progress}%`} />
      <div className="lesson-outcomes">
        <strong>{locale === "zh" ? "本节产出" : "Outcomes"}</strong>
        {lesson.outcomes[locale].map((outcome) => <span key={outcome}><CheckCircle2 className="size-3.5" />{outcome}</span>)}
      </div>
      <div className="lesson-artifact-result"><small>{locale === "zh" ? "本应用实物" : "Artifact in this app"}</small><b>{lesson.artifact[locale]}</b></div>
      <div className="lesson-links">
        <a href={lesson.source.url} target="_blank" rel="noreferrer">{lesson.source.label}<ArrowUpRight className="size-3" /></a>
        {href && <a href={href}>{locale === "zh" ? "阅读知识条目" : "Read the knowledge page"}<ArrowUpRight className="size-3" /></a>}
      </div>
      {providerLabel && <p className="lesson-runtime"><span />{providerLabel}</p>}
    </section>
  );
}
