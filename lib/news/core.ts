import { z } from "zod";
import { categories } from "./types";
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (x) =>
      !Number.isNaN(Date.parse(x)) &&
      new Date(x).toISOString().slice(0, 10) === x,
    "Invalid date",
  );
const copy = z.object({
  title: z.string().min(4).max(180),
  summary: z.string().min(15).max(1200),
  why: z.string().min(10).max(2400),
  details: z.string().min(10).max(6000),
  caveat: z.string().min(8).max(2400),
  audience: z.string().min(2).max(400),
});
export function publicUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !/^(localhost|.*\.local|.*\.internal|.*\.lan|[\d.]+|\[.*\])$/i.test(
        u.hostname,
      ) &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}
export function canonicalUrl(value: string): string {
  const u = new URL(value);
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_|fbclid|gclid)/.test(key)) u.searchParams.delete(key);
  return u.toString().replace(/\/$/, "");
}
const url = z.string().url().refine(publicUrl, "Use a public HTTPS source URL");
export const newsSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    eventDate: day,
    publishedAt: day,
    indexedAt: z.string().datetime(),
    verifiedAt: day,
    canonicalUrl: url,
    sourceName: z.string().min(2).max(120),
    project: z.string().min(2).max(120),
    category: z.enum(categories),
    evidence: z.enum(["official", "vendor-test", "research", "community"]),
    status: z.enum(["published", "review", "withdrawn"]),
    zh: copy,
    en: copy,
    sources: z
      .array(z.object({ url, label: z.string().min(2).max(180) }))
      .max(8)
      .optional(),
  })
  .superRefine((item, ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    for (const key of ["eventDate", "publishedAt", "verifiedAt"] as const)
      if (item[key] > today)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Future dates are not verified events",
        });
    if (item.verifiedAt < item.publishedAt)
      ctx.addIssue({
        code: "custom",
        path: ["verifiedAt"],
        message: "Verification precedes publication",
      });
  });
export async function sha(value: string): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return [
    ...new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function equalSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function singaporeDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
