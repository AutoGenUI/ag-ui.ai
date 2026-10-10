import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { z } from "zod";

export const providerSettingsSchema = z.object({
  provider: z.enum(["trial", "deepseek", "openai", "openrouter", "siliconflow", "custom"]).default("trial"),
  apiKey: z.string().trim().max(512).optional(),
  baseURL: z.string().trim().max(500).optional(),
  model: z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._:/+-]+$/).optional(),
});

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;

interface ProviderPreset {
  name: string;
  baseURL: string;
  defaultModel: string;
}

const presets: Record<Exclude<ProviderSettings["provider"], "trial" | "custom">, ProviderPreset> = {
  deepseek: { name: "deepseek", baseURL: "https://api.deepseek.com", defaultModel: "deepseek-v4-flash" },
  openai: { name: "openai", baseURL: "https://api.openai.com/v1", defaultModel: "gpt-5.4-mini" },
  openrouter: { name: "openrouter", baseURL: "https://openrouter.ai/api/v1", defaultModel: "deepseek/deepseek-v4" },
  siliconflow: { name: "siliconflow", baseURL: "https://api.siliconflow.cn/v1", defaultModel: "deepseek-ai/DeepSeek-V3.2" },
};

export interface ResolvedAcademyModel {
  model: LanguageModel | null;
  mode: "offline" | "trial" | "byok";
  providerLabel: string;
  modelId: string;
}

function allowedCustomBaseURL(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.port) {
    throw new Error("Custom providers must use a clean HTTPS base URL on port 443.");
  }
  const host = url.hostname.toLowerCase();
  const blocked = host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1" || /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (blocked) throw new Error("Private and local provider hosts are not allowed.");
  const allowlist = (process.env.CUSTOM_PROVIDER_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowlist.includes(host)) {
    throw new Error("This custom provider host is not enabled by the deployment owner.");
  }
  return url.toString().replace(/\/$/, "");
}

export function resolveAcademyModel(settings: ProviderSettings): ResolvedAcademyModel {
  if (settings.provider === "trial") {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    const modelId = settings.model || presets.deepseek.defaultModel;
    if (!apiKey || process.env.TRIAL_ENABLED !== "true") {
      return { model: null, mode: "offline", providerLabel: "Offline tutor", modelId };
    }
    const provider = createOpenAICompatible({ name: "academyDeepSeekTrial", apiKey, baseURL: presets.deepseek.baseURL, includeUsage: true });
    return { model: provider(modelId), mode: "trial", providerLabel: "DeepSeek trial", modelId };
  }

  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    return { model: null, mode: "offline", providerLabel: "Offline tutor", modelId: settings.model || "offline" };
  }

  if (settings.provider === "custom") {
    const baseURL = allowedCustomBaseURL(settings.baseURL ?? "");
    const modelId = settings.model ?? "";
    if (!modelId) throw new Error("A model ID is required for a custom provider.");
    const provider = createOpenAICompatible({ name: "academyCustom", apiKey, baseURL, includeUsage: true });
    return { model: provider(modelId), mode: "byok", providerLabel: new URL(baseURL).hostname, modelId };
  }

  const preset = presets[settings.provider];
  const modelId = settings.model || preset.defaultModel;
  const provider = createOpenAICompatible({ name: `academy${preset.name}`, apiKey, baseURL: preset.baseURL, includeUsage: true });
  return { model: provider(modelId), mode: "byok", providerLabel: preset.name, modelId };
}

export const providerDefaults = {
  trial: presets.deepseek.defaultModel,
  deepseek: presets.deepseek.defaultModel,
  openai: presets.openai.defaultModel,
  openrouter: presets.openrouter.defaultModel,
  siliconflow: presets.siliconflow.defaultModel,
  custom: "",
} as const;
