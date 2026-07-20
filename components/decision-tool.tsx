"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { recommendStack, type DecisionControl, type DecisionSurface } from "@/lib/decision";
import type { Locale } from "@/lib/types";

const labels = {
  en: {
    title: "Compose a stack, not a winner", intro: "Four constraints produce a transparent recommendation you can audit.",
    surface: "Where will the UI run?", surfaceOptions: [["own-app", "Your web or mobile app"], ["chat-host", "Inside an AI host"], ["cross-platform", "Across multiple clients"]],
    control: "How much control do you need?", controlOptions: [["strict", "Strict product control"], ["balanced", "Controlled composition"], ["open", "Open-ended generation"]],
    streaming: "Incremental streaming is required", catalog: "A trusted component catalog already exists", recommendation: "Recommended combination", risk: "Boundary to verify",
  },
  zh: {
    title: "组合技术栈，而不是选出唯一赢家", intro: "四项约束生成一组透明、可复核的技术建议。",
    surface: "界面将运行在哪里？", surfaceOptions: [["own-app", "自有 Web 或移动应用"], ["chat-host", "AI 对话宿主内部"], ["cross-platform", "多个客户端之间"]],
    control: "需要多强的产品控制？", controlOptions: [["strict", "严格产品控制"], ["balanced", "受控动态组合"], ["open", "开放式生成"]],
    streaming: "需要增量流式更新", catalog: "已经拥有可信组件目录", recommendation: "推荐组合", risk: "需要核验的边界",
  },
} as const;

export function DecisionTool({ locale }: { locale: Locale }) {
  const t = labels[locale];
  const [surface, setSurface] = useState<DecisionSurface>("own-app");
  const [control, setControl] = useState<DecisionControl>("balanced");
  const [streaming, setStreaming] = useState(true);
  const [hasCatalog, setHasCatalog] = useState(false);
  const results = useMemo(() => recommendStack({ surface, control, streaming, hasCatalog }, locale), [surface, control, streaming, hasCatalog, locale]);
  return (
    <section className="decision-tool" data-testid="decision-tool">
      <div className="decision-intro"><span className="eyebrow">Decision engine / 01</span><h2>{t.title}</h2><p>{t.intro}</p></div>
      <div className="decision-grid">
        <form className="decision-form" onSubmit={(event) => event.preventDefault()}>
          <label>{t.surface}<select data-testid="surface-select" value={surface} onChange={(event) => setSurface(event.target.value as DecisionSurface)}>{t.surfaceOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>{t.control}<select data-testid="control-select" value={control} onChange={(event) => setControl(event.target.value as DecisionControl)}>{t.controlOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="check-row"><input type="checkbox" checked={streaming} onChange={(event) => setStreaming(event.target.checked)} /><span>{t.streaming}</span></label>
          <label className="check-row"><input type="checkbox" checked={hasCatalog} onChange={(event) => setHasCatalog(event.target.checked)} /><span>{t.catalog}</span></label>
        </form>
        <div className="recommendations" aria-live="polite">
          {results.map((result, index) => <article key={result.id} className={index === 0 ? "recommendation-primary" : "recommendation-secondary"}>
            <small>{index === 0 ? t.recommendation : result.rationale}</small>
            <div className="stack-chips">{result.technologies.map((slug, i) => <span key={slug}><Link href={`/${locale}/technologies/${slug}`}>{slug}</Link>{i < result.technologies.length - 1 && <b>+</b>}</span>)}</div>
            {index === 0 && <strong>{result.rationale}</strong>}
            <p><em>{t.risk}:</em> {result.caveat}</p>
          </article>)}
        </div>
      </div>
    </section>
  );
}
