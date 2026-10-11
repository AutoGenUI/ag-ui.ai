"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { categories, categoryNames, type Locale } from "@/lib/news/types";
export function Subscription({ locale }: { locale: Locale }) {
  const zh = locale === "zh";
  const q = useSearchParams();
  const [enabled, setEnabled] = useState(false),
    [email, setEmail] = useState(""),
    [language, setLanguage] = useState<Locale>(locale),
    [topics, setTopics] = useState<string[]>([...categories]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [manage, setManage] = useState<{
      id: string;
      token: string;
      action: string;
    } | null>(() =>
      q.has("id") && q.has("token")
        ? {
            id: q.get("id")!,
            token: q.get("token")!,
            action: q.get("action") || "preferences",
          }
        : null,
    );
  useEffect(() => {
    void fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((s) => setEnabled(s.enabled === true))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!manage || manage.action === "confirm") return;
    void fetch("/api/subscription/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...manage, action: "read" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s) {
          setLanguage(s.locale);
          setTopics(JSON.parse(s.topics));
        }
      })
      .catch(() => {});
  }, [manage]);
  const submit = async (action?: string) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        manage ? "/api/subscription/manage" : "/api/subscription",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            manage
              ? {
                  ...manage,
                  action: action || manage.action,
                  locale: language,
                  topics,
                }
              : { email, locale: language, topics, consent: true, website: "" },
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.status);
      if (manage) {
        setMessage(zh ? "操作已完成。" : "Your request is complete.");
        if (data.token)
          setManage({ ...manage, token: data.token, action: "preferences" });
        history.replaceState(
          null,
          "",
          `${location.pathname}?id=${manage.id}&token=${data.token || manage.token}`,
        );
      } else
        setMessage(
          zh
            ? "请检查邮箱并点击确认链接，订阅才会生效。"
            : "Check your inbox and confirm your email to activate your subscription.",
        );
    } catch {
      setMessage(
        zh
          ? "操作未完成，请稍后重试或重新获取有效链接。"
          : "Unable to complete your request. Retry later or request a fresh link.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="n-subscription-layout">
      <div>
        <h2>{zh ? "每周精选" : "A weekly perspective"}</h2>
        <p>
          {zh
            ? "选择语言与主题，精选事件、研究与值得关注的方向。只发送有实质更新的周报。"
            : "Choose a language and topics for a considered selection of events, research and emerging directions. No empty editions."}
        </p>
        {!enabled && !manage ? (
          <div className="n-pending">
            <strong>
              {zh ? "邮件订阅待启用" : "Email subscriptions are not live yet"}
            </strong>
            <p>
              {zh
                ? "发信服务尚未配置，当前不收集邮箱。你可以先通过 RSS 订阅完整新闻。"
                : "The email service is awaiting configuration. We are not collecting email addresses yet. Follow the complete news feed via RSS today."}
            </p>
          </div>
        ) : (
          <form
            className="n-subscription-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {!manage && (
              <label>
                {zh ? "邮箱" : "Email"}
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            <label>
              {zh ? "语言" : "Language"}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Locale)}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <fieldset>
              <legend>{zh ? "关注主题" : "Topics"}</legend>
              {categories.map((c) => (
                <label key={c}>
                  <input
                    type="checkbox"
                    checked={topics.includes(c)}
                    onChange={(e) =>
                      setTopics(
                        e.target.checked
                          ? [...topics, c]
                          : topics.filter((x) => x !== c),
                      )
                    }
                  />
                  {categoryNames[c][locale]}
                </label>
              ))}
            </fieldset>
            {!manage && (
              <label>
                <input type="checkbox" required />
                {zh
                  ? "我同意接收所选主题的周报，可随时退订。"
                  : "I agree to receive the weekly digest for these topics and can unsubscribe anytime."}
              </label>
            )}
            <button className="n-button" disabled={busy || !topics.length}>
              {manage?.action === "confirm"
                ? zh
                  ? "确认订阅"
                  : "Confirm subscription"
                : manage
                  ? zh
                    ? "保存偏好"
                    : "Save preferences"
                  : zh
                    ? "发送确认邮件"
                    : "Send confirmation"}
            </button>
            {manage && manage.action !== "confirm" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit("unsubscribe")}
              >
                {zh ? "退订所有邮件" : "Unsubscribe from all email"}
              </button>
            )}
          </form>
        )}
        <p role="status">{message}</p>
        <p className="n-small">
          {zh
            ? "无需注册账号。邮件由 Brevo 投递，可能记录打开与点击；本站不依据这些记录决定发信或判断已读。"
            : "No account required. Brevo delivers email and may record opens and clicks. We do not use these records to decide whether to send email or as proof that an email was read."}
        </p>
      </div>
      <aside className="n-rss-box">
        <span className="n-kicker">OPEN FEEDS</span>
        <h2>{zh ? "用你喜欢的方式阅读。" : "Read on your terms."}</h2>
        <p>
          {zh
            ? "RSS 已开放，包含全部已发布新闻。"
            : "RSS is available now, with all published stories."}
        </p>
        <a href="/zh/feed.xml">
          中文 RSS <span>↗</span>
        </a>
        <a href="/en/feed.xml">
          English RSS <span>↗</span>
        </a>
        <small>
          {zh
            ? "兼容入口：/feed.xml（英文）"
            : "Compatibility feed: /feed.xml (English)"}
        </small>
      </aside>
    </div>
  );
}
