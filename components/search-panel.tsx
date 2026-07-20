"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/types";

interface SearchEntry { id: string; locale: Locale; type: string; title: string; summary: string; text: string; href: string }

export function SearchPanel({ locale }: { locale: Locale }) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  useEffect(() => {
    fetch("/search-index.json").then((response) => response.json()).then(setEntries).catch(() => setEntries([]));
  }, []);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return entries.filter((item) => item.locale === locale && `${item.title} ${item.summary} ${item.text}`.toLocaleLowerCase().includes(normalized)).slice(0, 6);
  }, [entries, locale, query]);
  return (
    <div className="search-panel" data-testid="search-panel">
      <label htmlFor="atlas-search">{locale === "zh" ? "搜索技术、问题或概念" : "Search technologies, questions or concepts"}</label>
      <div className="search-input-wrap"><span aria-hidden="true">⌕</span><input id="atlas-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "zh" ? "例如：跨端、组件目录、事件流" : "Try: cross-platform, catalog, event stream"} /></div>
      {query && <div className="search-results" aria-live="polite">
        {matches.length ? matches.map((item) => <a href={item.href} key={item.id}><small>{item.type}</small><strong>{item.title}</strong><span>{item.summary}</span></a>) : <p>{locale === "zh" ? "没有匹配结果。" : "No matching results."}</p>}
      </div>}
    </div>
  );
}
