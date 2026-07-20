export type LabEventType =
  | "RUN_STARTED"
  | "STATE_SNAPSHOT"
  | "TEXT_MESSAGE_START"
  | "TEXT_MESSAGE_CONTENT"
  | "TEXT_MESSAGE_END"
  | "TOOL_CALL_START"
  | "TOOL_CALL_ARGS"
  | "TOOL_CALL_END"
  | "STATE_DELTA"
  | "USER_ACTION"
  | "RUN_ERROR"
  | "RUN_FINISHED";

export interface LabEvent {
  type: LabEventType;
  payload: Record<string, unknown>;
}

export interface LabState {
  status: "idle" | "running" | "waiting" | "error" | "finished";
  message: string;
  tool: string | null;
  progress: number;
  events: LabEvent[];
}

export const initialLabState: LabState = { status: "idle", message: "", tool: null, progress: 0, events: [] };

export const successFixture: LabEvent[] = [
  { type: "RUN_STARTED", payload: { runId: "run_atlas_01" } },
  { type: "STATE_SNAPSHOT", payload: { task: "Compare declarative UI options", progress: 0 } },
  { type: "TEXT_MESSAGE_START", payload: { messageId: "msg_01", role: "assistant" } },
  { type: "TEXT_MESSAGE_CONTENT", payload: { delta: "I’ll map the requirements to the right UI layer. " } },
  { type: "TEXT_MESSAGE_CONTENT", payload: { delta: "First, I’m checking portability and control." } },
  { type: "TEXT_MESSAGE_END", payload: { messageId: "msg_01" } },
  { type: "TOOL_CALL_START", payload: { toolCallId: "tool_01", tool: "compare_technologies" } },
  { type: "TOOL_CALL_ARGS", payload: { surface: "cross-platform", control: "balanced" } },
  { type: "TOOL_CALL_END", payload: { result: ["A2UI", "AG-UI"] } },
  { type: "STATE_DELTA", payload: { progress: 80, recommendation: "A2UI over AG-UI" } },
];

export const failureFixture: LabEvent[] = [
  { type: "RUN_STARTED", payload: { runId: "run_atlas_error" } },
  { type: "STATE_SNAPSHOT", payload: { task: "Render remote surface", progress: 0 } },
  { type: "TEXT_MESSAGE_START", payload: { messageId: "msg_error", role: "assistant" } },
  { type: "TEXT_MESSAGE_CONTENT", payload: { delta: "The renderer rejected an unknown component." } },
  { type: "TEXT_MESSAGE_END", payload: { messageId: "msg_error" } },
  { type: "RUN_ERROR", payload: { code: "UNKNOWN_COMPONENT", retryable: true } },
];

export function reduceLabEvent(state: LabState, event: LabEvent): LabState {
  const next = { ...state, events: [...state.events, event] };
  switch (event.type) {
    case "RUN_STARTED": return { ...next, status: "running", progress: 5 };
    case "TEXT_MESSAGE_CONTENT": return { ...next, message: `${state.message}${String(event.payload.delta ?? "")}` };
    case "TOOL_CALL_START": return { ...next, tool: String(event.payload.tool ?? "tool"), progress: 55 };
    case "TOOL_CALL_END": return { ...next, tool: null, status: "waiting", progress: 70 };
    case "STATE_DELTA": return { ...next, progress: Number(event.payload.progress ?? state.progress) };
    case "USER_ACTION": return { ...next, status: "running", progress: 90 };
    case "RUN_ERROR": return { ...next, status: "error" };
    case "RUN_FINISHED": return { ...next, status: "finished", progress: 100 };
    default: return next;
  }
}
