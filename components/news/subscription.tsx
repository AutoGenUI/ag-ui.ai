"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { categories, categoryNames, type Category, type Locale } from "@/lib/news/types";
import {
  parseSubscriberView, parseSubscriptionCapacity, subscriptionOutcome,
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
  const [manage, setManage] = useState<ManageLink | null>(initialLink),
    [subscriber, setSubscriber] = useState<SubscriberView | null>(null),
    [capacity, setCapacity] = useState<SubscriptionCapacity | null>(null),
    [capacityState, setCapacityState] = useState<"loading" | "ready" | "error">("loading"),
    [readState, setReadState] = useState<"loading" | "ready" | "error">(initialLink?.action === "preferences" ? "loading" : "ready"),
    [capacityRetry, setCapacityRetry] = useState(0),
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
    submitting = useRef(false), submissionAbort = useRef<AbortController | null>(null),
    noticeRef = useRef<HTMLElement | null>(null), formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/subscription/status", { signal: controller.signal })
      .then(async response => {
        const data = parseSubscriptionCapacity(await response.json());
        if (!response.ok || !data) throw new Error("Unavailable");
        if (controller.signal.aborted) return;
        setCapacity(data); setCapacityState("ready");
        setNotice(current => current?.kind === "capacity-full" && !data.full ? null : current);
      })
      .catch(() => { if (!controller.signal.aborted) setCapacityState("error"); });
    return () => controller.abort();
  }, [capacityRetry]);

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
  useEffect(() => () => { generation.current += 1; submissionAbort.current?.abort(); }, []);

  const refreshCapacity = () => { setCapacityState("loading"); setCapacityRetry(value => value + 1); };
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
  const submit = async (requested?: SubscriptionAction) => {
    const action = requested || (manage ? confirmationMode ? "confirm" : "preferences" : "signup");
    if (submitting.current || formLocked || terminal || action !== "unsubscribe" && !topics.length) return;
    if (action !== "unsubscribe" && !formRef.current?.reportValidity()) return;
    if (action === "preferences" && subscriber?.status !== "confirmed") return;
    const requestGeneration = generation.current, link = manage;
    const controller = new AbortController();
    submissionAbort.current = controller; submitting.current = true; setBusy(action);
    try {
      const response = await fetch(link ? "/api/subscription/manage" : "/api/subscription", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify(link
          ? { ...link, action, locale: language, topics }
          : { email, locale: language, topics, consent, website: "" }),
      });
      const result = subscriptionOutcome(action, response.status, await response.json());
      if (controller.signal.aborted || requestGeneration !== generation.current) return;
      if (result.capacity) { setCapacity(result.capacity); setCapacityState("ready"); }
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
      if (result.kind === "confirmed" || result.kind === "unsubscribed") refreshCapacity();
      setAttention(value => value + 1);
    } catch {
      if (!controller.signal.aborted && requestGeneration === generation.current) {
        setNotice({ kind: "error", action }); setAttention(value => value + 1);
      }
    } finally {
      if (requestGeneration === generation.current) { submitting.current = false; setBusy(null); }
    }
  };

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
      case "loading": return ["↻", current.action ? zh ? `正在${actionName(current.action)}…` : `We’re ${actionName(current.action)}…` : zh ? "正在读取订阅状态…" : "Loading your subscription…", zh ? "请稍候，当前操作完成前不会重复提交。" : "Please wait. Another request cannot be submitted while this one is in progress."];
      case "confirm-ready": return ["✉", zh ? "请确认你的邮箱" : "Confirm your email", zh ? "点击下方“确认订阅”才会生效。打开本页不会自动确认；名额以确认成功为准。" : "Select “Confirm subscription” below to activate it. Opening this page does not confirm your email; a place is allocated only after successful confirmation."];
      case "active": return ["✓", zh ? "订阅已生效" : "Your subscription is active", zh ? "可以修改语言与主题，也可随时退订所有邮件。" : "You can change your language and topics, or unsubscribe from all email at any time."];
      case "check-inbox": return ["✉", zh ? "订阅申请已受理" : "Your subscription request was received", zh ? "如果该邮箱需要确认且当前允许投递，请留意收件箱与垃圾邮件，并通过邮件中的入口主动确认。此提示不能证明邮件已发出或订阅已生效。待确认不占名额，邮件可能受当日额度影响而延迟。" : "If this address needs confirmation and delivery is currently allowed, check your inbox and spam folder and actively confirm through the email. This message does not prove that an email was sent or a subscription is active. Pending requests do not occupy a place; the daily allowance may delay email."];
      case "confirmed": return ["✓", zh ? "邮箱确认成功，订阅已生效" : "Email confirmed — your subscription is active", zh ? "现在可以设置语言与主题。每封周报都提供偏好与退订入口。" : "You can now set your language and topics. Every digest includes preference and unsubscribe links."];
      case "preferences-saved": return ["✓", zh ? "订阅偏好已保存" : "Your preferences are saved", zh ? "下方显示服务器保存的语言与主题，后续周报按这些偏好筛选。" : "The language and topics shown below are the saved values. Future digests use these preferences."];
      case "unsubscribed": return ["✓", zh ? "已退订，后续邮件已停止" : "You are unsubscribed — future email is stopped", zh ? "此邮箱已停止后续确认邮件与周报投递。偏好编辑与重复退订已关闭；仍可使用 RSS 阅读新闻。" : "Future confirmation and digest sends to this address are stopped. Preference editing and repeated unsubscribe actions are closed. You can continue reading through RSS."];
      case "suppressed": return ["⊘", zh ? "此邮箱已停止投递" : "Email delivery to this address is stopped", zh ? "此订阅当前已被停止投递，不能保存偏好或重新发信。可继续使用 RSS 阅读新闻。" : "This subscription is stopped. Preferences cannot be saved and email cannot be restarted here. You can continue reading through RSS."];
      case "unconfirmed": return ["✉", zh ? "邮箱尚未确认，偏好暂不能保存" : "Confirm your email before saving preferences", zh ? "请使用确认邮件中的入口完成确认。如果链接已过期，可以重新申请确认邮件。" : "Use the link in your confirmation email to confirm. If the link has expired, you can request a fresh confirmation."];
      case "capacity-full": return ["!", zh ? "当前订阅名额已满" : "All subscription places are currently taken", zh ? "本站当前容量为 250 位已确认订阅者。此次没有完成新的订阅确认；待确认不保留名额。可刷新名额后再试，或先使用 RSS。" : "The site currently allows 250 confirmed subscribers. No new subscription was confirmed by this request; pending requests do not reserve a place. Refresh availability and try again, or use RSS."];
      case "unavailable": return ["i", zh ? "邮件订阅暂未开放" : "Email subscriptions are currently unavailable", zh ? "当前不接受新的公众订阅。RSS 仍开放，可以直接阅读全部新闻。" : "New public subscriptions are not being accepted. RSS remains available with the complete news feed."];
      case "capacity-error": return ["!", zh ? "暂时无法读取订阅名额" : "Availability could not be loaded", zh ? "当前人数尚未确认，不会显示为零。请重试读取；也可先使用 RSS。" : "The current count is unknown; it is not zero. Retry loading availability, or use RSS for now."];
      case "read-error": return ["!", zh ? "未能读取你的订阅状态" : "Your subscription could not be loaded", zh ? "此次读取没有执行保存或退订。请重试读取；若链接无效或过期，请从邮件重新打开，或申请新的确认邮件。" : "This read request did not save preferences or unsubscribe. Retry loading the subscription. If the link is invalid or expired, reopen it from your email or request a fresh confirmation."];
      default: return ["!", zh ? `未能确认${actionName(current.action)}的结果` : "The result could not be verified", zh ? "没有获得成功确认。请检查下方信息后重试；已有管理链接也可重新读取当前状态。若邮件链接无效或过期，请重新打开邮件或申请新的确认邮件。" : "Success was not confirmed. Check the fields below and try again; an existing management link can also reload the current state. If the email link is invalid or expired, reopen the email or request a fresh confirmation."];
    }
  };
  const showForm = !terminal && readState === "ready" && (manage
    ? confirmationMode ? capacityState === "ready" : subscriber?.status === "confirmed" && notice?.kind !== "unconfirmed"
    : capacityState === "ready" && capacity?.enabled === true && !capacity.full && !["check-inbox", "unavailable"].includes(notice?.kind || ""));
  const currentAction: SubscriptionAction = manage ? confirmationMode ? "confirm" : "preferences" : "signup";
  const buttonText = busy ? zh ? `正在${actionName(busy)}…` : `We’re ${actionName(busy)}…`
    : confirmationMode ? zh ? "确认订阅" : "Confirm subscription"
    : manage ? zh ? "保存偏好" : "Save preferences" : zh ? "发送确认邮件" : "Send confirmation";

  return (
    <div className="n-subscription-layout">
      <div className="n-subscription-main">
        <header className="n-subscription-intro">
          <span className="n-kicker">EMAIL DIGEST</span>
          <h2>{manage ? zh ? "你的邮件订阅" : "Your email subscription" : zh ? "每周精选，送达邮箱。" : "A weekly perspective, by email."}</h2>
          <p>{zh ? "选择语言与主题，精选事件、研究与值得关注的方向。只发送有实质更新的周报。" : "Choose a language and topics for a considered selection of events, research and emerging directions. No empty editions."}</p>
        </header>
        <section className="n-subscription-capacity" aria-label={zh ? "订阅名额" : "Subscription availability"} aria-busy={capacityState === "loading"}>
          {capacity ? <>
            <div className="n-subscription-capacity-head">
              <div><span className="n-subscription-capacity-label">{zh ? "已确认订阅 / 当前容量" : "Confirmed / capacity"}</span><strong>{capacity.confirmedCount}<span> / {capacity.capacity}</span></strong><span className="n-subscription-capacity-label">{zh ? "位订阅者 · 本站设置" : "subscribers · site limit"}</span></div>
              <span className={`n-subscription-remaining${capacity.full ? " is-full" : ""}`}>{capacity.full ? zh ? "名额已满" : "Capacity reached" : zh ? `剩余 ${capacity.remaining} 个名额` : `${capacity.remaining} places remaining`}</span>
            </div>
            <progress max={capacity.capacity} value={Math.min(capacity.confirmedCount, capacity.capacity)} aria-label={zh ? "已确认订阅人数" : "Confirmed subscribers"} />
            <p>{zh ? `名额以邮箱确认成功为准，待确认不占名额。免费发信上限 ${capacity.dailyLimit} 封/天，周报发送预算 ${capacity.weeklyLimit} 封/天；当日额度也用于确认邮件，不能保证同日送达。` : `Places are allocated only after email confirmation; pending requests do not occupy places. The free allowance is ${capacity.dailyLimit} emails/day, with a ${capacity.weeklyLimit}/day digest budget. Confirmations share the daily allowance; delivery on the same day is not guaranteed.`}</p>
          </> : <p>{capacityState === "loading" ? zh ? "正在读取已确认人数与剩余名额…" : "Loading confirmed subscribers and remaining places…" : zh ? "订阅人数暂时未知，请重试读取。" : "Subscriber counts are temporarily unknown. Please retry."}</p>}
          {capacityState === "error" && <p className="n-subscription-inline-error" role="status">{zh ? "名额信息未能更新；已有数字是上次读取结果。已生效订阅仍可退订或管理。" : "Availability could not be updated; any figures shown are the last loaded values. Active subscriptions can still be managed or unsubscribed."}</p>}
          <button type="button" className="n-subscription-secondary" disabled={busy !== null || capacityState === "loading"} onClick={refreshCapacity}>{capacityState === "loading" ? zh ? "正在刷新…" : "Refreshing…" : zh ? "刷新名额" : "Refresh availability"}</button>
        </section>
        {display && (() => {
          const [icon, title, body] = content(display);
          return <section className={`n-subscription-notice n-subscription-${display.kind}`} ref={noticeRef} tabIndex={-1} role={errorCard ? "alert" : "status"} aria-live={errorCard ? "assertive" : "polite"} aria-atomic="true">
            <span className="n-subscription-icon" aria-hidden="true">{icon}</span>
            <div><h3>{title}</h3><p>{body}</p>
              {(display.kind === "read-error" || display.kind === "error" && manage && !confirmationMode) && <button type="button" className="n-subscription-secondary" onClick={retryRead}>{zh ? "重试读取订阅" : "Retry loading subscription"}</button>}
              {display.kind === "unconfirmed" || display.kind === "read-error" || display.kind === "error" && manage ? <a className="n-subscription-link" href={`/${locale}/subscribe`}>{zh ? "重新申请确认邮件" : "Request a fresh confirmation"}</a> : null}
              {display.kind === "check-inbox" && <button type="button" className="n-subscription-secondary" onClick={() => { setNotice(null); setConsent(false); }}>{zh ? "返回填写订阅信息" : "Return to subscription details"}</button>}
              {["capacity-full", "unavailable", "unsubscribed", "suppressed"].includes(display.kind) && <a className="n-subscription-link" href={`/${locale}/feed.xml`}>{zh ? "通过 RSS 阅读新闻 →" : "Read the news through RSS →"}</a>}
            </div>
          </section>;
        })()}
        {showForm && <form className="n-subscription-form" ref={formRef} aria-busy={busy !== null} onSubmit={event => { event.preventDefault(); void submit(currentAction); }}>
          <fieldset className="n-subscription-fields" disabled={formLocked}>
            <legend className="n-subscription-sr-only">{zh ? "订阅信息" : "Subscription details"}</legend>
            <div className="n-subscription-group-head"><h3>{confirmationMode ? zh ? "确认周报订阅" : "Confirm your digest subscription" : manage ? zh ? "调整阅读偏好" : "Your reading preferences" : zh ? "设置你的周报" : "Make the digest yours"}</h3><p>{zh ? "只留下你关心的内容。" : "Keep the subjects that matter to you."}</p></div>
            <div className={`n-subscription-delivery${manage ? " is-manage" : ""}`}>
              {!manage && <label><span>{zh ? "接收邮箱" : "Email address"}</span><input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label>}
              <label><span>{zh ? "周报语言" : "Digest language"}</span><select value={language} onChange={event => setLanguage(event.target.value as Locale)}><option value="zh">中文</option><option value="en">English</option></select></label>
            </div>
            <fieldset className="n-subscription-topics"><legend>{zh ? "关注主题" : "Your topics"}</legend><p className="n-subscription-topic-help">{zh ? "至少选择一项，可随时调整。" : "Choose at least one. You can update this anytime."}</p><div className="n-subscription-topic-grid">{categories.map(category => <label className={topics.includes(category) ? "is-selected" : ""} key={category}><input type="checkbox" checked={topics.includes(category)} onChange={event => setTopics(current => event.target.checked ? [...current, category] : current.filter(value => value !== category))} /><span>{categoryNames[category][locale]}</span></label>)}</div></fieldset>
            {!manage && <label className="n-subscription-consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} />{zh ? "我同意接收所选主题的周报，可随时退订。" : "I agree to receive the weekly digest for these topics and can unsubscribe anytime."}</label>}
            <div className="n-subscription-actions"><button className="n-button" disabled={formLocked || !topics.length}>{buttonText}<span aria-hidden="true">→</span></button><span className="n-subscription-action-hint">{zh ? "无需注册账号" : "No account required"}</span></div>
            {manage && !confirmationMode && subscriber?.status === "confirmed" && <section className="n-subscription-unsubscribe-area" aria-label={zh ? "结束邮件订阅" : "Stop email updates"}><div><h3>{zh ? "不再接收邮件？" : "Prefer fewer emails?"}</h3><p>{zh ? "退订将停止此邮箱的后续邮件，RSS 仍可继续使用。" : "Unsubscribing stops future email to this address. RSS remains available."}</p></div><button type="button" className="n-subscription-secondary n-subscription-unsubscribe-button" disabled={formLocked} onClick={() => void submit("unsubscribe")}>{busy === "unsubscribe" ? zh ? "正在退订…" : "Unsubscribing…" : zh ? "退订所有邮件" : "Unsubscribe from all email"}</button></section>}
          </fieldset>
        </form>}
        <p className="n-small n-subscription-disclosure">{zh ? "邮件由 Brevo 投递。当前匿名打开与点击统计不关联具体联系人，但仍可能包含像素与链接跟踪；本站不依据这些统计决定发信或判断已读。" : "Email is delivered by Brevo. Anonymous open and click statistics are not associated with individual contacts, but tracking pixels and tracked links may remain. We do not use these statistics to decide whether to send email or as proof that an email was read."}</p>
      </div>
      <aside className="n-subscription-sidebar" aria-label={zh ? "RSS 阅读方式" : "Read with RSS"}>
        <section className="n-rss-box">
          <div className="n-rss-heading"><span className="n-kicker">OPEN FEEDS</span><img src="/brand/rss-feed.svg" width="38" height="38" alt="" aria-hidden="true" /></div>
          <h2>{zh ? "阅读，不止一种方式。" : "Read on your terms."}</h2>
          <p>{zh ? "全部已发布新闻，直接进入你的 RSS 阅读器。无需邮箱，也不占订阅名额。" : "All published stories, directly in your RSS reader. No email address or subscription place needed."}</p>
          <div className="n-rss-feeds">{(["zh", "en"] as const).map(feedLanguage => {
            const feedUrl = `https://ag-ui.ai/${feedLanguage}/feed.xml`;
            const feedName = feedLanguage === "zh" ? "中文 RSS" : "English RSS";
            return <div className="n-rss-feed" key={feedLanguage}>
              <div className="n-rss-feed-head"><a href={`/${feedLanguage}/feed.xml`}>{feedName}<span aria-hidden="true">↗</span></a><button type="button" disabled={copyingFeed !== null} onClick={() => void copyFeed(feedLanguage)} aria-label={zh ? `复制${feedName}链接` : `Copy ${feedName} link`}>{copyingFeed === feedLanguage ? zh ? "复制中…" : "Copying…" : feedNotice?.language === feedLanguage && feedNotice.copied ? zh ? "已复制 ✓" : "Copied ✓" : zh ? "复制链接" : "Copy link"}</button></div>
              <label className="n-subscription-sr-only" htmlFor={`rss-${feedLanguage}`}>{feedName} URL</label><input id={`rss-${feedLanguage}`} className="n-rss-url" readOnly value={feedUrl} onFocus={event => event.currentTarget.select()} aria-describedby="rss-copy-status" />
            </div>;
          })}</div>
          <p id="rss-copy-status" className={`n-rss-copy-status${feedNotice?.copied === false ? " is-error" : ""}`} role="status" aria-live="polite">{feedNotice ? feedNotice.copied ? zh ? "链接已复制。粘贴到阅读器即可订阅。" : "Link copied. Paste it into your reader to subscribe." : zh ? "未能自动复制。可选中上方地址手动复制。" : "Automatic copy failed. Select the address above and copy it manually." : zh ? "点击地址可选中，便于手动复制。" : "Select an address to copy it manually."}</p>
        </section>
        <section className="n-rss-guide" aria-labelledby="rss-guide-title"><span className="n-kicker">HOW TO READ</span><h3 id="rss-guide-title">{zh ? "把新闻加入阅读器" : "Add the news to your reader"}</h3><ol><li><span>{zh ? "选择语言" : "Choose a language"}</span>{zh ? "复制上方中文或英文 RSS 地址。" : "Copy the Chinese or English feed address above."}</li><li><span>{zh ? "添加订阅源" : "Add a feed"}</span>{zh ? "在你的 RSS 阅读器中粘贴地址，添加即可。" : "Paste the address into your RSS reader and add it."}</li></ol><p>{zh ? "兼容入口：" : "Compatibility feed: "}<a href="/feed.xml">/feed.xml</a>{zh ? "（英文）" : " (English)"}</p></section>
      </aside>
    </div>
  );
}
