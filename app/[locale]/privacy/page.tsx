import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHead } from "@/components/news/shared";
export default async function Privacy({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const zh = locale === "zh";
  return (
    <div className="newsroom">
      <PageHead
        locale={locale}
        eyebrow="PRIVACY"
        title={
          zh
            ? "了解网站与邮件数据的使用。"
            : "How site and email data are used."
        }
        description={
          zh
            ? "第一方轻量统计与独立的订阅数据。"
            : "Lightweight first-party metrics, separate from subscription records."
        }
      />
      <article className="n-policy">
        <h2>{zh ? "访问统计" : "Site metrics"}</h2>
        <p>
          {zh
            ? "仅页面实际显示时记录浏览；持续可见 30 秒记录有效阅读，来源链接记录点击。页脚展示累计浏览量、当日访客估算和首个真实访问日期。管理、健康检查、预取、明显机器人和本地测试被排除。"
            : "A visible page records a view, 30 visible seconds records an engaged read, and original-source links record clicks. The footer shows total views, today’s estimated visitors and the first real visit date. Administration, health checks, prefetch, obvious bots and local tests are excluded."}
        </p>
        <p>
          {zh
            ? "服务器使用每日变化的哈希标识估算访客，不持久化原始 IP，不设置统计 Cookie，不把订阅邮箱与浏览轨迹关联。访客估算会受到共享网络、浏览器和机器人识别局限影响。统计故障不影响阅读。"
            : "The server derives a daily keyed identifier to estimate visitors. We do not persist raw IP addresses, set analytics cookies or associate email addresses with reading activity. Shared networks, browsers and imperfect bot detection affect estimates. Metrics failures never prevent reading."}
        </p>
        <h2>{zh ? "邮件订阅" : "Email subscriptions"}</h2>
        <p>
          {zh
            ? "邮箱用于确认订阅、精选周报和订阅偏好；订阅须完成邮件确认后才生效，可选择语言与主题。邮件由 Brevo 投递。本站对每位收件人明确要求关闭打开与点击跟踪；最终邮件是否完全移除像素与链接改写仍待验证，不承诺邮件完全无跟踪。本站不依据打开或点击统计决定发信，也不将其作为已读证明。每封邮件提供退订与偏好链接；退订、投诉和硬退信将停止后续投递。"
            : "Email addresses are used for confirmation, the weekly digest and subscription preferences. A subscription takes effect only after email confirmation, and subscribers can choose their language and topics. Brevo delivers email. We explicitly request no open/click tracking for each recipient. Complete removal of pixels and rewritten links from delivered mail remains unverified; we do not promise tracking-free email. Open/click statistics do not determine sending or prove reading. Every email includes unsubscribe and preference links. Unsubscribes, complaints and hard bounces stop future delivery."}
        </p>
        <p>
          {zh
            ? "如需删除订阅记录或报告隐私问题，请通过社区页面联系站点维护者。"
            : "For deletion of subscription records or privacy questions, contact the maintainers through the community page."}
        </p>
      </article>
    </div>
  );
}
