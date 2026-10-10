"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function Metrics({ locale }: { locale: "en" | "zh" }) {
  const pathname = usePathname();
  const [stats, setStats] = useState<{
    views: number;
    todayVisitors: number;
    startedAt: string | null;
  } | null>(null);
  useEffect(() => {
    let disposed = false,
      id = crypto.randomUUID(),
      sent = false,
      engaged = false,
      visibleMs = 0,
      last = Date.now();
    const send = (kind: string, source?: string) => {
      if (navigator.webdriver || new URLSearchParams(location.search).has("token")) return;
      void fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, path: pathname, kind, source }),
        keepalive: true,
      }).catch(() => {});
    };
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        visibleMs += Math.min(now - last, 1000);
        if (!sent) {
          sent = true;
          send("view");
        }
        if (visibleMs >= 30000 && !engaged) {
          engaged = true;
          send("engaged");
        }
      }
      last = now;
    };
    tick();
    const timer = setInterval(tick, 1000);
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.(
        "a[data-source]",
      ) as HTMLAnchorElement | null;
      if (anchor) send("source", anchor.href);
    };
    document.addEventListener("click", click);
    const update = () =>
      fetch("/api/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          if (!disposed) setStats(s);
        })
        .catch(() => {});
    void update();
    const refresh = setTimeout(update, 1800);
    return () => {
      disposed = true;
      clearInterval(timer);
      clearTimeout(refresh);
      document.removeEventListener("click", click);
      id = "";
    };
  }, [pathname]);
  return (
    <p className="n-footer-stats">
      {stats
        ? locale === "zh"
          ? `累计浏览 ${stats.views.toLocaleString()} · 今日访客约 ${stats.todayVisitors.toLocaleString()} · ${stats.startedAt ? stats.startedAt.slice(0, 10) + " 起统计" : "从首个真实访问开始统计"}`
          : `${stats.views.toLocaleString()} page views · ~${stats.todayVisitors.toLocaleString()} visitors today · ${stats.startedAt ? "Since " + stats.startedAt.slice(0, 10) : "Counting from the first real visit"}`
        : locale === "zh"
          ? "访问统计暂不可用"
          : "Visitor statistics temporarily unavailable"}
    </p>
  );
}
