import contentJson from "@/generated/content.json";
import type { ContentBundle, LearningPath, Locale, Technology, UpdatePost } from "@/lib/types";

export const content = contentJson as ContentBundle;

export function getCollection(collection: "technologies", locale: Locale): Technology[];
export function getCollection(collection: "learn", locale: Locale): LearningPath[];
export function getCollection(collection: "updates", locale: Locale): UpdatePost[];
export function getCollection(collection: keyof ContentBundle, locale: Locale): Technology[] | LearningPath[] | UpdatePost[] {
  return content[collection][locale];
}

export function getTechnology(locale: Locale, slug: string): Technology | undefined {
  return content.technologies[locale].find((item) => item.slug === slug);
}

export function getTechnologyName(locale: Locale, slug: string): string {
  return getTechnology(locale, slug)?.title ?? slug.toUpperCase();
}
