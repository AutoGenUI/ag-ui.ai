import content from "@/generated/content.json";
import { academyLessons, type AcademyLesson } from "@/lib/academy/course";
import type { Locale } from "@/lib/types";

export interface KnowledgeHit {
  id: string;
  title: string;
  summary: string;
  excerpt: string;
  href: string;
  score: number;
}

export interface AcademyRetrieval {
  lesson: AcademyLesson;
  hits: KnowledgeHit[];
}

const latinOrNumber = /[a-z0-9][a-z0-9+./-]*/g;
const hanRun = /[\p{Script=Han}]+/gu;

function tokens(value: string): Set<string> {
  const normalized = value.toLowerCase();
  const result = new Set(normalized.match(latinOrNumber) ?? []);
  for (const run of normalized.match(hanRun) ?? []) {
    for (let index = 0; index < run.length; index += 1) {
      result.add(run[index]);
      if (index < run.length - 1) result.add(run.slice(index, index + 2));
    }
  }
  return result;
}

function overlapScore(query: Set<string>, value: string): number {
  if (query.size === 0) return 0;
  const haystack = tokens(value);
  let matches = 0;
  for (const token of query) if (haystack.has(token)) matches += token.length > 2 ? 2 : 1;
  return matches / Math.sqrt(Math.max(haystack.size, 1));
}

function selectLesson(query: string, locale: Locale, requestedLessonId?: string): AcademyLesson {
  const requested = academyLessons.find((lesson) => lesson.id === requestedLessonId);
  if (requested) return requested;
  const queryTokens = tokens(query);
  const ranked = academyLessons
    .map((lesson) => ({
      lesson,
      score: overlapScore(
        queryTokens,
        `${lesson.title[locale]} ${lesson.summary[locale]} ${lesson.concepts.join(" ")} ${lesson.outcomes[locale].join(" ")}`,
      ),
    }))
    .sort((left, right) => right.score - left.score || left.lesson.order - right.lesson.order);
  return ranked[0]?.score > 0 ? ranked[0].lesson : academyLessons[0];
}

export function retrieveAcademyKnowledge(
  query: string,
  locale: Locale,
  requestedLessonId?: string,
): AcademyRetrieval {
  const lesson = selectLesson(query, locale, requestedLessonId);
  const queryTokens = tokens(`${query} ${lesson.title[locale]} ${lesson.concepts.join(" ")}`);
  const collections = content as {
    technologies: Record<Locale, Array<{ slug: string; title: string; summary: string; body: string }>>;
    learn: Record<Locale, Array<{ slug: string; title: string; summary: string; body: string }>>;
  };
  const documents = [
    ...collections.technologies[locale].map((item) => ({ ...item, collection: "technologies" })),
    ...collections.learn[locale].map((item) => ({ ...item, collection: "learn" })),
  ];
  const hits = documents
    .map((document) => {
      const score = overlapScore(queryTokens, `${document.title} ${document.summary} ${document.body}`);
      return {
        id: `${document.collection}:${document.slug}`,
        title: document.title,
        summary: document.summary,
        excerpt: document.body.replace(/```[\s\S]*?```/g, " ").replace(/[#*_>`~-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 900),
        href: `/${locale}/${document.collection}/${document.slug}`,
        score,
      } satisfies KnowledgeHit;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  return { lesson, hits };
}

export function formatKnowledgeContext(retrieval: AcademyRetrieval, locale: Locale): string {
  const lesson = retrieval.lesson;
  const sources = retrieval.hits
    .map((hit, index) => `[${index + 1}] ${hit.title}\n${hit.summary}\n${hit.excerpt}\nPath: ${hit.href}`)
    .join("\n\n");
  return [
    `Active lesson: ${lesson.title[locale]}`,
    `Lesson goal: ${lesson.summary[locale]}`,
    `Expected outcomes:\n- ${lesson.outcomes[locale].join("\n- ")}`,
    `Primary source: ${lesson.source.label} — ${lesson.source.url}`,
    sources ? `Repository knowledge:\n${sources}` : "",
  ].filter(Boolean).join("\n\n");
}
