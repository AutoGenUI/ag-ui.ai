export type Locale = "en" | "zh";
export type CollectionName = "technologies" | "learn" | "updates";
export type TechnologyLayer = "interaction" | "declarative" | "embedded" | "implementation";

export interface BaseContent {
  slug: string;
  title: string;
  summary: string;
  lastVerified: string;
  order: number;
  body: string;
}

export interface Technology extends BaseContent {
  layer: TechnologyLayer;
  kind: "protocol" | "specification" | "framework" | "extension" | "platform";
  maturity: "stable" | "active" | "public-preview" | "emerging";
  sourceAuthority: "primary" | "ecosystem";
  chooseWhen: string[];
  avoidWhen: string[];
  composesWith: string[];
  license: string;
  primarySource: string;
  officialSources: string[];
}

export interface LearningPath extends BaseContent {
  duration: string;
  level: "foundation" | "intermediate" | "advanced";
}

export interface UpdatePost extends BaseContent {
  publishedAt: string;
}

export interface ContentBundle {
  technologies: Record<Locale, Technology[]>;
  learn: Record<Locale, LearningPath[]>;
  updates: Record<Locale, UpdatePost[]>;
}
