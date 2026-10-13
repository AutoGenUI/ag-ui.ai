import type { Locale } from "@/lib/types";

export type AcademyPhase = "foundation" | "interface" | "protocol" | "context" | "production";

type LocalizedText = Record<Locale, string>;

export interface AcademyLesson {
  id: string;
  order: number;
  phase: AcademyPhase;
  title: LocalizedText;
  summary: LocalizedText;
  outcomes: Record<Locale, string[]>;
  concepts: string[];
  artifact: LocalizedText;
  starterPrompt: LocalizedText;
  source: { label: string; url: string };
  href?: string;
}

export interface AcademyLessonView {
  id: string;
  order: number;
  phase: AcademyPhase;
  title: string;
  summary: string;
  outcomes: string[];
  artifact: string;
  starterPrompt: string;
  source: { label: string; url: string };
  href?: string;
}

export interface AcademyCourseView {
  lessons: AcademyLessonView[];
  phaseLabels: Record<AcademyPhase, string>;
}

export const phaseCopy: Record<AcademyPhase, LocalizedText> = {
  foundation: { en: "01 · Foundations", zh: "01 · 基础心智" },
  interface: { en: "02 · Interface", zh: "02 · 界面生成" },
  protocol: { en: "03 · Protocols", zh: "03 · 协议互联" },
  context: { en: "04 · Context", zh: "04 · 上下文工程" },
  production: { en: "05 · Production", zh: "05 · 生产落地" },
};

export const academyLessons: AcademyLesson[] = [
  {
    id: "mental-model",
    order: 1,
    phase: "foundation",
    title: { en: "Generative UI mental model", zh: "生成式 UI 心智模型" },
    summary: {
      en: "Separate model output, agent behavior, interaction events, UI descriptions, and trusted rendering.",
      zh: "先拆开模型输出、Agent 行为、交互事件、UI 描述与可信渲染，避免把不同层混成一种技术。",
    },
    outcomes: {
      en: ["Draw the five-layer runtime", "Know when plain markdown is enough", "Choose composition over framework rankings"],
      zh: ["画出五层运行时", "判断何时 Markdown 已足够", "用组合思维取代框架排名"],
    },
    concepts: ["generative ui", "llm", "agent", "renderer", "trust boundary"],
    artifact: { en: "A stack decision canvas", zh: "一张技术栈决策画布" },
    starterPrompt: { en: "Teach me the five-layer Generative UI mental model using this app as the example.", zh: "用这个应用自身为例，教我建立生成式 UI 的五层心智模型。" },
    source: { label: "AG-UI architecture", url: "https://docs.ag-ui.com/concepts/architecture" },
    href: "/map",
  },
  {
    id: "app-shell",
    order: 2,
    phase: "foundation",
    title: { en: "Next.js, shadcn/ui and Tailwind", zh: "Next.js、shadcn/ui 与 Tailwind" },
    summary: {
      en: "Build the smallest accessible chat shell with owned components, design tokens, and clear server/client boundaries.",
      zh: "用可控源码组件、设计令牌和清晰的服务端/客户端边界，搭建最小可访问对话外壳。",
    },
    outcomes: {
      en: ["Keep client islands small", "Compose accessible primitives", "Theme with tokens instead of ad-hoc colors"],
      zh: ["缩小客户端岛屿", "组合可访问基础组件", "用令牌而非零散颜色完成主题"],
    },
    concepts: ["next.js", "react", "shadcn", "tailwind", "server components"],
    artifact: { en: "The application shell you are using", zh: "你正在使用的应用外壳" },
    starterPrompt: { en: "Show how this chat shell is split between Server and Client Components.", zh: "解释这个对话外壳如何划分 Server Component 与 Client Component。" },
    source: { label: "shadcn/ui", url: "https://ui.shadcn.com/docs" },
  },
  {
    id: "streaming-chat",
    order: 3,
    phase: "foundation",
    title: { en: "Streaming chat and AI Elements", zh: "流式对话与 AI Elements" },
    summary: {
      en: "Render markdown, reasoning, tool state, and structured parts without exposing raw model output or JSON blobs.",
      zh: "正确渲染 Markdown、推理、工具状态和结构化消息，避免直接暴露模型原文或 JSON 块。",
    },
    outcomes: {
      en: ["Understand message parts", "Render streaming markdown safely", "Design submitted, streaming, error, and stopped states"],
      zh: ["理解消息 parts", "安全渲染流式 Markdown", "设计提交、流式、错误和停止状态"],
    },
    concepts: ["ai sdk", "ai elements", "streaming", "message parts", "sse"],
    artifact: { en: "The conversation stream and composer", zh: "当前的消息流与输入器" },
    starterPrompt: { en: "Trace one answer from model token to the MessageResponse component.", zh: "追踪一次回答如何从模型 token 到达 MessageResponse 组件。" },
    source: { label: "AI Elements", url: "https://ai-sdk.dev/elements" },
  },
  {
    id: "json-render",
    order: 4,
    phase: "interface",
    title: { en: "json-render and typed UI parts", zh: "json-render 与类型化 UI parts" },
    summary: {
      en: "Turn constrained structured output into application-owned cards, forms, charts, and artifacts.",
      zh: "把受约束的结构化输出转换为由应用掌控的卡片、表单、图表与工件。",
    },
    outcomes: {
      en: ["Define a component catalog", "Validate props before render", "Stream data parts without dumping JSON"],
      zh: ["定义组件目录", "渲染前校验 props", "流式传输数据部件而不倾倒 JSON"],
    },
    concepts: ["json-render", "json schema", "structured output", "component registry"],
    artifact: { en: "A typed lesson artifact card", zh: "一张类型安全的课程工件卡" },
    starterPrompt: { en: "Design a safe json-render catalog for this learning app.", zh: "为这个学习应用设计一个安全的 json-render 组件目录。" },
    source: { label: "Vercel json-render", url: "https://github.com/vercel-labs/json-render" },
    href: "/technologies/json-render",
  },
  {
    id: "openui",
    order: 5,
    phase: "interface",
    title: { en: "OpenUI streaming language", zh: "OpenUI 流式界面语言" },
    summary: {
      en: "Use a compact, line-oriented language when token efficiency and progressive rendering matter more than JSON portability.",
      zh: "当 token 效率和渐进渲染比 JSON 可移植性更重要时，使用紧凑的行式 UI 语言。",
    },
    outcomes: {
      en: ["Generate a library prompt", "Parse partial output", "Drop invalid components safely"],
      zh: ["生成组件库提示词", "解析不完整输出", "安全丢弃无效组件"],
    },
    concepts: ["openui", "openui lang", "streaming parser", "component library"],
    artifact: { en: "An OpenUI Lang response sketch", zh: "一份 OpenUI Lang 响应草图" },
    starterPrompt: { en: "Compare OpenUI Lang with JSON for a streamed dashboard response.", zh: "以流式仪表板为例，比较 OpenUI Lang 与 JSON。" },
    source: { label: "OpenUI", url: "https://www.openui.com/docs/openui-lang" },
    href: "/technologies/openui",
  },
  {
    id: "a2ui",
    order: 6,
    phase: "interface",
    title: { en: "A2UI across trust boundaries", zh: "跨信任边界的 A2UI" },
    summary: {
      en: "Let remote agents describe native UI with a declarative, renderer-owned component vocabulary.",
      zh: "让远程 Agent 用声明式组件词汇描述原生 UI，同时把最终渲染权留在客户端。",
    },
    outcomes: {
      en: ["Separate description from renderer", "Handle incremental updates", "Plan for preview-stage evolution"],
      zh: ["分离描述与渲染器", "处理增量更新", "为预览期规格演进留出空间"],
    },
    concepts: ["a2ui", "declarative ui", "native renderer", "trust boundary"],
    artifact: { en: "A portable UI message", zh: "一条可移植 UI 消息" },
    starterPrompt: { en: "When should this app choose A2UI instead of json-render or OpenUI?", zh: "这个应用何时应该选择 A2UI，而不是 json-render 或 OpenUI？" },
    source: { label: "Google A2UI", url: "https://github.com/google/A2UI" },
    href: "/technologies/a2ui",
  },
  {
    id: "ag-ui",
    order: 7,
    phase: "protocol",
    title: { en: "AG-UI event lifecycle", zh: "AG-UI 事件生命周期" },
    summary: {
      en: "Connect an agent to the interface with ordered lifecycle, message, tool, state, and custom events.",
      zh: "用有序的生命周期、消息、工具、状态和自定义事件，把 Agent 与界面连接起来。",
    },
    outcomes: {
      en: ["Implement start-content-end", "Synchronize snapshot and delta", "Recover from cancellation and run errors"],
      zh: ["实现 start-content-end", "同步 snapshot 与 delta", "处理取消与运行错误"],
    },
    concepts: ["ag-ui", "run started", "state snapshot", "state delta", "tool call"],
    artifact: { en: "The live event inspector in this app", zh: "本应用中的实时事件检查器" },
    starterPrompt: { en: "Explain the live AG-UI events produced by this conversation.", zh: "解释本次对话实时产生的 AG-UI 事件。" },
    source: { label: "AG-UI events", url: "https://docs.ag-ui.com/concepts/events" },
    href: "/technologies/ag-ui",
  },
  {
    id: "mcp",
    order: 8,
    phase: "protocol",
    title: { en: "MCP tools, resources and prompts", zh: "MCP 工具、资源与提示词" },
    summary: {
      en: "Expose actions, context, and reusable interaction templates through capability-negotiated JSON-RPC connections.",
      zh: "通过具备能力协商的 JSON-RPC 连接，暴露动作、上下文与可复用交互模板。",
    },
    outcomes: {
      en: ["Choose tools vs resources vs prompts", "Negotiate capabilities", "Require approval for side effects"],
      zh: ["区分工具、资源与提示词", "完成能力协商", "为副作用操作加入审批"],
    },
    concepts: ["mcp", "tools", "resources", "prompts", "streamable http"],
    artifact: { en: "An MCP surface contract", zh: "一份 MCP 表面契约" },
    starterPrompt: { en: "Design an MCP server that lets this tutor inspect its own curriculum safely.", zh: "设计一个让本导师安全检查自身课程的 MCP Server。" },
    source: { label: "MCP architecture", url: "https://modelcontextprotocol.io/docs/learn/architecture" },
  },
  {
    id: "mcp-ui",
    order: 9,
    phase: "protocol",
    title: { en: "MCP-UI embedded surfaces", zh: "MCP-UI 嵌入式界面" },
    summary: {
      en: "Return interactive resources from MCP tools while isolating remote content from the host application.",
      zh: "让 MCP 工具返回可交互资源，同时把远程内容与宿主应用隔离。",
    },
    outcomes: {
      en: ["Choose iframe, remote DOM, or native paths", "Define host-to-surface messages", "Apply sandbox and CSP boundaries"],
      zh: ["选择 iframe、remote DOM 或原生路径", "定义宿主与表面的消息", "应用 sandbox 与 CSP 边界"],
    },
    concepts: ["mcp-ui", "embedded ui", "iframe", "remote dom", "csp"],
    artifact: { en: "An isolated interactive resource", zh: "一个隔离的交互资源" },
    starterPrompt: { en: "Threat-model an MCP-UI artifact before embedding it in this app.", zh: "在嵌入本应用前，为一个 MCP-UI 工件做威胁建模。" },
    source: { label: "MCP-UI", url: "https://github.com/MCP-UI-Org/mcp-ui" },
    href: "/technologies/mcp-apps",
  },
  {
    id: "acp",
    order: 10,
    phase: "protocol",
    title: { en: "ACP for coding-agent clients", zh: "面向编码 Agent 的 ACP" },
    summary: {
      en: "Connect editors and coding agents through negotiated capabilities without confusing ACP with user-facing AG-UI.",
      zh: "通过能力协商连接编辑器和编码 Agent，同时避免把 ACP 与面向用户的 AG-UI 混为一谈。",
    },
    outcomes: {
      en: ["Locate ACP in the stack", "Negotiate protocol version", "Design an editor handoff"],
      zh: ["确定 ACP 的技术层级", "协商协议版本", "设计编辑器交接"],
    },
    concepts: ["acp", "agent client protocol", "coding agent", "editor"],
    artifact: { en: "A coding-agent handoff sequence", zh: "一条编码 Agent 交接序列" },
    starterPrompt: { en: "Compare ACP, AG-UI, MCP, and A2A by the endpoints they connect.", zh: "按连接端点比较 ACP、AG-UI、MCP 和 A2A。" },
    source: { label: "Agent Client Protocol", url: "https://agentclientprotocol.com" },
  },
  {
    id: "prompts",
    order: 11,
    phase: "context",
    title: { en: "Prompt contracts", zh: "提示词契约" },
    summary: {
      en: "Treat system prompts as versioned policy and rendering contracts, not a bag of clever phrases.",
      zh: "把系统提示词当作可版本化的策略与渲染契约，而不是一袋聪明话术。",
    },
    outcomes: {
      en: ["Separate invariant policy from retrieved context", "Define output and refusal contracts", "Evaluate prompt changes"],
      zh: ["分离不变策略与检索上下文", "定义输出和拒绝契约", "评估提示词变更"],
    },
    concepts: ["prompts", "system prompt", "few shot", "context engineering", "evals"],
    artifact: { en: "The tutor system prompt", zh: "本导师的系统提示词" },
    starterPrompt: { en: "Review the tutor prompt as a product contract and find its failure modes.", zh: "把导师提示词当作产品契约审阅，并找出失败模式。" },
    source: { label: "Prompt engineering", url: "https://platform.openai.com/docs/guides/prompt-engineering" },
  },
  {
    id: "skills",
    order: 12,
    phase: "context",
    title: { en: "Agent Skills and progressive disclosure", zh: "Agent Skills 与渐进披露" },
    summary: {
      en: "Package repeatable procedures, references, scripts, and assets so agents load only the context needed for a task.",
      zh: "把可重复流程、参考资料、脚本和资产打包，让 Agent 只加载当前任务需要的上下文。",
    },
    outcomes: {
      en: ["Write triggerable metadata", "Keep SKILL.md concise", "Validate and forward-test a skill"],
      zh: ["写出可触发的元数据", "保持 SKILL.md 精简", "校验并前向测试 Skill"],
    },
    concepts: ["skills", "skill.md", "progressive disclosure", "agentskills"],
    artifact: { en: "The bundled build-generative-ui skill", zh: "仓库内置的 build-generative-ui Skill" },
    starterPrompt: { en: "Walk me through the build-generative-ui skill included in this repository.", zh: "带我读懂仓库内置的 build-generative-ui Skill。" },
    source: { label: "Agent Skills specification", url: "https://agentskills.io/specification" },
  },
  {
    id: "rag",
    order: 13,
    phase: "context",
    title: { en: "RAG that stays small", zh: "保持轻量的 RAG" },
    summary: {
      en: "Start with reviewed static documents and deterministic retrieval; add embeddings only when evaluation proves the need.",
      zh: "先使用经过审阅的静态文档与确定性检索，只有评估证明需要时再加入向量嵌入。",
    },
    outcomes: {
      en: ["Chunk around decisions", "Show retrieval receipts", "Choose keyword, semantic, or hybrid search"],
      zh: ["围绕决策切块", "展示检索依据", "选择关键词、语义或混合检索"],
    },
    concepts: ["rag", "retrieval", "embeddings", "pgvector", "hybrid search"],
    artifact: { en: "The zero-database curriculum retriever", zh: "零数据库课程检索器" },
    starterPrompt: { en: "Explain why this MVP starts with lexical RAG and when Supabase pgvector becomes justified.", zh: "解释这个 MVP 为什么先用词法 RAG，以及何时才值得引入 Supabase pgvector。" },
    source: { label: "Supabase semantic search", url: "https://supabase.com/docs/guides/ai/semantic-search" },
  },
  {
    id: "agent-runtime",
    order: 14,
    phase: "context",
    title: { en: "Agent and LLM runtime", zh: "Agent 与 LLM 运行时" },
    summary: {
      en: "Add tools, state, stop conditions, approvals, and model routing only where they improve a measured user task.",
      zh: "只在能改善可度量用户任务时，才加入工具、状态、停止条件、审批和模型路由。",
    },
    outcomes: {
      en: ["Distinguish chat from an agent loop", "Bound tool iterations", "Route models by capability and cost"],
      zh: ["区分对话与 Agent 循环", "限制工具迭代次数", "按能力与成本路由模型"],
    },
    concepts: ["agent", "llm", "tool calling", "model routing", "human in the loop"],
    artifact: { en: "A bounded tutor agent loop", zh: "一个有边界的导师 Agent 循环" },
    starterPrompt: { en: "Show the smallest change that turns this chat into a bounded tool-using agent.", zh: "展示把本对话升级为有边界工具 Agent 所需的最小改动。" },
    source: { label: "AI SDK agents", url: "https://ai-sdk.dev/docs/ai-sdk-core/agents" },
  },
  {
    id: "byok-security",
    order: 15,
    phase: "production",
    title: { en: "BYOK and provider security", zh: "BYOK 与模型供应商安全" },
    summary: {
      en: "Keep the built-in trial key server-side, never persist user keys, and constrain custom provider endpoints against SSRF.",
      zh: "内置试用 Key 只留在服务端，用户 Key 不持久化，并限制自定义供应商端点以抵御 SSRF。",
    },
    outcomes: {
      en: ["Separate trial and BYOK paths", "Protect secrets and logs", "Rate-limit before enabling public trial"],
      zh: ["分离试用与 BYOK 路径", "保护密钥与日志", "开放试用前完成限流"],
    },
    concepts: ["byok", "api key", "deepseek", "ssrf", "rate limit", "secrets"],
    artifact: { en: "The model settings and provider policy", zh: "模型设置与供应商策略" },
    starterPrompt: { en: "Threat-model the free DeepSeek trial and BYOK flow in this app.", zh: "为本应用的 DeepSeek 免费试用与 BYOK 流程做威胁建模。" },
    source: { label: "DeepSeek API", url: "https://api-docs.deepseek.com" },
  },
  {
    id: "ship-and-evaluate",
    order: 16,
    phase: "production",
    title: { en: "Evaluate, observe, and ship", zh: "评估、观测与发布" },
    summary: {
      en: "Verify the complete story from prompt and event stream to rendered UI, security boundary, cost, and rollback.",
      zh: "从提示词、事件流到渲染 UI、安全边界、成本和回滚，验证完整产品故事。",
    },
    outcomes: {
      en: ["Build scenario-based evals", "Inspect event and retrieval traces", "Gate deployment with rollback evidence"],
      zh: ["建立场景化评估", "检查事件与检索轨迹", "用回滚证据把关发布"],
    },
    concepts: ["evals", "observability", "security", "deployment", "vercel", "cloudflare"],
    artifact: { en: "A release readiness scorecard", zh: "一张发布就绪评分卡" },
    starterPrompt: { en: "Create a release gate for this app covering UI, protocol, model, security, cost, and rollback.", zh: "为本应用制定覆盖 UI、协议、模型、安全、成本和回滚的发布门禁。" },
    source: { label: "AG-UI troubleshooting", url: "https://docs.ag-ui.com/troubleshooting" },
  },
];

export function getAcademyLesson(id: string | undefined): AcademyLesson | undefined {
  return academyLessons.find((lesson) => lesson.id === id);
}

export function lessonHref(locale: Locale, lesson: AcademyLesson): string | undefined {
  return lesson.href ? `/${locale}${lesson.href}` : undefined;
}

// Send only the requested language and rendered fields across the RSC boundary.
// The complete bilingual course, including retrieval concepts, stays on the server.
export function localizeAcademyCourse(locale: Locale): AcademyCourseView {
  return {
    lessons: academyLessons.map((lesson) => ({
      id: lesson.id,
      order: lesson.order,
      phase: lesson.phase,
      title: lesson.title[locale],
      summary: lesson.summary[locale],
      outcomes: [...lesson.outcomes[locale]],
      artifact: lesson.artifact[locale],
      starterPrompt: lesson.starterPrompt[locale],
      source: { ...lesson.source },
      ...(lesson.href ? { href: lessonHref(locale, lesson) } : {}),
    })),
    phaseLabels: Object.fromEntries(Object.entries(phaseCopy).map(([phase, label]) => [phase, label[locale]])) as Record<AcademyPhase, string>,
  };
}
