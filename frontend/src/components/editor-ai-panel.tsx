import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiMagicIcon,
  Cancel01Icon,
  SentIcon,
  SparklesIcon,
  ToolsIcon,
} from "@hugeicons/core-free-icons";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { usePostHog } from "posthog-js/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  TamboProvider,
  useTambo,
  useTamboThreadInput,
  type ReactTamboThreadMessage,
  type TamboTool,
} from "@tambo-ai/react";
import {
  editorSidebarPanelLeftClass,
  editorSidebarPanelTopClass,
} from "../lib/editor-sidebar-panel-layout";
import type { AiDesignController } from "../lib/avnac-ai-controller";
import { buildAvnacTamboTools } from "../lib/avnac-ai-tambo-tools";
import { pickMagicQuickPrompts } from "../lib/avnac-magic-quick-prompts";

type Props = {
  open: boolean;
  onClose: () => void;
  controller: AiDesignController;
};

const USER_KEY_STORAGE = "avnac-ai-user-key";

function getStableUserKey(): string {
  if (typeof window === "undefined") return "anonymous";
  try {
    const existing = window.localStorage.getItem(USER_KEY_STORAGE);
    if (existing && existing.length > 0) return existing;
    const fresh =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `u-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    window.localStorage.setItem(USER_KEY_STORAGE, fresh);
    return fresh;
  } catch {
    return "anonymous";
  }
}

export default function EditorAiPanel({ open, onClose, controller }: Props) {
  const controllerRef = useRef<AiDesignController | null>(controller);
  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  const apiKey = import.meta.env.VITE_TAMBO_API_KEY as string | undefined;
  const userKey = useMemo(() => getStableUserKey(), []);
  const tools = useMemo<TamboTool[]>(
    () => buildAvnacTamboTools(controllerRef),
    [],
  );
  const [magicQuickPrompts] = useState(() => pickMagicQuickPrompts());

  if (!open) return null;

  return (
    <div
      data-avnac-chrome
      className={[
        "pointer-events-auto fixed z-40 flex w-[min(100vw-1.5rem,400px)] flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white/95 backdrop-blur-md",
        "bottom-3",
        editorSidebarPanelLeftClass,
        editorSidebarPanelTopClass,
      ].join(" ")}
      role="dialog"
      aria-label="Magic"
    >
      <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={AiMagicIcon}
            size={16}
            strokeWidth={1.9}
            className="avnac-ai-accent"
          />
          <span className="avnac-ai-gradient-text text-sm font-semibold">
            Magic
          </span>
          <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            beta
          </span>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-black/[0.06]"
          onClick={onClose}
          aria-label="Close magic"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.75} />
        </button>
      </div>

      {apiKey ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <TamboProvider apiKey={apiKey} userKey={userKey} tools={tools}>
            <MagicChat quickPrompts={magicQuickPrompts} />
          </TamboProvider>
        </div>
      ) : (
        <MissingKeyPlaceholder />
      )}
    </div>
  );
}

function MissingKeyPlaceholder() {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 text-sm text-neutral-700">
      <p>
        Magic uses{" "}
        <a
          className="font-medium underline decoration-dotted underline-offset-2"
          href="https://tambo.co"
          target="_blank"
          rel="noreferrer"
        >
          Tambo
        </a>{" "}
        to turn natural-language prompts into real edits on your artboard.
      </p>
      <p>To enable it, add a Tambo API key to your frontend env:</p>
      <pre className="rounded-xl border border-black/[0.08] bg-[var(--surface-subtle)] p-3 text-[12px] text-neutral-800">
        <code>VITE_TAMBO_API_KEY=your-key-here</code>
      </pre>
      <p className="text-[12px] text-neutral-500">
        Get a free key at{" "}
        <a
          className="underline decoration-dotted underline-offset-2"
          href="https://tambo.co"
          target="_blank"
          rel="noreferrer"
        >
          tambo.co
        </a>
        , then restart the dev server.
      </p>
    </div>
  );
}

type AnyContentItem = { type?: string; text?: string; name?: string } & Record<
  string,
  unknown
>;

type MessageLike = {
  id: string;
  role?: string;
  content: readonly unknown[];
};

function orderAssistantContentBlocks(content: readonly unknown[]): unknown[] {
  const toolUse: unknown[] = [];
  const toolResult: unknown[] = [];
  const mid: unknown[] = [];
  const text: unknown[] = [];
  for (const c of content) {
    const typ = (c as AnyContentItem).type;
    if (typ === "tool_use") toolUse.push(c);
    else if (typ === "tool_result") toolResult.push(c);
    else if (typ === "text") text.push(c);
    else mid.push(c);
  }
  return [...toolUse, ...toolResult, ...mid, ...text];
}

function isToolResultOnlyUserMessage(m: ReactTamboThreadMessage): boolean {
  if (m.role !== "user" || m.content.length === 0) return false;
  return m.content.every((c) => c.type === "tool_result");
}

function groupMessagesForDisplay(
  messages: ReactTamboThreadMessage[],
): MessageLike[] {
  const out: MessageLike[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i]!;
    if (m.role === "system") {
      out.push({
        id: m.id,
        role: m.role,
        content: m.content as readonly unknown[],
      });
      i++;
      continue;
    }
    if (m.role === "user" && !isToolResultOnlyUserMessage(m)) {
      out.push({
        id: m.id,
        role: m.role,
        content: m.content as readonly unknown[],
      });
      i++;
      continue;
    }
    const run: ReactTamboThreadMessage[] = [];
    while (i < messages.length) {
      const cur = messages[i]!;
      if (cur.role === "assistant") {
        run.push(cur);
        i++;
        continue;
      }
      if (isToolResultOnlyUserMessage(cur)) {
        run.push(cur);
        i++;
        continue;
      }
      break;
    }
    if (run.length === 0) {
      i++;
      continue;
    }
    const merged = run.flatMap((x) => x.content as unknown[]);
    out.push({
      id: run.map((x) => x.id).join("\u0001"),
      role: "assistant",
      content: orderAssistantContentBlocks(merged),
    });
  }
  return out;
}

function MagicChat({ quickPrompts }: { quickPrompts: string[] }) {
  const { messages, isStreaming, isWaiting } = useTambo();
  const { value, setValue, submit, isPending } = useTamboThreadInput();
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const posthog = usePostHog();

  const displayMessages = useMemo(
    () => groupMessagesForDisplay(messages),
    [messages],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [displayMessages, isStreaming, isWaiting]);

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!value.trim() || isPending || isStreaming) return;
    setError(null);
    posthog.capture("ai_prompt_submitted", {
      prompt_length: value.trim().length,
    });
    try {
      await submit();
    } catch (err) {
      posthog.captureException(err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSubmit();
    }
  };

  const showEmpty = messages.length === 0 && !isWaiting && !isStreaming;
  const busy = isPending || isStreaming || isWaiting;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        aria-live="polite"
      >
        {showEmpty ? (
          <EmptyState
            prompts={quickPrompts}
            onPick={(p) => {
              setValue(p);
            }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {displayMessages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {(isWaiting || isStreaming) && <ThinkingBubble />}
          </div>
        )}
      </div>

      {error ? (
        <div className="border-t border-red-500/20 bg-red-500/5 px-3 py-1.5 text-[12px] text-red-600">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="mt-auto flex shrink-0 flex-col gap-2 border-t border-black/[0.06] px-3 pt-2 pb-1.5"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe a design, change, or layout…"
          rows={2}
          className="w-full resize-none rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#8B3DFF]/25"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            Enter to send · Shift+Enter for newline
          </span>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="avnac-ai-tile flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <HugeiconsIcon
              icon={busy ? SparklesIcon : SentIcon}
              size={14}
              strokeWidth={2}
              className="avnac-ai-accent"
            />
            <span className="avnac-ai-accent">
              {busy ? "Working…" : "Generate"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

function EmptyState({
  prompts,
  onPick,
}: {
  prompts: string[];
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-dashed border-black/[0.1] bg-[var(--surface-subtle)] px-4 py-4">
        <div className="flex items-start gap-2">
          <HugeiconsIcon
            icon={SparklesIcon}
            size={16}
            strokeWidth={1.9}
            className="avnac-ai-accent mt-0.5"
          />
          <div>
            <div className="avnac-ai-gradient-text text-sm font-semibold">
              Design with prompts
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-neutral-600">
              Describe a full layout, a single element, or an edit — Magic will
              place, resize, and style objects directly on your artboard.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Try one
        </div>
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="flex items-start gap-2 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-left text-[12.5px] text-neutral-700 transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <HugeiconsIcon
              icon={SparklesIcon}
              size={14}
              strokeWidth={1.9}
              className="avnac-ai-accent mt-0.5 flex-shrink-0"
            />
            <span>{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-center gap-2 self-start rounded-2xl border border-black/[0.06] bg-[var(--surface-subtle)] px-3 py-2">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B3DFF] [animation-delay:-0.25s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B3DFF] [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B3DFF]" />
      </div>
      <span className="text-[11.5px] text-neutral-500">Thinking…</span>
    </div>
  );
}

function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="avnac-chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a
              {...rest}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline decoration-dotted underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...rest }) => {
            const inline = !className;
            if (inline) {
              return (
                <code
                  {...rest}
                  className="rounded-md bg-black/[0.06] px-1 py-0.5 text-[0.92em]"
                >
                  {children}
                </code>
              );
            }
            return (
              <code {...rest} className={className}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-xl border border-black/[0.08] bg-[var(--surface-subtle)] p-2.5 text-[12px] leading-relaxed">
              {children}
            </pre>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageLike }) {
  const isUser = message.role === "user";
  const rawItems = message.content as readonly AnyContentItem[];
  const items = (
    isUser ? rawItems : orderAssistantContentBlocks([...rawItems])
  ) as readonly AnyContentItem[];
  const textParts = items.filter(
    (c): c is AnyContentItem & { type: "text"; text: string } =>
      c.type === "text" && typeof c.text === "string" && c.text.length > 0,
  );
  const toolCalls = items.filter((c) => c.type === "tool_use");
  const toolResults = items.filter((c) => c.type === "tool_result");

  const text = textParts.map((t) => t.text).join("\n\n");

  const toolCount = toolCalls.length;
  const toolResultCount = toolResults.length;
  const toolNames = Array.from(
    new Set(
      toolCalls
        .map((c) =>
          typeof (c as { name?: unknown }).name === "string"
            ? ((c as { name: string }).name as string)
            : null,
        )
        .filter((n): n is string => Boolean(n)),
    ),
  );

  const showToolActivity = toolCount > 0 || toolResultCount > 0;
  if (!text && !showToolActivity) return null;

  const toolLabel =
    toolCount === 1
      ? `Ran ${toolNames[0] ?? "a tool"}`
      : toolCount > 1
        ? `Ran ${toolCount} tools${
            toolNames.length > 0 ? ` · ${toolNames.slice(0, 3).join(", ")}` : ""
          }`
        : toolResultCount > 0
          ? `Ran ${toolResultCount} tool step${toolResultCount === 1 ? "" : "s"}`
          : "";

  return (
    <div
      className={[
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start",
      ].join(" ")}
    >
      {showToolActivity ? (
        <div className="flex max-w-[85%] items-center gap-1.5 rounded-full border border-black/[0.06] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10.5px] text-neutral-600">
          <HugeiconsIcon
            icon={ToolsIcon}
            size={11}
            strokeWidth={2}
            className="avnac-ai-accent"
          />
          <span>{toolLabel}</span>
        </div>
      ) : null}
      {text ? (
        <div
          className={[
            "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug",
            isUser
              ? "whitespace-pre-wrap bg-[#8B3DFF] text-white"
              : "border border-black/[0.06] bg-white text-neutral-800",
          ].join(" ")}
        >
          {isUser ? text : <ChatMarkdown text={text} />}
        </div>
      ) : null}
    </div>
  );
}
