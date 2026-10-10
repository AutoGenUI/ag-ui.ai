import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHead } from "@/components/news/shared";
export default async function Method({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const zh = locale === "zh";
  const sections = zh
    ? [
        [
          "收录范围",
          "我们关注模型、产品、协议、框架、研究和实践中的生成式 UI。持续发现新来源，避免把单个公司的视角等同于整个领域。",
        ],
        [
          "先核验，再解释",
          "每条事件分别记录事件日期、原文发布日期、本站收录时间和最后核验日期。历史补录不伪装成最新发布。优先链接官方公告、规范、仓库版本和论文原文。",
        ],
        [
          "证据完整时自动发布",
          "编辑工作采用高自动化模式：原文已读取、日期已确认且关键事实无冲突时，可以自动发布双语摘要和分析。关键事实缺失、来源无法访问或存在冲突的条目进入待核验队列。只报告可独立确认的部分，并明确保留限制。",
        ],
        [
          "不同证据，不同分量",
          "官方公告、厂商自测、论文与第三方观察使用不同标签。领先、第一等主张必须归因并限定评测范围。本站没有独立复现的结果不会包装成独立测量。",
        ],
        [
          "趋势也需要证据",
          "专题链接支持事件，并列出局限、反例和需要验证的条件。新闻数量不代表采用率。所有摘要和解读为原创，不镜像来源全文。",
        ],
        [
          "修订、纠错与撤回",
          "每次内容修改保留原因和时间。撤回记录保留公开说明，退出新闻列表与 RSS。发现错误可通过社区链接提交来源和具体问题。",
        ],
        [
          "更新状态",
          "计划每日新加坡时间 08:00、20:00 采集，每周一 09:00 整理周报；正式启用前需通过独立云任务读写验收。页面显示真实的最近成功记录，超过 36 小时会提示陈旧。邮件目前待启用。",
        ],
      ]
    : [
        [
          "Scope",
          "We cover Generative UI across models, products, protocols, frameworks, research and practice. Source discovery is continuous; one company’s view is not the whole field.",
        ],
        [
          "Verification before interpretation",
          "We record event date, source publication date, collection time and verification date separately. Historical additions are labeled by their original dates. We prioritize announcements, specifications, releases and original papers.",
        ],
        [
          "Evidence-based automatic publication",
          "Automation can publish bilingual summaries and analysis after reading the original source, confirming dates and resolving material conflicts. Missing facts, inaccessible sources and conflicts enter a review queue. Independently verifiable portions may be reported with explicit limits.",
        ],
        [
          "Different evidence, different weight",
          "Official announcements, vendor benchmarks, papers and community observations carry separate labels. Leadership claims are attributed and bounded by the evaluation scope. We never present an unreplicated result as our own measurement.",
        ],
        [
          "Perspectives with evidence",
          "Every perspective links supporting events and explains limitations, counterevidence and conditions to test. News volume is not adoption. We write original summaries and interpretation, never mirrors of full articles.",
        ],
        [
          "Corrections and withdrawals",
          "Changes preserve their reasons and dates. Withdrawn records retain an explanation but leave the news listing and RSS. Report corrections with a source and specific issue through our community links.",
        ],
        [
          "Update status",
          "The planned cadence is 08:00 and 20:00 Singapore time daily, with a Monday 09:00 digest. Cloud read/write acceptance must pass before schedules are enabled. We show actual successful runs and flag data older than 36 hours. Email is awaiting activation.",
        ],
      ];
  return (
    <div className="newsroom">
      <PageHead
        locale={locale}
        eyebrow="EDITORIAL METHOD"
        title={
          zh ? "可信度来自可追溯的工作。" : "Trust comes from traceable work."
        }
        description={
          zh
            ? "独立、可核验、可修正。不使用无法证实的排名宣传。"
            : "Independent, verifiable and correctable. No unsupported claims to be the largest or best."
        }
      />
      <article className="n-policy">
        {sections.map(([t, b]) => (
          <section key={t}>
            <h2>{t}</h2>
            <p>{b}</p>
          </section>
        ))}
      </article>
    </div>
  );
}
