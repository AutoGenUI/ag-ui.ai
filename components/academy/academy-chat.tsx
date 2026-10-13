"use client";

import { HttpAgent, type AgentSubscriber, type BaseEvent, type Message as AgUiMessage } from "@ag-ui/client";
import type { ChatStatus } from "ai";
import { BookOpen, Code2, Copy, FlaskConical, Languages, Menu, PanelRight, Plus, Settings2, SquareStack } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageAction, MessageActions, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, type PromptInputMessage, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { EventInspector, type AcademyEventLog } from "@/components/academy/event-inspector";
import { LessonArtifact } from "@/components/academy/lesson-artifact";
import { ModelSettings, modelDefaults, type ModelSettingsValue } from "@/components/academy/model-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { AcademyCourseView, AcademyLessonView, AcademyPhase } from "@/lib/academy/course";
import type { Locale } from "@/lib/types";

interface AcademyMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface RuntimeSnapshot {
  lessonId?: string;
  provider?: { mode?: string; label?: string; model?: string };
}

const copy = {
  en: {
    brand: "Build Generative UI",
    newChat: "New build session",
    curriculum: "Curriculum",
    recent: "Current session",
    recentTitle: "Rebuild AG-UI.AI",
    welcomeKicker: "LEARN BY USING · BUILD BY INSPECTING",
    welcome: "Build this AI interface from zero to one.",
    intro: "Every answer teaches a concept, points to the artifact that implements it, and exposes the AG-UI events that carried it to the screen.",
    prompt: "Ask how this application works…",
    disclaimer: "Models can be wrong. Verify source links and run the repository gates before shipping.",
    inspect: "Inspect AG-UI",
    menu: "Open curriculum",
    copied: "Copied",
    copy: "Copy",
    stopped: "Generation stopped.",
    error: "The run did not complete. Check Model settings or use the offline tutor.",
    start: "Start this lesson",
  },
  zh: {
    brand: "构建生成式 UI",
    newChat: "新建构建会话",
    curriculum: "从 0 到 1 课程",
    recent: "当前会话",
    recentTitle: "复刻 AG-UI.AI",
    welcomeKicker: "边用边学 · 边查边建",
    welcome: "从零到一，亲手构建这款 AI 界面。",
    intro: "每次回答都会讲清一个概念，指向实现它的仓库实物，并公开把它送到屏幕上的 AG-UI 事件。",
    prompt: "询问这个应用是如何工作的……",
    disclaimer: "模型可能出错。发布前请核对来源并运行仓库门禁。",
    inspect: "检查 AG-UI",
    menu: "打开课程",
    copied: "已复制",
    copy: "复制",
    stopped: "生成已停止。",
    error: "本次运行未完成。请检查模型设置，或切回离线导师。",
    start: "开始本节",
  },
} as const;

const suggestions = ["mental-model", "ag-ui", "json-render", "byok-security"];

function isPersistedMessages(value: unknown): value is AcademyMessage[] {
  return Array.isArray(value) && value.length <= 80 && value.every((item) => typeof item === "object" && item !== null && typeof item.id === "string" && (item.role === "user" || item.role === "assistant") && typeof item.text === "string" && item.text.length < 40_000);
}

function eventDetail(event: BaseEvent): string {
  const delta = typeof event.delta === "string" ? event.delta : "";
  const toolCallName = typeof event.toolCallName === "string" ? event.toolCallName : "tool";
  const stepName = typeof event.stepName === "string" ? event.stepName : "step";
  const code = typeof event.code === "string" ? event.code : "run error";
  if (event.type === "TEXT_MESSAGE_CONTENT") return delta.replace(/\s+/g, " ").trim().slice(0, 54) || "text delta";
  if (event.type === "TOOL_CALL_START") return toolCallName;
  if (event.type === "TOOL_CALL_ARGS") return delta.slice(0, 54);
  if (event.type === "TOOL_CALL_RESULT") return "retrieval receipt";
  if (event.type === "STATE_SNAPSHOT") {
    const snapshot = event.snapshot as RuntimeSnapshot;
    return `${snapshot.lessonId ?? "lesson"} · ${snapshot.provider?.mode ?? "runtime"}`;
  }
  if (event.type === "STEP_STARTED" || event.type === "STEP_FINISHED") return stepName;
  if (event.type === "RUN_ERROR") return code;
  return "event";
}

function toAgUiMessages(messages: AcademyMessage[]): AgUiMessage[] {
  return messages.map((message) => ({ id: message.id, role: message.role, content: message.text }));
}

function Curriculum({ locale, lessons, phaseLabels, activeLesson, disabled, onSelect }: AcademyCourseView & { locale: Locale; activeLesson: AcademyLessonView; disabled: boolean; onSelect: (lesson: AcademyLessonView) => void }) {
  const t = copy[locale];
  const phases = Object.keys(phaseLabels) as AcademyPhase[];
  return <div className="academy-curriculum">
    <p className="academy-sidebar-label">{t.curriculum}</p>
    {phases.map((phase) => <section key={phase}>
      <h3>{phaseLabels[phase]}</h3>
      {lessons.filter((lesson) => lesson.phase === phase).map((lesson) => <button aria-current={lesson.id === activeLesson.id ? "step" : undefined} disabled={disabled} key={lesson.id} onClick={() => onSelect(lesson)} type="button">
        <span>{String(lesson.order).padStart(2, "0")}</span><b>{lesson.title}</b>
      </button>)}
    </section>)}
  </div>;
}

export function AcademyChat({ locale, lessons, phaseLabels }: { locale: Locale } & AcademyCourseView) {
  const t = copy[locale];
  const storageKey = `ag-ui-ai:academy:${locale}`;
  const threadId = useRef(`academy-${crypto.randomUUID()}`);
  const agentRef = useRef<HttpAgent | null>(null);
  const [messages, setMessages] = useState<AcademyMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [errorText, setErrorText] = useState("");
  const [events, setEvents] = useState<AcademyEventLog[]>([]);
  const [activeLessonId, setActiveLessonId] = useState("mental-model");
  const [providerLabel, setProviderLabel] = useState(locale === "zh" ? "离线导师 / DeepSeek 试用" : "Offline tutor / DeepSeek trial");
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<ModelSettingsValue>({ provider: "trial", apiKey: "", baseURL: "", model: modelDefaults.trial });
  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId) ?? lessons[0];
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => { document.documentElement.lang = previousLanguage; };
  }, [locale]);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        if (isPersistedMessages(saved)) setMessages(saved);
      } catch {
        localStorage.removeItem(storageKey);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [hydrated, messages, storageKey]);

  const stop = useCallback(() => {
    agentRef.current?.abortRun();
    agentRef.current = null;
    setStatus("ready");
    setErrorText(t.stopped);
  }, [t.stopped]);

  const reset = useCallback(() => {
    agentRef.current?.abortRun();
    setMessages([]);
    setEvents([]);
    setErrorText("");
    setStatus("ready");
    setActiveLessonId("mental-model");
    threadId.current = `academy-${crypto.randomUUID()}`;
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const send = useCallback(async (text: string, lessonOverride?: AcademyLessonView) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const lesson = lessonOverride ?? activeLesson;
    if (lessonOverride) setActiveLessonId(lesson.id);
    setInput("");
    setErrorText("");
    setEvents([]);
    setStatus("submitted");
    const userMessage: AcademyMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
    const outbound = [...messages, userMessage];
    setMessages(outbound);

    const agent = new HttpAgent({
      url: "/api/agent",
      agentId: "ag-ui-ai-academy",
      threadId: threadId.current,
      initialMessages: toAgUiMessages(outbound),
    });
    agentRef.current = agent;

    const subscriber: AgentSubscriber = {
      onEvent: ({ event }) => {
        const entry: AcademyEventLog = { id: crypto.randomUUID(), type: event.type, detail: eventDetail(event), at: Date.now() };
        setEvents((current) => [...current, entry].slice(-80));
      },
      onRunStartedEvent: () => { setStatus("streaming"); },
      onTextMessageStartEvent: ({ event }) => {
        setMessages((current) => current.some((message) => message.id === event.messageId) ? current : [...current, { id: event.messageId, role: "assistant", text: "" }]);
      },
      onTextMessageContentEvent: ({ event }) => {
        setMessages((current) => current.map((message) => message.id === event.messageId ? { ...message, text: `${message.text}${event.delta}` } : message));
      },
      onStateSnapshotEvent: ({ event }) => {
        const snapshot = event.snapshot as RuntimeSnapshot;
        if (lessons.some((lesson) => lesson.id === snapshot.lessonId)) setActiveLessonId(snapshot.lessonId as string);
        const label = snapshot.provider?.label;
        const model = snapshot.provider?.model;
        if (label) setProviderLabel(snapshot.provider?.mode !== "offline" && model ? `${label} · ${model}` : label);
      },
      onRunFinishedEvent: () => { setStatus("ready"); },
      onRunErrorEvent: ({ event }) => { setStatus("error"); setErrorText(event.message || t.error); },
    };

    try {
      await agent.runAgent({
        runId: crypto.randomUUID(),
        forwardedProps: {
          locale,
          lessonId: lessonOverride?.id,
          model: settings,
        },
      }, subscriber);
      setStatus("ready");
    } catch {
      if (agentRef.current === agent) {
        setStatus("error");
        setErrorText(t.error);
      }
    } finally {
      if (agentRef.current === agent) agentRef.current = null;
    }
  }, [activeLesson, busy, lessons, locale, messages, settings, t.error]);

  const selectLesson = useCallback((lesson: AcademyLessonView) => {
    void send(lesson.starterPrompt, lesson);
  }, [send]);

  const handleSubmit = useCallback(async (message: PromptInputMessage) => {
    await send(message.text);
  }, [send]);

  const groupedSuggestionLessons = useMemo(() => suggestions.map((id) => lessons.find((lesson) => lesson.id === id)).filter((lesson): lesson is AcademyLessonView => Boolean(lesson)), [lessons]);

  const curriculum = <Curriculum activeLesson={activeLesson} disabled={busy} lessons={lessons} phaseLabels={phaseLabels} locale={locale} onSelect={selectLesson} />;
  const inspector = <div className="academy-inspector-inner"><LessonArtifact lesson={activeLesson} lessonCount={lessons.length} phaseLabel={phaseLabels[activeLesson.phase]} locale={locale} providerLabel={providerLabel} /><EventInspector events={events} locale={locale} status={status} /></div>;

  return <div className="academy-app dark">
    <aside className="academy-sidebar">
      <div className="academy-brand"><span>A/</span><div><b>AG-UI.AI</b><small>{t.brand}</small></div></div>
      <Button className="academy-new-chat" disabled={busy} onClick={reset} variant="outline"><Plus />{t.newChat}</Button>
      <ScrollArea className="academy-sidebar-scroll">{curriculum}</ScrollArea>
      <div className="academy-sidebar-bottom">
        <p className="academy-sidebar-label">{t.recent}</p>
        <button type="button"><SquareStack /><span><b>{t.recentTitle}</b><small>{messages.length} messages</small></span></button>
        <div className="academy-resource-links">
          <Link href={`/${locale}`}><BookOpen />{locale === "zh" ? "返回新闻" : "Back to news"}</Link>
          <Link href={`/${locale}/map`}><BookOpen />{locale === "zh" ? "知识图谱" : "Knowledge map"}</Link>
          <Link href={`/${locale}/lab/ag-ui-events`}><FlaskConical />{locale === "zh" ? "事件实验室" : "Event lab"}</Link>
          <a href="https://github.com/AutoGenUI/ag-ui.ai"><Code2 />GitHub</a>
        </div>
      </div>
    </aside>

    <main className="academy-chat-main">
      <header className="academy-topbar">
        <div className="academy-mobile-actions">
          <Sheet><SheetTrigger asChild><Button aria-label={t.menu} size="icon" variant="ghost"><Menu /></Button></SheetTrigger><SheetContent className="academy-mobile-sheet dark" side="left"><SheetHeader><SheetTitle>{t.curriculum}</SheetTitle></SheetHeader><ScrollArea className="h-[calc(100dvh-5rem)]">{curriculum}</ScrollArea></SheetContent></Sheet>
        </div>
        <div className="academy-topbar-title"><span>{String(activeLesson.order).padStart(2, "0")}</span><div><b>{activeLesson.title}</b><small>{phaseLabels[activeLesson.phase]}</small></div></div>
        <div className="academy-topbar-actions">
          <Badge className="academy-provider-badge" variant="outline"><span />{providerLabel}</Badge>
          <Link className="academy-locale" href={`/${locale === "en" ? "zh" : "en"}/learn/academy`}><Languages />{locale === "en" ? "中文" : "EN"}</Link>
          <ModelSettings locale={locale} value={settings} onChange={setSettings} />
          <Sheet><SheetTrigger asChild><Button aria-label={t.inspect} className="academy-inspector-trigger" size="sm" variant="ghost"><PanelRight /><span>{t.inspect}</span></Button></SheetTrigger><SheetContent className="academy-mobile-sheet dark" side="right"><SheetHeader><SheetTitle>{t.inspect}</SheetTitle></SheetHeader>{inspector}</SheetContent></Sheet>
        </div>
      </header>

      <Conversation className="academy-conversation" initial={messages.length > 0 ? "smooth" : false}>
        <ConversationContent className="academy-conversation-content">
          {messages.length === 0 ? <section className="academy-welcome">
            <div className="academy-welcome-mark">A/</div>
            <p>{t.welcomeKicker}</p>
            <h1>{t.welcome}</h1>
            <span>{t.intro}</span>
            <div className="academy-suggestions">
              {groupedSuggestionLessons.map((lesson) => <button disabled={busy} key={lesson.id} onClick={() => selectLesson(lesson)} type="button"><small>{phaseLabels[lesson.phase]}</small><b>{lesson.title}</b><span>{lesson.summary}</span><em>{t.start} →</em></button>)}
            </div>
          </section> : messages.map((message, index) => <Message from={message.role} key={message.id}>
            <MessageContent>
              {message.role === "assistant" ? <MessageResponse>{message.text || (busy ? "…" : "")}</MessageResponse> : <p>{message.text}</p>}
            </MessageContent>
            {message.role === "assistant" && message.text && <MessageActions>
              <MessageAction label={t.copy} onClick={() => navigator.clipboard.writeText(message.text)} tooltip={t.copy}><Copy /></MessageAction>
              {index === messages.length - 1 && <span className="academy-message-meta">AG-UI · {providerLabel}</span>}
            </MessageActions>}
          </Message>)}
          {errorText && <div className="academy-run-notice" role="status">{errorText}</div>}
        </ConversationContent>
        <ConversationScrollButton aria-label={locale === "zh" ? "滚动到最新内容" : "Scroll to latest content"} />
      </Conversation>

      <div className="academy-composer-wrap">
        <PromptInput className="academy-composer" onSubmit={handleSubmit}>
          <PromptInputBody><PromptInputTextarea disabled={busy} onChange={(event) => setInput(event.target.value)} placeholder={t.prompt} value={input} /></PromptInputBody>
          <PromptInputFooter><PromptInputTools><span className="academy-context-chip"><Settings2 />{activeLesson.title}</span></PromptInputTools><PromptInputSubmit aria-label={locale === "zh" ? "发送消息" : "Send message"} disabled={!input.trim() && !busy} onStop={stop} status={status} /></PromptInputFooter>
        </PromptInput>
        <p>{t.disclaimer}</p>
      </div>
    </main>

    <aside className="academy-inspector">{inspector}</aside>
  </div>;
}
