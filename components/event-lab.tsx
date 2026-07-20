"use client";

import { useMemo, useState } from "react";
import { failureFixture, initialLabState, reduceLabEvent, successFixture, type LabEvent } from "@/lib/lab";
import type { Locale } from "@/lib/types";

export function EventLab({ locale }: { locale: Locale }) {
  const [mode, setMode] = useState<"success" | "failure">("success");
  const [cursor, setCursor] = useState(0);
  const [manualEvents, setManualEvents] = useState<LabEvent[]>([]);
  const fixture = mode === "success" ? successFixture : failureFixture;
  const state = useMemo(() => [...fixture.slice(0, cursor), ...manualEvents].reduce(reduceLabEvent, initialLabState), [fixture, cursor, manualEvents]);
  const reset = (nextMode = mode) => { setMode(nextMode); setCursor(0); setManualEvents([]); };
  const next = () => setCursor((value) => Math.min(value + 1, fixture.length));
  const retry = () => { setMode("success"); setCursor(successFixture.length); setManualEvents([]); };
  const approve = () => setManualEvents((events) => [...events, { type: "USER_ACTION", payload: { action: "approve_recommendation" } }, { type: "RUN_FINISHED", payload: { outcome: "submitted" } }]);
  const visibleEvents = [...fixture.slice(0, cursor), ...manualEvents];
  return (
    <div className="event-lab" data-testid="event-lab">
      <div className="lab-toolbar">
        <div><span className="status-light" data-status={state.status} /><strong>{state.status.toUpperCase()}</strong><small>{state.progress}%</small></div>
        <div className="lab-controls">
          <button data-testid="success-mode" onClick={() => reset("success")} className={mode === "success" ? "active" : ""}>{locale === "zh" ? "正常链路" : "Success path"}</button>
          <button data-testid="failure-mode" onClick={() => reset("failure")} className={mode === "failure" ? "active" : ""}>{locale === "zh" ? "失败链路" : "Failure path"}</button>
        </div>
      </div>
      <div className="lab-grid">
        <section className="event-console" aria-label={locale === "zh" ? "事件控制台" : "Event console"}>
          <div className="console-head"><span>EVENT STREAM</span><span>{visibleEvents.length}/{fixture.length + manualEvents.length}</span></div>
          <ol>
            {visibleEvents.map((event, index) => <li key={`${event.type}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{event.type}</strong><code>{JSON.stringify(event.payload)}</code></li>)}
            {!visibleEvents.length && <li className="console-empty">{locale === "zh" ? "点击「下一事件」开始。" : "Press “Next event” to begin."}</li>}
          </ol>
        </section>
        <section className="render-surface" aria-label={locale === "zh" ? "渲染结果" : "Rendered result"}>
          <div className="surface-head"><span>RENDERED SURFACE</span><span>trusted_catalog:v1</span></div>
          <div className="surface-body">
            <div className="progress-track"><span style={{ width: `${state.progress}%` }} /></div>
            <p className="surface-label">{locale === "zh" ? "Agent 消息" : "Agent message"}</p>
            <p className="agent-message">{state.message || (locale === "zh" ? "等待事件…" : "Waiting for events…")}</p>
            {state.tool && <div className="tool-call"><span>TOOL</span><strong>{state.tool}</strong><small>{locale === "zh" ? "参数已校验" : "arguments validated"}</small></div>}
            {state.status === "waiting" && <div className="approval-card"><strong>{locale === "zh" ? "推荐 A2UI + AG-UI" : "Recommend A2UI + AG-UI"}</strong><p>{locale === "zh" ? "声明式跨端界面由 AG-UI 事件流承载。" : "Portable declarative UI carried over an AG-UI event stream."}</p><button data-testid="approve-action" onClick={approve}>{locale === "zh" ? "确认并提交" : "Approve & submit"}</button></div>}
            {state.status === "error" && <div className="error-card"><strong>UNKNOWN_COMPONENT</strong><p>{locale === "zh" ? "组件不在可信目录中，渲染已安全中止。" : "The component is outside the trusted catalog. Rendering stopped safely."}</p><button data-testid="retry-action" onClick={retry}>{locale === "zh" ? "使用安全目录重试" : "Retry with safe catalog"}</button></div>}
            {state.status === "finished" && <div className="success-card">✓ {locale === "zh" ? "用户动作已提交，运行完成。" : "User action submitted. Run finished."}</div>}
          </div>
        </section>
      </div>
      <div className="lab-stepper"><button onClick={() => reset()}>{locale === "zh" ? "重置" : "Reset"}</button><button data-testid="next-event" className="button-primary" onClick={next} disabled={cursor >= fixture.length}>{locale === "zh" ? "下一事件 →" : "Next event →"}</button></div>
    </div>
  );
}
