import { EventType, RunAgentInputSchema, type BaseEvent, type Message, type RunAgentInput } from "@ag-ui/core";
import { streamText, type ModelMessage } from "ai";
import { z } from "zod";
import { buildOfflineAnswer, buildTutorSystemPrompt } from "@/lib/academy/prompt";
import { providerSettingsSchema, resolveAcademyModel } from "@/lib/academy/provider";
import { retrieveAcademyKnowledge } from "@/lib/academy/retrieval";
import { isLocale } from "@/lib/i18n";

export const runtime = "edge";

const forwardedPropsSchema = z.object({
  locale: z.string().default("en"),
  lessonId: z.string().max(80).optional(),
  model: providerSettingsSchema.default({ provider: "trial" }),
});

function messageText(message: Message): string {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((part): part is { type: "text"; text: string } => typeof part === "object" && part !== null && part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function modelHistory(input: RunAgentInput): ModelMessage[] {
  return input.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-12)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: messageText(message),
    }))
    .filter((message) => message.content.trim().length > 0);
}

function chunkText(text: string, size = 92): string[] {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const end = Math.min(cursor + size, text.length);
    const whitespace = text.lastIndexOf(" ", end);
    const next = whitespace > cursor + size / 2 ? whitespace + 1 : end;
    chunks.push(text.slice(cursor, next));
    cursor = next;
  }
  return chunks;
}

function sanitizedErrorMessage(error: unknown, locale: "en" | "zh"): string {
  if (error instanceof Error && /custom provider|provider host|model id|required/i.test(error.message)) return error.message;
  return locale === "zh"
    ? "模型服务暂时不可用。你的 Key 未被保存；请检查模型设置，或切回离线导师。"
    : "The model provider is temporarily unavailable. Your key was not stored; check Model settings or return to the offline tutor.";
}

export async function POST(request: Request): Promise<Response> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 240_000) return Response.json({ error: "Request too large" }, { status: 413 });

  const body = await request.json().catch(() => null);
  const parsedInput = RunAgentInputSchema.safeParse(body);
  if (!parsedInput.success) return Response.json({ error: "Invalid AG-UI RunAgentInput" }, { status: 400 });
  const input = parsedInput.data;
  const props = forwardedPropsSchema.parse(input.forwardedProps ?? {});
  const locale = isLocale(props.locale) ? props.locale : "en";
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === "user");
  const query = latestUserMessage ? messageText(latestUserMessage) : "Generative UI";
  const retrieval = retrieveAcademyKnowledge(query, locale, props.lessonId);
  const encoder = new TextEncoder();
  const messageId = crypto.randomUUID();
  const retrievalCallId = crypto.randomUUID();
  const retrievalResultId = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let textStarted = false;
      const send = (event: BaseEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        const resolved = resolveAcademyModel(props.model);
        send({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId, timestamp: Date.now() });
        send({ type: EventType.STEP_STARTED, stepName: "retrieve-curriculum", timestamp: Date.now() });
        send({ type: EventType.TOOL_CALL_START, toolCallId: retrievalCallId, toolCallName: "retrieve_academy_knowledge", timestamp: Date.now() });
        send({ type: EventType.TOOL_CALL_ARGS, toolCallId: retrievalCallId, delta: JSON.stringify({ query, lessonId: retrieval.lesson.id, locale }), timestamp: Date.now() });
        send({ type: EventType.TOOL_CALL_END, toolCallId: retrievalCallId, timestamp: Date.now() });
        send({
          type: EventType.TOOL_CALL_RESULT,
          messageId: retrievalResultId,
          toolCallId: retrievalCallId,
          role: "tool",
          content: JSON.stringify({ hits: retrieval.hits.map(({ title, href, score }) => ({ title, href, score })) }),
          timestamp: Date.now(),
        });
        send({ type: EventType.STEP_FINISHED, stepName: "retrieve-curriculum", timestamp: Date.now() });
        send({
          type: EventType.STATE_SNAPSHOT,
          snapshot: {
            lessonId: retrieval.lesson.id,
            phase: retrieval.lesson.phase,
            progress: Math.round((retrieval.lesson.order / 16) * 100),
            provider: { mode: resolved.mode, label: resolved.providerLabel, model: resolved.modelId },
            sources: retrieval.hits.map(({ title, href }) => ({ title, href })),
          },
          timestamp: Date.now(),
        });
        send({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant", timestamp: Date.now() });
        textStarted = true;

        if (!resolved.model) {
          for (const delta of chunkText(buildOfflineAnswer(retrieval, locale))) {
            send({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta, timestamp: Date.now() });
          }
        } else {
          const result = streamText({
            model: resolved.model,
            system: buildTutorSystemPrompt(retrieval, locale),
            messages: modelHistory(input),
            maxOutputTokens: 1800,
            temperature: 0.25,
            abortSignal: request.signal,
          });
          for await (const delta of result.textStream) {
            send({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta, timestamp: Date.now() });
          }
        }

        send({ type: EventType.TEXT_MESSAGE_END, messageId, timestamp: Date.now() });
        send({
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
          outcome: { type: "success" },
          result: { lessonId: retrieval.lesson.id },
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = sanitizedErrorMessage(error, locale);
        if (!textStarted) send({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant", timestamp: Date.now() });
        send({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: `\n\n> ${message}`, timestamp: Date.now() });
        send({ type: EventType.TEXT_MESSAGE_END, messageId, timestamp: Date.now() });
        send({ type: EventType.RUN_ERROR, message, code: "MODEL_UNAVAILABLE", timestamp: Date.now() });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-store, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
