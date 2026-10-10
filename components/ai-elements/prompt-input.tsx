"use client";

import type { ChatStatus } from "ai";
import { ArrowUpIcon, LoaderCircleIcon, SquareIcon } from "lucide-react";
import type { ComponentProps, FormEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PromptInputMessage {
  text: string;
}

export type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function PromptInput({ children, className, onSubmit, ...props }: PromptInputProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("message") ?? "");
    await onSubmit({ text }, event);
  };

  return <form className={cn("overflow-hidden border", className)} onSubmit={handleSubmit} {...props}>{children}</form>;
}

export function PromptInputBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-w-0", className)} {...props} />;
}

export function PromptInputFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center justify-between gap-2 px-3 pb-2", className)} {...props} />;
}

export function PromptInputTools({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 items-center gap-1", className)} {...props} />;
}

export function PromptInputTextarea({ className, onKeyDown, ...props }: ComponentProps<"textarea">) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (!event.defaultPrevented && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return <textarea className={cn("w-full resize-none bg-transparent px-4 py-3 outline-none", className)} name="message" onKeyDown={handleKeyDown} rows={2} {...props} />;
}

export type PromptInputSubmitProps = Omit<ComponentProps<typeof Button>, "type"> & {
  onStop?: () => void;
  status?: ChatStatus;
};

export function PromptInputSubmit({ children, disabled, onClick, onStop, status = "ready", ...props }: PromptInputSubmitProps) {
  const running = status === "submitted" || status === "streaming";
  return (
    <Button
      aria-label={running ? "Stop generation" : "Send message"}
      disabled={running ? false : disabled}
      onClick={running ? onStop : onClick}
      size="icon"
      type={running ? "button" : "submit"}
      {...props}
    >
      {children ?? (status === "submitted" ? <LoaderCircleIcon className="animate-spin" /> : running ? <SquareIcon /> : <ArrowUpIcon />)}
    </Button>
  );
}
