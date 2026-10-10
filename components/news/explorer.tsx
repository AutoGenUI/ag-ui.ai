"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArticleCard } from "./shared";
import {
  categories,
  categoryNames,
  type NewsItem,
  type Locale,
} from "@/lib/news/types";
type Doc = { title: string; summary: string; url: string };
export function NewsExplorer({
  items,
  locale,
  docs = [],
  timeline = false,
}: {
  items: NewsItem[];
  locale: Locale;
  docs?: Doc[];
  timeline?: boolean;
}) {
  const zh = locale === "zh";
  const [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [project, setProject] = useState(""),
    [source, setSource] = useState(""),
    [after, setAfter] = useState("");
  const results = useMemo(
    () =>
      items.filter(
        (x) =>
          (!category || x.category === category) &&
          (!project || x.project === project) &&
          (!source || x.sourceName === source) &&
          (!after || x.eventDate >= after) &&
          (!q ||
            JSON.stringify([x[locale], x.project, x.sourceName])
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [items, locale, q, category, project, source, after],
  );
  const matches =
    q && !category && !project && !source && !after
      ? docs.filter((x) =>
          `${x.title} ${x.summary}`.toLowerCase().includes(q.toLowerCase()),
        )
      : [];
  return (
    <>
      <div className="n-filter">
        <label className="n-search">
          <span>{zh ? "搜索新闻与知识库" : "Search news & knowledge"}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              zh ? "例如：A2UI、评测、OpenUI" : "Try A2UI, evaluation, OpenUI"
            }
          />
        </label>
        <label>
          <span>{zh ? "主题" : "Topic"}</span>
          <select
            aria-label={zh ? "主题" : "Topic"}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{zh ? "全部主题" : "All topics"}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryNames[c][locale]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{zh ? "项目" : "Project"}</span>
          <select aria-label={zh ? "项目" : "Project"} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">{zh ? "全部项目" : "All projects"}</option>
            {[...new Set(items.map((x) => x.project))].sort().map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{zh ? "来源" : "Source"}</span>
          <select aria-label={zh ? "来源" : "Source"} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{zh ? "全部来源" : "All sources"}</option>
            {[...new Set(items.map((x) => x.sourceName))].sort().map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{zh ? "起始日期" : "Since"}</span>
          <input
            type="date"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
          />
        </label>
      </div>
      <div className="n-results-meta" aria-live="polite">
        {results.length} {zh ? "条事件" : "events"}
        {matches.length > 0 &&
          ` · ${matches.length} ${zh ? "篇知识库资料" : "knowledge articles"}`}{" "}
        <button
          onClick={() => {
            setQ("");
            setCategory("");
            setProject("");
            setSource("");
            setAfter("");
          }}
        >
          {zh ? "重置筛选" : "Reset filters"}
        </button>
      </div>
      <div className={timeline ? "n-timeline" : "n-news-grid"}>
        {results.map((x) =>
          timeline ? (
            <div className="n-timeline-row" key={x.slug}>
              <time>{x.eventDate}</time>
              <ArticleCard item={x} locale={locale} />
            </div>
          ) : (
            <ArticleCard key={x.slug} item={x} locale={locale} />
          ),
        )}
      </div>
      {!results.length && (
        <p className="n-empty">
          {zh
            ? "暂无匹配事件，请调整筛选条件。"
            : "No matching events. Try a broader search."}
        </p>
      )}
      {matches.length > 0 && (
        <section className="n-doc-results">
          <h2>{zh ? "知识库搜索结果" : "From the knowledge base"}</h2>
          {matches.map((x) => (
            <article key={x.url}>
              <h3>
                <Link href={x.url}>{x.title}</Link>
              </h3>
              <p>{x.summary}</p>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
