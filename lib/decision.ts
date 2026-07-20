import type { Locale } from "@/lib/types";

export type DecisionSurface = "own-app" | "chat-host" | "cross-platform";
export type DecisionControl = "strict" | "balanced" | "open";

export interface DecisionInput {
  surface: DecisionSurface;
  control: DecisionControl;
  streaming: boolean;
  hasCatalog: boolean;
}

export interface StackRecommendation {
  id: string;
  technologies: string[];
  rationale: string;
  caveat: string;
}

const copy = {
  en: {
    chat: ["Use an embedded app surface", "MCP Apps fits hosts that can render sandboxed interactive resources. Confirm host support and keep privileged actions behind tools."],
    cross: ["Keep the UI portable", "A2UI describes intent as declarative data while AG-UI can carry it between the agent and user-facing client. A2UI remains a public preview, so isolate version changes."],
    strict: ["Preserve product control", "AG-UI plus predefined frontend tool rendering keeps layout and actions in application code. You trade open-ended composition for predictable UX."],
    catalog: ["Generate inside a trusted catalog", "json-render constrains output to registered components and AG-UI supplies the interaction stream. Catalog design and validation remain your responsibility."],
    openui: ["Optimize for streaming composition", "OpenUI Lang and its React runtime provide a compact streaming-first authoring path; AG-UI can remain the backend interaction layer. This is a framework choice, not a transport replacement."],
    alt: ["Alternative", "If interoperability matters more than framework ergonomics, evaluate A2UI; if the UI must live inside an AI host, evaluate MCP Apps."],
  },
  zh: {
    chat: ["使用宿主内嵌应用", "MCP Apps 适合能够渲染沙箱交互资源的对话宿主。需要先确认宿主兼容性，并让高权限操作继续经过工具调用。"],
    cross: ["保持跨端可移植", "A2UI 用声明式数据表达界面意图，AG-UI 可承载 Agent 与用户端之间的交互。A2UI 仍处于公开预览阶段，应隔离版本变化。"],
    strict: ["保持产品级控制", "AG-UI 配合预定义前端工具渲染，让布局与动作留在应用代码中；代价是降低开放式组合能力。"],
    catalog: ["在可信组件目录内生成", "json-render 将输出约束到注册组件，AG-UI 提供交互事件流；组件目录设计和校验仍由应用负责。"],
    openui: ["优先流式组合效率", "OpenUI Lang 与 React Runtime 提供紧凑的流式生成路径，AG-UI 仍可作为后端交互层；这是框架选择，不是传输协议替代品。"],
    alt: ["备选路径", "若更看重跨实现互操作，可评估 A2UI；若界面必须运行在 AI 对话宿主内，则评估 MCP Apps。"],
  },
} as const;

export function recommendStack(input: DecisionInput, locale: Locale): StackRecommendation[] {
  const localeCopy = copy[locale];
  let primary: StackRecommendation;

  if (input.surface === "chat-host") {
    primary = { id: "mcp-apps", technologies: ["mcp-apps"], rationale: localeCopy.chat[0], caveat: localeCopy.chat[1] };
  } else if (input.surface === "cross-platform") {
    primary = { id: "a2ui-agui", technologies: ["a2ui", "ag-ui"], rationale: localeCopy.cross[0], caveat: localeCopy.cross[1] };
  } else if (input.control === "strict") {
    primary = { id: "controlled-agui", technologies: ["ag-ui", "copilotkit"], rationale: localeCopy.strict[0], caveat: localeCopy.strict[1] };
  } else if (input.hasCatalog || input.control === "balanced") {
    primary = { id: "catalog", technologies: ["json-render", "ag-ui"], rationale: localeCopy.catalog[0], caveat: localeCopy.catalog[1] };
  } else {
    primary = { id: "openui", technologies: ["openui", "ag-ui"], rationale: localeCopy.openui[0], caveat: localeCopy.openui[1] };
  }

  const alternatives = input.streaming
    ? primary.technologies.includes("openui")
      ? ["json-render", "ag-ui"]
      : ["openui", "ag-ui"]
    : ["a2ui", "ag-ui"];

  return [
    primary,
    { id: `${primary.id}-alternative`, technologies: alternatives, rationale: localeCopy.alt[0], caveat: localeCopy.alt[1] },
  ];
}
