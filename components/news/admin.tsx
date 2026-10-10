"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Sites sign-in must use top-level navigation. */
import { useEffect, useState } from "react";
type Dashboard = {
  stats: {
    views: number;
    todayVisitors: number;
    daily: Record<string, unknown>[];
    popular: Record<string, unknown>[];
    sourceClicks: Record<string, unknown>[];
    confirmed: Record<string, unknown>[];
  };
  email: {
    enabled: boolean;
    used: number;
    deliveryStates: Record<string, unknown>[];
    subscribers: Record<string, unknown>[];
  };
  freshness: { stale: boolean; lastSuccess: string | null };
  runs: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  reviewQueue: Record<string, unknown>[];
  revisions: Record<string, unknown>[];
};
function Table({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p>暂无记录 / No records</p>;
  const keys = Object.keys(rows[0]).filter(
    (k) => !["payload", "zh", "en", "sources"].includes(k),
  );
  return (
    <div className="n-table-scroll">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>
                  {typeof r[k] === "object"
                    ? JSON.stringify(r[k])
                    : String(r[k] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Admin() {
  const [asOf] = useState(() => Date.now());
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(""),
    [period, setPeriod] = useState(30),
    [input, setInput] = useState('{"operation":"context","arguments":{}}'),
    [result, setResult] = useState("");
  const refresh = () =>
    fetch("/api/admin")
      .then(async (r) => {
        if (!r.ok)
          throw new Error("仅站点所有者可访问 / Site owner access required");
        setData(await r.json());
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <div className="newsroom n-admin">
      <div className="n-kicker">AG-UI.AI / OWNER WORKSPACE</div>
      <h1>编辑与运营 / Editorial & operations</h1>
      {error ? (
        <p role="alert">
          {error} ·{" "}
          <a href="/signin-with-chatgpt?returnTo=%2Fadmin" target="_top">
            使用 ChatGPT 登录 / Sign in
          </a>
        </p>
      ) : !data ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="n-admin-metrics">
            <div>
              <small>累计浏览 / Total views</small>
              <strong>{data.stats.views}</strong>
            </div>
            <div>
              <small>今日访客估算 / Estimated visitors</small>
              <strong>{data.stats.todayVisitors}</strong>
            </div>
            <div>
              <small>今日邮件额度 / Daily mail quota</small>
              <strong>{data.email.used} / 300</strong>
            </div>
          </div>
          <p>
            {data.email.enabled
              ? "邮件已启用 / Email enabled"
              : "邮件待启用 / Email pending activation"}{" "}
            ·{" "}
            {data.freshness.stale
              ? "采集无近期成功记录 / Collection stale"
              : "采集正常 / Collection current"}{" "}
            · {data.freshness.lastSuccess || "—"}
          </p>
          <button onClick={() => void refresh()}>刷新 / Refresh</button>
          <h2>访问与确认转化 / Traffic & confirmation</h2>
          <label>
            期间 / Period{" "}
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>
          <Table
            rows={data.stats.daily.filter(
              (r) =>
                String(r.day) >=
                new Date(asOf - period * 86400000).toISOString().slice(0, 10),
            )}
          />
          <h3>确认订阅 / Confirmed subscriptions</h3>
          <Table rows={data.stats.confirmed} />
          <h3>热门页面 / Popular pages · 30 days</h3>
          <Table rows={data.stats.popular} />
          <h3>来源点击 / Source clicks · 30 days</h3>
          <Table rows={data.stats.sourceClicks} />
          {[
            ["投递状态 / Delivery states", data.email.deliveryStates],
            ["订阅状态 / Subscription states", data.email.subscribers],
            ["待核验 / Review queue", data.reviewQueue],
            ["运行记录 / Runs", data.runs],
            ["来源检查 / Sources", data.sources],
            ["修订 / Revisions", data.revisions],
          ].map(([title, rows]) => (
            <section key={title as string}>
              <h2>{title as string}</h2>
              <Table rows={rows as Record<string, unknown>[]} />
            </section>
          ))}
          <details>
            <summary>编辑操作 / Editorial operations</summary>
            <p>
              Owner-only structured operations.{" "}
              <a href="/automation.md">Operation reference</a>
            </p>
            <textarea
              rows={12}
              aria-label="Operation JSON"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              onClick={async () => {
                try {
                  const body = JSON.stringify(JSON.parse(input));
                  const r = await fetch("/api/admin", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body,
                  });
                  setResult(JSON.stringify(await r.json(), null, 2));
                  void refresh();
                } catch {
                  setResult("Invalid request");
                }
              }}
            >
              执行 / Run
            </button>
            <pre>{result}</pre>
          </details>
        </>
      )}
    </div>
  );
}
