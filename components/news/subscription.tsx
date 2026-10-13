"use client";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { categories, categoryNames, type Category, type Locale } from "@/lib/news/types";
import {
  parseSubscriberView, parseSubscriptionCapacity, subscriptionOutcome, visibleConfirmation,
  type SubscriberView, type SubscriptionAction, type SubscriptionCapacity,
} from "@/lib/news/subscription-ui";

type ManageLink = { id: string; token: string; action: "confirm" | "preferences" };
type NoticeKind = "loading" | "confirm-ready" | "active" | "check-inbox" | "confirmed" | "preferences-saved" | "unsubscribed" | "suppressed" | "unconfirmed" | "capacity-full" | "unavailable" | "error" | "read-error" | "capacity-error";
type Notice = { kind: NoticeKind; action?: SubscriptionAction };

export function Subscription({ locale }: { locale: Locale }) {
  const q = useSearchParams();
  const queryId = q.get("id"), queryToken = q.get("token"), queryAction = q.get("action");
  const queryKey = JSON.stringify([queryId, queryToken, queryAction]);
  const [seenQuery, setSeenQuery] = useState(queryKey),
    [replacementQuery, setReplacementQuery] = useState<string | null>(null),
    [viewVersion, setViewVersion] = useState(0);
  // External links get a fresh view; replacing a successfully confirmed link
  // with its management URL preserves the visible confirmation result.
  if (seenQuery !== queryKey) {
    setSeenQuery(queryKey); setReplacementQuery(null);
    if (queryKey !== replacementQuery) setViewVersion(value => value + 1);
  }
  const initialLink: ManageLink | null = queryId && queryToken
    ? { id: queryId, token: queryToken, action: queryAction === "confirm" ? "confirm" : "preferences" } : null;
  return <SubscriptionView key={`${locale}:${viewVersion}`} locale={locale} initialLink={initialLink}
    onManagementUrl={(id, token) => setReplacementQuery(JSON.stringify([id, token, null]))} />;
}

function SubscriptionView({ locale, initialLink, onManagementUrl }: {
  locale: Locale; initialLink: ManageLink | null;
  onManagementUrl: (id: string, token: string) => void;
}) {
  const zh = locale === "zh";
  const [confirmationLanding] = useState(initialLink?.action === "confirm");
  const [autoAttempted, setAutoAttempted] = useState(false);
  const [manage, setManage] = useState<ManageLink | null>(initialLink),
    [subscriber, setSubscriber] = useState<SubscriberView | null>(null),
    [capacity, setCapacity] = useState<SubscriptionCapacity | null>(null),
    [capacityState, setCapacityState] = useState<"loading" | "ready" | "error">("loading"),
    [readState, setReadState] = useState<"loading" | "ready" | "error">(initialLink?.action === "preferences" ? "loading" : "ready"),
    [readRetry, setReadRetry] = useState(0),
    [email, setEmail] = useState(""),
    [language, setLanguage] = useState<Locale>(locale),
    [topics, setTopics] = useState<Category[]>([...categories]),
    [consent, setConsent] = useState(false),
    [notice, setNotice] = useState<Notice | null>(null),
    [busy, setBusy] = useState<SubscriptionAction | null>(null),
    [attention, setAttention] = useState(0),
    [copyingFeed, setCopyingFeed] = useState<Locale | null>(null),
    [feedNotice, setFeedNotice] = useState<{ language: Locale; copied: boolean } | null>(null);
  const generation = useRef(0), readLink = useRef(initialLink),
    capacityGeneration = useRef(0), capacityAbort = useRef<AbortController | null>(null),
    submitting = useRef(false), submissionAbort = useRef<AbortController | null>(null),
    noticeRef = useRef<HTMLElement | null>(null), formRef = useRef<HTMLFormElement | null>(null);

  const refreshCapacity = useCallback(() => {
    const requestGeneration = ++capacityGeneration.current;
    capacityAbort.current?.abort();
    const controller = new AbortController();
    capacityAbort.current = controller;
    void fetch("/api/subscription/status", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = parseSubscriptionCapacity(await response.json());
        if (!response.ok || !data) throw new Error("Unavailable");
        if (controller.signal.aborted || requestGeneration !== capacityGeneration.current) return;
        setCapacity(data); setCapacityState("ready");
        setNotice(current => current?.kind === "capacity-full" && !data.full ? null : current);
      })
      .catch(() => { if (!controller.signal.aborted && requestGeneration === capacityGeneration.current) setCapacityState("error"); });
  }, []);
  useEffect(() => {
    refreshCapacity();
    // Returning from confirmation on another device refreshes the public count.
    const resume = () => { if (document.visibilityState === "visible") { setCapacityState("loading"); refreshCapacity(); } };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      capacityGeneration.current += 1; capacityAbort.current?.abort();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refreshCapacity]);

  useEffect(() => {
    const next = readLink.current;
    if (!next || next.action === "confirm") return;
    const controller = new AbortController();
    void fetch("/api/subscription/manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...next, action: "read" }), signal: controller.signal,
    }).then(async response => {
      const current = parseSubscriberView(await response.json());
      if (!response.ok || !current) throw new Error("Unavailable");
      if (controller.signal.aborted) return;
      setSubscriber(current); setLanguage(current.locale); setTopics(current.topics);
      setReadState("ready");
    }).catch(() => {
      if (!controller.signal.aborted) { setReadState("error"); setNotice({ kind: "read-error" }); }
    });
    return () => controller.abort();
  }, [readRetry]);

  useEffect(() => {
    if (!attention || !noticeRef.current) return;
    noticeRef.current.focus({ preventScroll: true });
    noticeRef.current.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [attention]);
  useEffect(() => {
    if (readState === "ready" && location.hash === "#unsubscribe") document.getElementById("unsubscribe")?.scrollIntoView({ block: "start" });
  }, [readState, subscriber?.status]);
  useEffect(() => () => { generation.current += 1; submissionAbort.current?.abort(); }, []);

  const retryRead = () => { setReadState("loading"); setNotice(null); setReadRetry(value => value + 1); };
  const copyFeed = async (feedLanguage: Locale) => {
    const requestGeneration = generation.current;
    setCopyingFeed(feedLanguage); setFeedNotice(null);
    try {
      await navigator.clipboard.writeText(`https://ag-ui.ai/${feedLanguage}/feed.xml`);
      if (requestGeneration === generation.current) setFeedNotice({ language: feedLanguage, copied: true });
    } catch {
      if (requestGeneration === generation.current) setFeedNotice({ language: feedLanguage, copied: false });
    } finally {
      if (requestGeneration === generation.current) setCopyingFeed(null);
    }
  };

  const terminalKind = notice?.kind === "unsubscribed" || notice?.kind === "suppressed" ? notice.kind
    : subscriber?.status === "unsubscribed" || subscriber?.status === "suppressed" ? subscriber.status : null;
  const terminal = terminalKind !== null;
  const confirmationMode = manage?.action === "confirm";
  const formLocked = busy !== null || readState !== "ready" ||
    ((!manage || confirmationMode) && capacityState !== "ready") || (!manage && capacity?.full === true);
  const submit = async (requested?: SubscriptionAction, automatic = false) => {
    const action = requested || (manage ? confirmationMode ? "confirm" : "preferences" : "signup");
    if (submitting.current || formLocked || terminal) return;
    if (action === "confirm" && !confirmationMode) return;
    if ((action === "signup" || action === "preferences") && (!topics.length || !formRef.current?.reportValidity())) return;
    if (action === "preferences" && subscriber?.status !== "confirmed") return;
    if (automatic) { if (autoAttempted) return; setAutoAttempted(true); }
    const requestGeneration = generation.current, link = manage;
    const controller = new AbortController();
    submissionAbort.current = controller; submitting.current = true; setBusy(action);
    try {
      const response = await fetch(link ? "/api/subscription/manage" : "/api/subscription", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify(link
          ? action === "confirm" ? { ...link, action } : { ...link, action, locale: language, topics }
          : { email, locale: language, topics, consent, website: "" }),
      });
      const result = subscriptionOutcome(action, response.status, await response.json());
      if (controller.signal.aborted || requestGeneration !== generation.current) return;
      if (result.capacity) {
        ++capacityGeneration.current; capacityAbort.current?.abort();
        setCapacity(result.capacity); setCapacityState("ready");
      }
      if (result.subscriber) {
        setSubscriber(result.subscriber); setLanguage(result.subscriber.locale); setTopics(result.subscriber.topics);
      }
      if (result.subscriberStatus) setSubscriber(current => current ? { ...current, status: result.subscriberStatus! } : null);
      setNotice({ kind: result.reason === "unconfirmed" ? "unconfirmed" : result.kind, action });
      // A capacity rejection or non-confirmed response must keep the original
      // confirmation URL. Tokens stay in client state and the intended URL.
      if (link && result.kind === "confirmed" && result.subscriber?.token) {
        const next = { ...link, token: result.subscriber.token, action: "preferences" as const };
        readLink.current = next;
        onManagementUrl(next.id, next.token);
        setManage(next);
        history.replaceState(null, "", `${location.pathname}?${new URLSearchParams({ id: next.id, token: next.token })}`);
      }
      if (result.kind === "confirmed" || result.kind === "unsubscribed") { setCapacityState("loading"); refreshCapacity(); }
      setAttention(value => value + 1);
    } catch {
      if (!controller.signal.aborted && requestGeneration === generation.current) {
        setNotice({ kind: "error", action }); setAttention(value => value + 1);
      }
    } finally {
      if (requestGeneration === generation.current) { submitting.current = false; setBusy(null); }
    }
  };
  const confirmVisible = useEffectEvent(() => {
    if (visibleConfirmation(manage?.action, capacityState === "ready", document.visibilityState, (document as Document & { prerendering?: boolean }).prerendering)) void submit("confirm", true);
  });
  useEffect(() => {
    if (!confirmationMode || capacityState !== "ready") return;
    let cancelled = false;
    const start = () => { if (!cancelled) confirmVisible(); };
    queueMicrotask(start);
    document.addEventListener("visibilitychange", start);
    document.addEventListener("prerenderingchange", start);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", start);
      document.removeEventListener("prerenderingchange", start);
    };
  }, [confirmationMode, capacityState]);

  const display: Notice | null = busy ? { kind: "loading", action: busy }
    : readState === "loading" || confirmationMode && capacityState === "loading" ? { kind: "loading" }
    : terminalKind ? { kind: terminalKind }
    : notice || (manage
      ? confirmationMode ? capacityState === "error" ? { kind: "capacity-error" } : { kind: "confirm-ready" }
        : subscriber?.status === "confirmed" ? { kind: "active" }
        : subscriber?.status === "pending" ? { kind: "unconfirmed" } : null
      : capacityState === "loading" ? { kind: "loading" }
        : capacityState === "error" ? { kind: "capacity-error" }
        : capacity?.enabled === false ? { kind: "unavailable" }
        : capacity?.full ? { kind: "capacity-full" } : null);
  const errorCard = display && ["error", "read-error", "capacity-error"].includes(display.kind);
  const actionName = (action?: SubscriptionAction) => action === "confirm" ? zh ? "确认邮箱" : "confirming your email"
    : action === "preferences" ? zh ? "保存偏好" : "saving preferences"
    : action === "unsubscribe" ? zh ? "退订邮件" : "unsubscribing"
    : zh ? "提交订阅申请" : "submitting your request";
  const content = (current: Notice): [string, string, string] => {
    switch (current.kind) {
      case "loading": return ["↻", current.action ? zh ? `正在${actionName(current.action)}…` : `We’re ${actionName(current.action)}…` : zh ? "正在读取订阅状态…" : "Loading your subscription…", zh ? "请稍候，不会重复提交。" : "Please wait; duplicate submission is blocked."];
      case "confirm-ready": return ["✉", zh ? "邮箱确认" : "Email confirmation", zh ? "页面显示后自动确认；未完成时可以重试。" : "This visible page confirms automatically; retry if unsuccessful."];
      case "active":
      case "confirmed":
        if (subscriber?.subscriptionType === "test") return ["✓", zh ? "测试邮箱已确认" : "Test email confirmed", zh ? "仅供邮件验收，不占正式名额或正式周报。可管理测试偏好或退订。" : "For testing only: no public place or public digest. Manage test preferences or unsubscribe."];
        return current.kind === "active"
          ? ["✓", zh ? "订阅已生效" : "Your subscription is active", zh ? "可修改语言、主题或退订。" : "Change language and topics, or unsubscribe anytime."]
          : ["✓", zh ? "邮箱确认成功，订阅已生效" : "Email confirmed — your subscription is active", zh ? "现在可以设置语言与主题。每封周报都提供偏好与退订入口。" : "You can now set your language and topics. Every digest includes preference and unsubscribe links."];
      case "check-inbox": return ["✉", zh ? "查看邮件，确认订阅" : "Check your email to confirm", zh ? "请查看收件箱与垃圾邮件，点击邮件链接确认。以页面成功提示为准；本提示不证明发信，待确认不占位，邮件可能受额度影响延迟。" : "Check inbox/spam and open the email link to confirm. Only the page’s success message proves activation. This notice does not prove email was sent. Pending requests reserve no place; daily limits may delay email."];
      case "preferences-saved": return ["✓", zh ? "订阅偏好已保存" : "Your preferences are saved", zh ? "这些语言与主题已保存。" : "These language and topic settings are saved."];
      case "unsubscribed": return ["✓", zh ? "已退订，后续邮件已停止" : "You are unsubscribed — future email is stopped", zh ? "后续确认邮件和周报已停止，不能编辑偏好或重复退订。仍可使用 RSS。" : "Future confirmation and digest emails are stopped; editing and repeated unsubscribe are disabled. RSS remains available."];
      case "suppressed": return ["⊘", zh ? "此邮箱已停止投递" : "Email delivery to this address is stopped", zh ? "投递已停止，不能保存偏好或恢复发信。可使用 RSS。" : "Delivery is stopped; preferences and restart are disabled. Use RSS."];
      case "unconfirmed": return ["✉", zh ? "邮箱尚未确认，偏好暂不能保存" : "Confirm your email before saving preferences", zh ? "请使用确认邮件中的入口完成确认。如果链接已过期，可以重新申请确认邮件。" : "Use the link in your confirmation email to confirm. If the link has expired, you can request a fresh confirmation."];
      case "capacity-full": return ["!", zh ? "当前订阅名额已满" : "All subscription places are currently taken", zh ? "250 个正式名额已满，本次未确认。待确认不占位；刷新名额后重试，或使用 RSS。" : "All 250 public places are taken. This request was not confirmed; pending requests reserve no place. Refresh availability and retry, or use RSS."];
      case "unavailable": return ["i", zh ? "邮件订阅暂未开放" : "Email subscriptions are currently unavailable", zh ? "当前不接受新的公众订阅。RSS 仍开放，可以直接阅读全部新闻。" : "New public subscriptions are not being accepted. RSS remains available with the complete news feed."];
      case "capacity-error": return ["!", zh ? "暂时无法读取订阅名额" : "Availability could not be loaded", zh ? "人数未知，不等于零。请刷新名额，或使用 RSS。" : "The count is unknown, not zero. Refresh availability or use RSS."];
      case "read-error": return ["!", zh ? "未能读取你的订阅状态" : "Your subscription could not be loaded", zh ? "未执行保存或退订。请重试读取；链接无效或过期时，重新打开邮件或申请确认。" : "Nothing was saved or unsubscribed. Retry loading; for an invalid or expired link, reopen the email or request a fresh confirmation."];
      default: return ["!", zh ? "未能核验操作结果" : "The result could not be verified", zh ? "未确认成功，请重试或重新读取管理状态。链接无效或过期时，重新打开邮件或申请确认。" : "Success was not verified. Retry or reload your management link. For an invalid or expired link, reopen the email or request a fresh confirmation."];
    }
  };
  const showForm = !terminal && !confirmationMode && readState === "ready" && (manage
    ? subscriber?.status === "confirmed" && notice?.kind !== "unconfirmed"
    : capacity?.enabled === true && !capacity.full && notice?.kind !== "unavailable");
  const currentAction: SubscriptionAction = manage ? "preferences" : "signup";
  const buttonText = busy ? zh ? `正在${actionName(busy)}…` : `We’re ${actionName(busy)}…`
    : manage ? zh ? "保存偏好" : "Save preferences" : notice?.kind === "check-inbox" ? zh ? "确认邮件已申请" : "Confirmation requested" : zh ? "发送确认邮件" : "Send confirmation";

  const form = showForm ? <form className="n-subscription-form" ref={formRef} aria-busy={busy !== null} onSubmit={event => { event.preventDefault(); void submit(currentAction); }}>
          <fieldset className="n-subscription-fields" disabled={formLocked}>
            <legend className="n-subscription-sr-only">{zh ? "订阅信息" : "Subscription details"}</legend>
            <div className="n-subscription-group-head"><h3>{manage ? zh ? "调整阅读偏好" : "Your reading preferences" : zh ? "设置你的周报" : "Make the digest yours"}</h3><p>{zh ? "只留下你关心的内容。" : "Keep the subjects that matter to you."}</p></div>
            <div className={`n-subscription-delivery${manage ? " is-manage" : ""}`}>
              {!manage && <label><span>{zh ? "接收邮箱" : "Email address"}</span><input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={event => { setEmail(event.target.value); setNotice(current => current?.kind === "check-inbox" ? null : current); }} /></label>}
              <label><span>{zh ? "周报语言" : "Digest language"}</span><select value={language} onChange={event => setLanguage(event.target.value as Locale)}><option value="zh">中文</option><option value="en">English</option></select></label>
            </div>
            <fieldset className="n-subscription-topics"><legend>{zh ? "关注主题" : "Your topics"}</legend><p className="n-subscription-topic-help">{zh ? "至少选择一项，可随时调整。" : "Choose at least one. You can update this anytime."}</p><div className="n-subscription-topic-grid">{categories.map(category => <label className={topics.includes(category) ? "is-selected" : ""} key={category}><input type="checkbox" checked={topics.includes(category)} onChange={event => setTopics(current => event.target.checked ? [...current, category] : current.filter(value => value !== category))} /><span>{categoryNames[category][locale]}</span></label>)}</div></fieldset>
            {!manage && <label className="n-subscription-consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} />{zh ? "我同意接收所选主题的周报，可随时退订。" : "I agree to receive the weekly digest for these topics and can unsubscribe anytime."}</label>}
            <div className="n-subscription-actions"><button className="n-button" disabled={formLocked || !topics.length || notice?.kind === "check-inbox"}>{buttonText}<span aria-hidden="true">→</span></button><span className="n-subscription-action-hint">{zh ? "无需注册账号" : "No account required"}</span></div>

          </fieldset>
        </form> : null;

  return (
    <div className="n-subscription-layout">
      <div className="n-subscription-main">
        <header className="n-subscription-intro">
          <span className="n-kicker">EMAIL DIGEST</span>
          <h2>{manage ? zh ? "你的邮件订阅" : "Your email subscription" : zh ? "每周精选，送达邮箱。" : "A weekly perspective, by email."}</h2>
          <p>{zh ? "选择语言与主题，精选事件与研究。仅在有实质更新时发送。" : "Choose a language and topics for selected events and research. No empty editions."}</p>
        </header>
        {!confirmationLanding && form}
        {display && (() => {
          const [icon, title, body] = content(display);
          return <section className={`n-subscription-notice n-subscription-${display.kind}`} ref={noticeRef} tabIndex={-1} role={errorCard ? "alert" : "status"} aria-live={errorCard ? "assertive" : "polite"} aria-atomic="true">
            <span className="n-subscription-icon" aria-hidden="true">{icon}</span>
            <div><h3>{title}</h3><p>{body}</p>
              {confirmationMode && !terminal && autoAttempted && capacityState === "ready" && !busy && <div className="n-subscription-actions"><button type="button" className="n-button" disabled={formLocked} onClick={() => void submit("confirm")}>{zh ? "重试确认" : "Retry confirmation"}<span aria-hidden="true">→</span></button></div>}
              {(display.kind === "read-error" || display.kind === "error" && manage && !confirmationMode) && <button type="button" className="n-subscription-secondary" onClick={retryRead}>{zh ? "重试读取订阅" : "Retry loading subscription"}</button>}
              {display.kind === "unconfirmed" || display.kind === "read-error" || display.kind === "error" && manage ? <a className="n-subscription-link" href={`/${locale}/subscribe`}>{zh ? "重新申请确认邮件" : "Request a fresh confirmation"}</a> : null}

              {["capacity-full", "unavailable", "unsubscribed", "suppressed"].includes(display.kind) && <a className="n-subscription-link" href={`/${locale}/feed.xml`}>{zh ? "通过 RSS 阅读新闻 →" : "Read the news through RSS →"}</a>}
            </div>
          </section>;
        })()}
        {confirmationLanding && form}
        {manage && !confirmationMode && (subscriber?.status === "confirmed" || subscriber?.status === "pending") && <section id="unsubscribe" className="n-subscription-form n-subscription-unsubscribe-area" aria-label={zh ? "结束邮件订阅" : "Stop email updates"}><div><h3>{zh ? "取消邮件订阅" : "Cancel email updates"}</h3><p>{zh ? "停止后续邮件；仍可使用 RSS。" : "Stop future email. RSS remains available."}</p></div><button type="button" className="n-subscription-secondary n-subscription-unsubscribe-button" disabled={formLocked} onClick={() => void submit("unsubscribe")}>{busy === "unsubscribe" ? zh ? "正在退订…" : "Unsubscribing…" : subscriber.status === "pending" ? zh ? "取消订阅申请" : "Cancel subscription request" : zh ? "退订所有邮件" : "Unsubscribe from all email"}</button></section>}
        <section className="n-subscription-capacity" aria-label={zh ? "订阅名额" : "Subscription availability"} aria-busy={capacityState === "loading"}>
          {capacity ? <>
            <div className="n-subscription-capacity-head">
              <div><span className="n-subscription-capacity-label">{zh ? "已确认订阅 / 当前容量" : "Confirmed / capacity"}</span><strong>{capacity.confirmedCount}<span> / {capacity.capacity}</span></strong><span className="n-subscription-capacity-label">{zh ? "位订阅者 · 本站设置" : "subscribers · site limit"}</span></div>
              <span className={`n-subscription-remaining${capacity.full ? " is-full" : ""}`}>{capacity.full ? zh ? "名额已满" : "Capacity reached" : zh ? `剩余 ${capacity.remaining} 个名额` : `${capacity.remaining} places remaining`}</span>
            </div>
            <progress max={capacity.capacity} value={Math.min(capacity.confirmedCount, capacity.capacity)} aria-label={zh ? "已确认订阅人数" : "Confirmed subscribers"} />
            <p>{zh ? `仅确认成功占名额。免费限额 ${capacity.dailyLimit} 封/天，周报预算 ${capacity.weeklyLimit} 封/天；确认邮件共用额度，投递可能延迟。` : `Only confirmed subscriptions occupy places. Daily allowance: ${capacity.dailyLimit} emails, including confirmations; digest budget: ${capacity.weeklyLimit}/day. Delivery may be delayed.`}</p>
          </> : <p>{capacityState === "loading" ? zh ? "正在读取已确认人数与剩余名额…" : "Loading confirmed subscribers and remaining places…" : zh ? "订阅人数暂时未知，请重试读取。" : "Subscriber counts are temporarily unknown. Please retry."}</p>}
          {capacityState === "error" && <p className="n-subscription-inline-error" role="status">{zh ? "名额未能更新，数字为上次结果；仍可管理已生效订阅。" : "Availability failed to refresh; figures are from the last check. Active subscriptions remain manageable."}</p>}
          <button type="button" className="n-subscription-secondary" disabled={busy !== null || capacityState === "loading"} onClick={() => { setCapacityState("loading"); refreshCapacity(); }}>{capacityState === "loading" ? zh ? "正在刷新…" : "Refreshing…" : zh ? "刷新名额" : "Refresh availability"}</button>
        </section>
        <p className="n-small n-subscription-disclosure">{zh ? "邮件由 Brevo 投递。当前匿名打开与点击统计不关联具体联系人，但仍可能包含像素与链接跟踪；本站不依据这些统计决定发信或判断已读。" : "Email is delivered by Brevo. Anonymous open and click statistics are not associated with individual contacts, but tracking pixels and tracked links may remain. We do not use these statistics to decide whether to send email or as proof that an email was read."}</p>
      </div>
      <aside className="n-subscription-sidebar" aria-label={zh ? "RSS 阅读方式" : "Read with RSS"}>
        <section className="n-rss-box">
          <div className="n-rss-heading"><span className="n-kicker">OPEN FEEDS</span><img src="/brand/rss-feed.svg" width="38" height="38" alt="" aria-hidden="true" /></div>
          <h2>{zh ? "阅读，不止一种方式。" : "Read on your terms."}</h2>
          <p>{zh ? "全部已发布新闻，直接进入 RSS 阅读器。无需邮箱，不占名额。" : "All published stories in your RSS reader. No email or subscription place needed."}</p>
          <div className="n-rss-feeds">{(["zh", "en"] as const).map(feedLanguage => {
            const feedUrl = `https://ag-ui.ai/${feedLanguage}/feed.xml`;
            const feedName = feedLanguage === "zh" ? "中文 RSS" : "English RSS";
            return <div className="n-rss-feed" key={feedLanguage}>
              <div className="n-rss-feed-head"><a href={`/${feedLanguage}/feed.xml`}>{feedName}<span aria-hidden="true">↗</span></a><button type="button" disabled={copyingFeed !== null} onClick={() => void copyFeed(feedLanguage)} aria-label={zh ? `复制${feedName}链接` : `Copy ${feedName} link`}>{copyingFeed === feedLanguage ? zh ? "复制中…" : "Copying…" : feedNotice?.language === feedLanguage && feedNotice.copied ? zh ? "已复制 ✓" : "Copied ✓" : zh ? "复制链接" : "Copy link"}</button></div>
              <label className="n-subscription-sr-only" htmlFor={`rss-${feedLanguage}`}>{feedName} URL</label><input id={`rss-${feedLanguage}`} className="n-rss-url" readOnly value={feedUrl} onFocus={event => event.currentTarget.select()} aria-describedby="rss-copy-status" />
            </div>;
          })}</div>
          <p id="rss-copy-status" className={`n-rss-copy-status${feedNotice?.copied === false ? " is-error" : ""}`} role="status" aria-live="polite">{feedNotice ? feedNotice.copied ? zh ? "已复制，粘贴到阅读器即可。" : "Copied. Paste into your reader." : zh ? "复制失败，请手动复制地址。" : "Copy failed. Select and copy the address." : zh ? "点击地址即可选中。" : "Select an address to copy."}</p>
        </section>
        <section className="n-rss-guide" aria-labelledby="rss-guide-title"><span className="n-kicker">HOW TO READ</span><h3 id="rss-guide-title">{zh ? "把新闻加入阅读器" : "Add the news to your reader"}</h3><ol><li><span>{zh ? "选择语言" : "Choose a language"}</span>{zh ? "复制中文或英文 RSS 地址。" : "Copy a Chinese or English feed URL."}</li><li><span>{zh ? "添加订阅源" : "Add a feed"}</span>{zh ? "粘贴到 RSS 阅读器即可。" : "Paste into your RSS reader."}</li></ol><p>{zh ? "兼容入口：" : "Compatibility feed: "}<a href="/feed.xml">/feed.xml</a>{zh ? "（英文）" : " (English)"}</p></section>
      </aside>
    </div>
  );
}
