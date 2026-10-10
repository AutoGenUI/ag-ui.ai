export type Locale = "en" | "zh";
export const categories = [
  "model",
  "product",
  "protocol",
  "framework",
  "research",
  "case-study",
] as const;
export type Category = (typeof categories)[number];
export type Evidence = "official" | "vendor-test" | "research" | "community";
export interface ArticleCopy {
  title: string;
  summary: string;
  why: string;
  details: string;
  caveat: string;
  audience: string;
}
export interface NewsItem {
  slug: string;
  eventDate: string;
  publishedAt: string;
  indexedAt: string;
  verifiedAt: string;
  canonicalUrl: string;
  sourceName: string;
  project: string;
  category: Category;
  evidence: Evidence;
  status: "published" | "review" | "withdrawn";
  zh: ArticleCopy;
  en: ArticleCopy;
  sources?: { url: string; label: string }[];
}
export interface Trend {
  slug: string;
  items: string[];
  zh: { title: string; summary: string; limitation: string };
  en: { title: string; summary: string; limitation: string };
  updatedAt: string;
}
export interface Statement {
  bind(...args: unknown[]): Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch<T = unknown>(statements: Statement[]): Promise<T[]>;
}
export const categoryNames: Record<Category, { zh: string; en: string }> = {
  model: { zh: "模型", en: "Models" },
  product: { zh: "产品", en: "Products" },
  protocol: { zh: "协议", en: "Protocols" },
  framework: { zh: "框架工具", en: "Frameworks" },
  research: { zh: "研究评测", en: "Research" },
  "case-study": { zh: "应用案例", en: "Practice" },
};
export const evidenceNames: Record<Evidence, { zh: string; en: string }> = {
  official: { zh: "官方公告", en: "Official" },
  "vendor-test": { zh: "厂商自测", en: "Vendor evaluation" },
  research: { zh: "研究论文", en: "Research paper" },
  community: { zh: "第三方观察", en: "Independent observation" },
};
