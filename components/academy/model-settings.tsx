"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Locale } from "@/lib/types";

export type ModelProvider = "trial" | "deepseek" | "openai" | "openrouter" | "siliconflow" | "custom";

export interface ModelSettingsValue {
  provider: ModelProvider;
  apiKey: string;
  baseURL: string;
  model: string;
}

export const modelDefaults: Record<ModelProvider, string> = {
  trial: "deepseek-v4-flash",
  deepseek: "deepseek-v4-flash",
  openai: "gpt-5.4-mini",
  openrouter: "deepseek/deepseek-v4",
  siliconflow: "deepseek-ai/DeepSeek-V3.2",
  custom: "",
};

const copy = {
  en: {
    button: "Model settings",
    title: "Choose how the tutor runs",
    description: "Trial uses the deployment key when enabled. BYOK keys stay in memory for this tab and are sent only with your request.",
    provider: "Provider",
    model: "Model ID",
    key: "API key",
    base: "OpenAI-compatible base URL",
    save: "Use this model",
    note: "Custom hosts must be allowlisted by the deployment owner. Keys are never written to localStorage or the knowledge base.",
  },
  zh: {
    button: "模型设置",
    title: "选择导师的运行方式",
    description: "试用模式在启用后使用部署端 Key。BYOK Key 仅保留在当前标签页内存中，只随你的请求发送。",
    provider: "供应商",
    model: "模型 ID",
    key: "API Key",
    base: "OpenAI 兼容 Base URL",
    save: "使用此模型",
    note: "自定义域名必须由部署者加入白名单。Key 不会写入 localStorage 或知识库。",
  },
} as const;

export function ModelSettings({ locale, value, onChange }: { locale: Locale; value: ModelSettingsValue; onChange: (value: ModelSettingsValue) => void }) {
  const t = copy[locale];
  const needsKey = value.provider !== "trial";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button aria-label={t.button} className="academy-icon-button" size="sm" variant="ghost"><KeyRound className="size-4" /><span>{t.button}</span></Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          <div className="grid gap-2">
            <Label htmlFor="academy-provider">{t.provider}</Label>
            <Select value={value.provider} onValueChange={(provider: ModelProvider) => onChange({ ...value, provider, model: modelDefaults[provider], baseURL: provider === "custom" ? value.baseURL : "" })}>
              <SelectTrigger id="academy-provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">DeepSeek · {locale === "zh" ? "免费试用 / 离线回退" : "trial / offline fallback"}</SelectItem>
                <SelectItem value="deepseek">DeepSeek BYOK</SelectItem>
                <SelectItem value="openai">OpenAI BYOK</SelectItem>
                <SelectItem value="openrouter">OpenRouter BYOK</SelectItem>
                <SelectItem value="siliconflow">SiliconFlow BYOK</SelectItem>
                <SelectItem value="custom">OpenAI-compatible · {locale === "zh" ? "自定义" : "custom"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="academy-model">{t.model}</Label>
            <Input id="academy-model" value={value.model} onChange={(event) => onChange({ ...value, model: event.target.value })} autoComplete="off" />
          </div>
          {value.provider === "custom" && <div className="grid gap-2">
            <Label htmlFor="academy-base-url">{t.base}</Label>
            <Input id="academy-base-url" value={value.baseURL} onChange={(event) => onChange({ ...value, baseURL: event.target.value })} placeholder="https://api.example.com/v1" inputMode="url" autoComplete="off" />
          </div>}
          {needsKey && <div className="grid gap-2">
            <Label htmlFor="academy-api-key">{t.key}</Label>
            <Input id="academy-api-key" value={value.apiKey} onChange={(event) => onChange({ ...value, apiKey: event.target.value })} type="password" placeholder="••••••••••••" autoComplete="off" spellCheck={false} />
          </div>}
          <div className="flex gap-3 rounded-lg border border-border bg-muted/35 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" /><p className="m-0">{t.note}</p>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button>{t.save}</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
