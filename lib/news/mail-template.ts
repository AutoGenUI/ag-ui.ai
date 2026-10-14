import { escapeHtml } from "./core";
import type { Locale, NewsItem } from "./types";

type MailTemplateInput = {
  locale: Locale;
  manageUrl: string;
  test?: boolean;
} & ({ kind: "confirmation"; confirmUrl: string } | {
  kind: "weekly";
  editionId: string;
  items: NewsItem[];
});

// Inline styles and presentation tables retain the reading hierarchy in mail
// clients that do not support application CSS. No remote images or tracking.
export function renderMail(input: MailTemplateInput) {
  const zh = input.locale === "zh", confirm = input.kind === "confirmation";
  const title = confirm ? zh ? "确认你的订阅" : "Confirm your subscription"
    : zh ? "这一周，生成式 UI 值得关注的进展" : "This week in Generative UI";
  let subject = confirm ? zh ? "确认订阅 AG-UI.AI" : "Confirm your AG-UI.AI subscription"
    : `AG-UI.AI · ${zh ? "生成式 UI 周报" : "Generative UI weekly"} · ${input.kind === "weekly" ? input.editionId : ""}`;
  const urlBlock = (url: string, label: string) => `<p style="margin:20px 0 6px;font-size:12px;color:#687081">${escapeHtml(label)}</p><p style="margin:0;padding:12px;background:#f3f4f8;border:1px solid #e1e4eb;border-radius:6px;font:11px/1.8 monospace;overflow-wrap:anywhere;word-break:break-all">${escapeHtml(url)}</p>`;
  const copyHint = zh ? "按钮无法打开时，请复制此网址到浏览器。本站要求关闭打开与点击跟踪；像素与链接改写是否完全移除仍待验证。" : "If the button will not open, copy this URL into your browser. We request no open/click tracking; complete pixel/link removal remains unverified.";
  const testNotice = zh ? "这是邮件验收测试，不会加入正式周报名单。" : "This is an email acceptance test, not a public newsletter subscription.";
  let content: string, plain: string;
  if (input.kind === "confirmation") {
    const explanation = zh ? "点击下方蓝色按钮。页面打开后会自动确认订阅，请等待成功提示，无需再点击一次。链接 24 小时内有效。"
      : "Select the blue button below. The page will confirm your subscription automatically; wait for the success message. No second click is needed. This link is valid for 24 hours.";
    const label = zh ? "确认订阅" : "Confirm subscription";
    content = `<p style="margin:0 0 24px;font-size:16px;line-height:1.85;color:#444d60">${explanation}</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#2443d6" style="border-radius:7px"><a href="${escapeHtml(input.confirmUrl)}" style="display:inline-block;padding:15px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px">${label} &rarr;</a></td></tr></table><p style="margin:18px 0 0;font-size:13px;line-height:1.8;color:#687081">${zh ? "每周精选 · 选择感兴趣的主题 · 可随时退订" : "A considered weekly selection · Your topics · Unsubscribe anytime"}</p>${urlBlock(input.confirmUrl, zh ? "确认订阅的网址（24 小时内有效）" : "Subscription confirmation URL (valid for 24 hours)")}<p style="font-size:11px;line-height:1.8;color:#687081">${copyHint}</p>`;
    plain = `${explanation}\n\n${label} (24h)\n${input.confirmUrl}\n\n${copyHint}`;
  } else {
    content = input.items.map(item => {
      const copy = item[input.locale], href = `https://ag-ui.ai/${input.locale}/news/${encodeURIComponent(item.slug)}`;
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-bottom:1px solid #e3e5eb"><tr><td style="padding:0 0 25px"><p style="margin:0 0 9px;font-size:11px;color:#687081">${escapeHtml(item.sourceName)} &middot; ${escapeHtml(item.eventDate)}</p><h2 style="margin:0 0 12px;font-size:21px;line-height:1.45"><a href="${escapeHtml(href)}" style="color:#17245d;text-decoration:none">${escapeHtml(copy.title)}</a></h2><p style="margin:0;font-size:15px;line-height:1.8;color:#444d60">${escapeHtml(copy.summary)}</p><p style="margin:14px 0 0;font-size:13px"><a href="${escapeHtml(href)}" style="color:#2443d6">${zh ? "阅读报道与原始来源" : "Read the story and original sources"} &rarr;</a></p></td></tr></table><p style="margin:0;height:22px">&nbsp;</p>`;
    }).join("");
    plain = input.items.map(item => `${item[input.locale].title}\n${item.sourceName} · ${item.eventDate}\n${item[input.locale].summary}\nhttps://ag-ui.ai/${input.locale}/news/${encodeURIComponent(item.slug)}`).join("\n\n");
  }
  const managementTitle = confirm ? zh ? "不需要这次订阅？" : "Didn't request this subscription?" : zh ? "邮件管理" : "Email preferences";
  const managementNote = confirm ? zh ? "忽略此邮件不会加入周报。下方仅用于管理或取消申请，与上方的确认按钮不同。" : "Ignoring this email will not subscribe you. The separate link below manages or cancels this request; it does not confirm it."
    : zh ? "在这里修改关注主题，或停止后续邮件。退订操作需在管理页确认。" : "Change your topics or stop future email here. Unsubscribe on the management page.";
  const managementLabel = confirm ? zh ? "管理或取消本次申请" : "Manage or cancel this request" : zh ? "修改订阅偏好" : "Change preferences";
  const unsubscribeLabel = zh ? "打开退订管理" : "Open unsubscribe settings";
  const footer = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f3f4f8" style="border-top:2px solid #d8dce7"><tr><td style="padding:26px 30px"><h2 style="font-size:14px;color:#444d60;margin:0 0 10px">${managementTitle}</h2><p style="font-size:12px;line-height:1.8;color:#687081;margin:0 0 14px">${managementNote}</p><a href="${escapeHtml(input.manageUrl)}" style="color:#43547c;font-size:12px">${managementLabel}</a>${confirm ? "" : ` &nbsp; &middot; &nbsp; <a href="${escapeHtml(input.manageUrl)}#unsubscribe" style="font-size:12px;color:#8b4c42">${unsubscribeLabel}</a>`}${urlBlock(input.manageUrl, zh ? "订阅管理网址（不是确认链接）" : "Management URL (not a confirmation link)")}<p style="font-size:11px;line-height:1.8;color:#687081">${copyHint}</p></td></tr></table>`;
  const preheader = confirm ? zh ? "打开邮件链接即可自动确认订阅。" : "Open the email link to confirm automatically."
    : zh ? "有来源、有脉络的生成式 UI 每周精选。" : "Source-backed Generative UI news and perspectives.";
  const html = `<!doctype html><html lang="${input.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f2f0e8;color:#17245d;font-family:Arial,'Microsoft YaHei',sans-serif"><div style="display:none;max-height:0;overflow:hidden">${preheader}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f2f0e8"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fffefa" style="max-width:620px;border:1px solid #dedfd8;border-radius:12px"><tr><td style="padding:27px 30px;border-bottom:1px solid #dedfd8"><span style="font-size:22px;font-weight:700;letter-spacing:-.5px">AG-UI.AI</span><p style="margin:7px 0 0;font-size:10px;letter-spacing:2px;color:#687081">GENERATIVE UI INTELLIGENCE</p></td></tr><tr><td style="padding:30px"><p style="margin:0 0 12px;font-size:10px;letter-spacing:2px;color:#687081">${confirm ? "EMAIL CONFIRMATION" : "WEEKLY PERSPECTIVE"}</p><h1 style="font-size:27px;line-height:1.4;margin:0 0 20px">${title}</h1>${input.test ? `<p style="padding:12px;background:#fff3da;font-size:13px;line-height:1.8;color:#73520d">${testNotice}</p>` : ""}${content}</td></tr><tr><td>${footer}</td></tr></table><p style="margin:20px 0 0;font-size:11px;line-height:1.8;color:#737a86">AG-UI.AI · Independent Generative UI intelligence<br>Sent with Brevo</p></td></tr></table></body></html>`;
  let text = `${subject}\n\n${title}\n\n${plain}\n\n------------------------------\n${managementTitle}\n${managementNote}\n\n${managementLabel}\n${input.manageUrl}${confirm ? "" : `\n\n${unsubscribeLabel}\n${input.manageUrl}#unsubscribe`}\n\n${copyHint}\n\nAG-UI.AI · Independent Generative UI intelligence · Sent with Brevo`;
  if (input.test) {
    subject = `[${zh ? "验收测试" : "Acceptance test"}] ${subject}`;
    text = `${testNotice}\n\n${text}`;
  }
  return { subject, html, text };
}
