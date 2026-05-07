import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import clsx from "clsx";
import type { ChatMessageType } from "../types";

type ChatMessageProps = {
  message: ChatMessageType;
  onFollowUpClick?: (text: string) => void;
  onRate?: (messageId: string, value: "thumbs_up" | "thumbs_down") => void;
};

function formatTime(timestamp: Date) {
  return timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AssistantAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-soft">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <path
          d="M21 11.5c0 4.142-4.03 7.5-9 7.5a11 11 0 0 1-3.06-.424L4 20l1.22-3.66A7.06 7.06 0 0 1 3 11.5C3 7.358 7.03 4 12 4s9 3.358 9 7.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ThumbIcon({ up, filled }: { up: boolean; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx("h-3.5 w-3.5", up ? "" : "rotate-180")} fill={filled ? "currentColor" : "none"} aria-hidden>
      <path
        d="M7 11V20h2.5l5-1c1.2-.24 2-1.3 2-2.5v-3.2c0-.9-.7-1.6-1.6-1.6H11l.8-3.5a1.6 1.6 0 0 0-3.1-.8L7 11Zm-3 0h3v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatMessage({ message, onFollowUpClick, onRate }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={clsx(
        "flex w-full animate-fade-up gap-2",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && <AssistantAvatar />}
      <div className={clsx("flex max-w-[82%] flex-col", isUser ? "items-end" : "items-start")}>
        <div
          className={clsx(
            "rounded-2xl px-4 py-2.5 shadow-soft",
            isUser
              ? "rounded-br-md bg-brand-gradient text-white"
              : "rounded-bl-md border border-slate-200/70 bg-white text-brand-ink",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose-sm text-sm leading-relaxed [&_strong]:font-semibold">
              <Markdown rehypePlugins={[rehypeSanitize]}>
                {message.content}
              </Markdown>
            </div>
          )}
        </div>
        <div
          className={clsx(
            "mt-1 flex items-center gap-2 text-[10.5px]",
            isUser ? "flex-row-reverse text-slate-400" : "text-slate-400",
          )}
        >
          <span>{formatTime(message.timestamp)}</span>
          {!isUser && message.messageId && onRate && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onRate(message.messageId!, "thumbs_up")}
                className={clsx(
                  "rounded-full p-1 transition",
                  message.rating === "thumbs_up"
                    ? "bg-emerald-100 text-emerald-600"
                    : "text-slate-300 hover:bg-slate-100 hover:text-slate-600",
                )}
                disabled={!!message.rating}
                aria-label="Thumbs up"
              >
                <ThumbIcon up filled={message.rating === "thumbs_up"} />
              </button>
              <button
                type="button"
                onClick={() => onRate(message.messageId!, "thumbs_down")}
                className={clsx(
                  "rounded-full p-1 transition",
                  message.rating === "thumbs_down"
                    ? "bg-rose-100 text-rose-600"
                    : "text-slate-300 hover:bg-slate-100 hover:text-slate-600",
                )}
                disabled={!!message.rating}
                aria-label="Thumbs down"
              >
                <ThumbIcon up={false} filled={message.rating === "thumbs_down"} />
              </button>
            </div>
          )}
        </div>
        {!isUser && message.handout && (
          <HandoutSuggestion handout={message.handout} />
        )}
        {message.followUp && onFollowUpClick && (
          <button
            type="button"
            onClick={() => onFollowUpClick(message.followUp!)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-blue/25 bg-white px-3.5 py-1.5 text-sm font-medium text-brand-navy shadow-soft transition hover:-translate-y-0.5 hover:border-brand-blue/50 hover:bg-brand-light hover:shadow-lift"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {message.followUp}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline handout suggestion rendered under an assistant message. Renders as
 * an external-link button when a URL is present, or a static labelled tag
 * when only a title is available (the server only persists what the lesson
 * .docx actually contained).
 */
function HandoutSuggestion({ handout }: { handout: NonNullable<ChatMessageType["handout"]> }) {
  const label = `Practice: ${handout.title}`;
  const icon = (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M9 4h6l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 4v4h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
  if (handout.url) {
    return (
      <a
        href={handout.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="handout-suggestion"
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-50 px-3.5 py-1.5 text-sm font-medium text-emerald-800 shadow-soft transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-lift"
      >
        {icon}
        {label}
      </a>
    );
  }
  return (
    <span
      data-testid="handout-suggestion"
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-50 px-3.5 py-1.5 text-sm font-medium text-emerald-800 shadow-soft"
    >
      {icon}
      {label}
    </span>
  );
}

export default ChatMessage;
