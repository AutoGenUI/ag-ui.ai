import Link from "next/link";
import { getCollection } from "@/lib/content";
import type { Locale, TechnologyLayer } from "@/lib/types";

const layerCopy: Record<Locale, Record<TechnologyLayer, { index: string; name: string; prompt: string }>> = {
  en: {
    interaction: { index: "01", name: "Agent ↔ frontend interaction", prompt: "How do runs, messages, tools and state move?" },
    declarative: { index: "02", name: "Declarative UI & rendering", prompt: "How is UI intent constrained and rendered?" },
    embedded: { index: "03", name: "Embedded host applications", prompt: "Where does the interactive surface live?" },
    implementation: { index: "04", name: "Implementation & integration", prompt: "What ships the product experience?" },
  },
  zh: {
    interaction: { index: "01", name: "Agent ↔ 前端交互层", prompt: "运行、消息、工具和状态如何流转？" },
    declarative: { index: "02", name: "声明式 UI 与渲染层", prompt: "UI 意图如何受约束并被渲染？" },
    embedded: { index: "03", name: "宿主内嵌应用层", prompt: "交互界面运行在哪里？" },
    implementation: { index: "04", name: "实现与集成层", prompt: "最终产品体验由什么交付？" },
  },
};

const layerOrder: TechnologyLayer[] = ["interaction", "declarative", "embedded", "implementation"];

export function LayerMap({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const technologies = getCollection("technologies", locale);
  return (
    <div className={`layer-map ${compact ? "layer-map-compact" : ""}`} data-testid="layer-map">
      {layerOrder.map((layer) => {
        const copy = layerCopy[locale][layer];
        return (
          <section className={`layer-row layer-${layer}`} key={layer}>
            <div className="layer-label">
              <span>{copy.index}</span>
              <div><h3>{copy.name}</h3><p>{copy.prompt}</p></div>
            </div>
            <div className="layer-nodes">
              {technologies.filter((item) => item.layer === layer).map((item) => (
                <Link href={`/${locale}/technologies/${item.slug}`} key={item.slug} className="tech-node">
                  <strong>{item.title}</strong>
                  {!compact && <small>{item.kind.replace("-", " ")} · {item.maturity.replace("-", " ")}</small>}
                </Link>
              ))}
              {layer === "implementation" && <span className="tech-node tech-node-muted"><strong>Agent frameworks</strong><small>{locale === "zh" ? "多种实现" : "many implementations"}</small></span>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
