import { categories, type Category, type Locale } from "./types";

export type SubscriptionCapacity = {
  enabled: boolean;
  confirmedCount: number;
  capacity: number;
  remaining: number;
  full: boolean;
  dailyLimit: number;
  weeklyLimit: number;
};
export type SubscriberView = {
  status: "pending" | "confirmed" | "unsubscribed" | "suppressed";
  subscriptionType: "public" | "test";
  locale: Locale;
  topics: Category[];
  token?: string;
};
export type SubscriptionAction = "signup" | "confirm" | "preferences" | "unsubscribe";
export type SubscriptionOutcome = {
  kind: "check-inbox" | "rate-limited" | "confirmed" | "preferences-saved" | "unsubscribed" | "suppressed" | "capacity-full" | "unavailable" | "error";
  retryAt?: string;
  subscriber?: SubscriberView;
  subscriberStatus?: SubscriberView["status"];
  capacity?: SubscriptionCapacity;
  reason?: "unconfirmed" | "request";
};
export function visibleConfirmation(action: string | undefined, ready: boolean, visibility: string, prerendering?: boolean) {
  return action === "confirm" && ready && visibility === "visible" && !prerendering;
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
// Signed subscription links survive a language change only on their own page.
export function subscriptionLocaleHref(pathname: string | null, locale: Locale, alternate: Locale, search: string) {
  const href = pathname === `/${locale}` || pathname?.startsWith(`/${locale}/`)
    ? pathname.replace(`/${locale}`, `/${alternate}`) : `/${alternate}`;
  if (pathname !== `/${locale}/subscribe`) return href;
  const query = new URLSearchParams(search), signed = new URLSearchParams();
  for (const key of ["id", "token", "action"]) {
    const value = query.get(key);
    if (value) signed.set(key, value);
  }
  return signed.size ? `${href}?${signed}` : href;
}
export function parseSubscriptionCapacity(value: unknown): SubscriptionCapacity | null {
  const v = record(value);
  if (!v || typeof v.enabled !== "boolean" || typeof v.full !== "boolean") return null;
  for (const key of ["confirmedCount", "capacity", "remaining", "dailyLimit", "weeklyLimit"])
    if (typeof v[key] !== "number" || !Number.isInteger(v[key]) || Number(v[key]) < 0) return null;
  if (Number(v.capacity) < 1 || Number(v.remaining) > Number(v.capacity)) return null;
  return {
    enabled: v.enabled, full: v.full,
    confirmedCount: Number(v.confirmedCount), capacity: Number(v.capacity),
    remaining: Number(v.remaining), dailyLimit: Number(v.dailyLimit), weeklyLimit: Number(v.weeklyLimit),
  };
}
export function parseSubscriberView(value: unknown): SubscriberView | null {
  const v = record(value);
  if (!v || !["pending", "confirmed", "unsubscribed", "suppressed"].includes(String(v.status)) ||
    (v.subscriptionType !== "public" && v.subscriptionType !== "test") ||
    (v.locale !== "zh" && v.locale !== "en")) return null;
  let topics: unknown = v.topics;
  if (typeof topics === "string") {
    try { topics = JSON.parse(topics); } catch { return null; }
  }
  if (!Array.isArray(topics) || !topics.length || topics.some(topic => !categories.includes(topic))) return null;
  return {
    status: v.status as SubscriberView["status"], subscriptionType: v.subscriptionType, locale: v.locale,
    topics: [...new Set(topics)] as Category[],
    ...(typeof v.token === "string" && /^[a-f0-9]{64}$/.test(v.token) ? { token: v.token } : {}),
  };
}
// An HTTP success alone cannot prove confirmation, saving or unsubscribe.
export function subscriptionOutcome(action: SubscriptionAction, httpStatus: number, value: unknown): SubscriptionOutcome {
  const v = record(value);
  const retryAt = v?.retryAt;
  if (action === "signup" && httpStatus === 429 && v?.status === "rate-limited" &&
    typeof retryAt === "string" && Number.isFinite(Date.parse(retryAt)) && new Date(retryAt).toISOString() === retryAt)
    return { kind: "rate-limited", retryAt };
  if (action === "signup" && httpStatus === 503 && v?.status === "pending-activation")
    return { kind: "unavailable" };
  if (httpStatus === 409 && v?.status === "capacity-full") {
    const capacity = parseSubscriptionCapacity(v.aggregateCapacity);
    return { kind: "capacity-full", ...(capacity ? { capacity } : {}) };
  }
  if (httpStatus === 409 && ["confirmation-unavailable", "preferences-not-saved"].includes(String(v?.status))) {
    const status = v?.subscriberStatus;
    if (status === "unsubscribed" || status === "suppressed") return { kind: status, subscriberStatus: status };
    if (status === "pending") return { kind: "error", reason: "unconfirmed", subscriberStatus: status };
    return { kind: "error", reason: "request" };
  }
  if (httpStatus < 200 || httpStatus >= 300) return { kind: "error", reason: "request" };
  if (action === "signup") {
    if (v?.status === "check-inbox") return { kind: "check-inbox" };
    if (v?.status === "pending-activation") return { kind: "unavailable" };
    return { kind: "error", reason: "request" };
  }
  const subscriber = parseSubscriberView(v);
  if (!subscriber) return { kind: "error", reason: "request" };
  if (subscriber.status === "unsubscribed" || subscriber.status === "suppressed")
    return { kind: subscriber.status, subscriber };
  if (subscriber.status === "pending") return { kind: "error", reason: "unconfirmed", subscriber };
  if (action === "confirm" && subscriber.token) return { kind: "confirmed", subscriber };
  if (action === "preferences") return { kind: "preferences-saved", subscriber };
  return { kind: "error", reason: "request", subscriber };
}
