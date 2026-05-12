import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import clsx from "clsx";
import { postChat, rateMessage } from "../api";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";
import EscalationBanner from "./EscalationBanner";
import RolePlayToggle from "./RolePlayToggle";
import VocabularyDownloads from "./VocabularyDownloads";
import type { ChatMessageType, Handout } from "../types";
import logo from "../assets/workplace-edge-logo.svg";

const FEEDBACK_TIMEOUT_MS = 45000;
const FEEDBACK_MESSAGE = "Please provide feedback on my role-play practice.";

function describeChatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED") {
      return "This is taking longer than expected. Please try again.";
    }
    const serverMessage =
      typeof err.response?.data === "object" && err.response?.data !== null
        ? (err.response.data as { error?: unknown }).error
        : undefined;
    if (typeof serverMessage === "string" && serverMessage.length > 0) {
      return serverMessage;
    }
    if (err.response) {
      return "The server had trouble responding. Please try again.";
    }
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

type IntentBubble = {
  label: string;
  intent: string;
  description: string;
  starter: string;
  Icon: (props: { className?: string }) => JSX.Element;
};

const IconFeedback = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M21 12c0 4.418-4.03 8-9 8-1.27 0-2.478-.23-3.58-.65L3 21l1.75-4.2C3.64 15.45 3 13.78 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M8.5 12h7M8.5 9.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconBoundary = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M4 6.5h5a2 2 0 0 1 2 2V20H6a2 2 0 0 1-2-2V6.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M20 4H15a2 2 0 0 0-2 2v14h5a2 2 0 0 0 2-2V4Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const IconDeadline = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <circle cx="12" cy="13" r="7.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 9v4l2.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M9 3h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconClarify = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M9 9.5a3 3 0 1 1 4.5 2.6c-.9.6-1.5 1.2-1.5 2.4V15"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="12" cy="18.2" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const IconCoaching = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M12 3l2.5 5.2 5.5.8-4 3.9.9 5.6L12 15.9l-4.9 2.6.9-5.6-4-3.9 5.5-.8L12 3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const INTENT_BUBBLES: readonly IntentBubble[] = [
  {
    label: "Give Feedback",
    intent: "give_feedback",
    description: "Deliver constructive feedback with clarity",
    starter: "I want to give a coworker constructive feedback. Can you coach me through it?",
    Icon: IconFeedback,
  },
  {
    label: "Set a Boundary",
    intent: "set_boundary",
    description: "Practice setting healthy limits",
    starter: "I need help setting a healthy boundary at work. Where should I start?",
    Icon: IconBoundary,
  },
  {
    label: "Push Back on Deadline",
    intent: "push_back_deadline",
    description: "Negotiate timelines confidently",
    starter: "I need to push back on an unrealistic deadline. How should I approach the conversation?",
    Icon: IconDeadline,
  },
  {
    label: "Clarify Tasks",
    intent: "clarify_tasks",
    description: "Ask the right questions",
    starter: "I'm unclear about what's being asked of me at work. How can I ask for clarity?",
    Icon: IconClarify,
  },
  {
    label: "General Coaching",
    intent: "general_coaching",
    description: "Broad communication coaching",
    starter: "I'd like general communication coaching. Where should we start?",
    Icon: IconCoaching,
  },
] as const;

function parseFollowUp(text: string): { content: string; followUp?: string } {
  const match = text.match(/\n?\[FOLLOW-UP]\s*(.+)$/);
  if (!match) return { content: text };
  return {
    content: text.slice(0, match.index).trimEnd(),
    followUp: match[1].trim(),
  };
}

/**
 * Validate a handout URL — accept only http/https schemes (D-01 defense-in-depth).
 *
 * Returns the original string when valid, undefined otherwise. Used by
 * parseHandout to filter out javascript:, data:, vbscript:, etc. URLs that an
 * attacker might smuggle into a hallucinated handout payload.
 */
function safeHandoutUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Strip the server-appended `[HANDOUT] {json}` marker from an assistant
 * response and return the parsed handout. The marker is added by the chat
 * route (server/src/lib/handouts.ts) — the LLM never produces it, which keeps
 * us safe from hallucinated handouts.
 */
function parseHandout(text: string): { content: string; handout?: Handout } {
  const match = text.match(/\n?\[HANDOUT]\s*(\{[^\n]*\})\s*$/);
  if (!match) return { content: text };
  try {
    const payload = JSON.parse(match[1]) as Partial<Handout>;
    if (typeof payload.title !== "string" || payload.title.length === 0) {
      return { content: text };
    }
    const safeUrl = safeHandoutUrl(payload.url);
    const handout: Handout = safeUrl
      ? { title: payload.title, url: safeUrl }
      : { title: payload.title };
    return {
      content: text.slice(0, match.index).trimEnd(),
      handout,
    };
  } catch {
    return { content: text };
  }
}

function createMessage(role: "user" | "assistant", content: string, messageId?: string): ChatMessageType {
  if (role === "assistant") {
    const { content: afterHandout, handout } = parseHandout(content);
    const { content: parsed, followUp } = parseFollowUp(afterHandout);
    return { role, content: parsed, timestamp: new Date(), followUp, messageId, handout };
  }
  return { role, content, timestamp: new Date() };
}

type ChatExperienceProps = {
  /**
   * When true, render a tighter layout suitable for the embedded iframe and
   * the floating widget panel (no big logo header, no top notice banner,
   * single-column intent bubbles, footer notice instead). The full feature set
   * — Practice Mode, intent bubbles, vocabulary downloads, escalation banner,
   * follow-up retry, role-play feedback flow — is identical in both modes.
   */
  compact?: boolean;
};

function ChatExperience({ compact = false }: ChatExperienceProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const [rolePlayActive, setRolePlayActive] = useState(false);
  const [rolePlayTurns, setRolePlayTurns] = useState(0);
  const [pendingFeedback, setPendingFeedback] = useState<{ sessionId: string } | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isFirstMessage = messages.length === 0;
  const isBusy = isLoading || isFeedbackLoading;
  const canSend = useMemo(() => inputValue.trim().length > 0 && !isBusy, [inputValue, isBusy]);

  const handleRolePlayToggle = () => {
    if (rolePlayActive) {
      setRolePlayActive(false);
      setRolePlayTurns(0);
      return;
    }
    setRolePlayActive(true);
    setRolePlayTurns(2);
    setPendingFeedback(null);
    setMessages((prev) => [
      ...prev,
      createMessage(
        "assistant",
        "Practice Mode activated! I'll play a difficult coworker for the next 2 exchanges. Try using the communication skills from the lesson. Go ahead — what would you say?",
      ),
    ]);
  };

  const handleRate = (messageId: string, value: "thumbs_up" | "thumbs_down") => {
    rateMessage(messageId, value).catch(() => {});
    setMessages((prev) =>
      prev.map((m) => (m.messageId === messageId ? { ...m, rating: value } : m)),
    );
  };

  const startNewConversation = () => {
    setSessionId(undefined);
    setMessages([]);
    setSelectedIntent(null);
    setShowEscalation(false);
    setRolePlayActive(false);
    setRolePlayTurns(0);
    setPendingFeedback(null);
    setIsFeedbackLoading(false);
    setInputValue("");
  };

  const requestRolePlayFeedback = async (currentSessionId: string) => {
    setIsFeedbackLoading(true);
    try {
      const feedback = await postChat(
        {
          sessionId: currentSessionId,
          message: FEEDBACK_MESSAGE,
          mode: "roleplay_feedback",
        },
        { timeoutMs: FEEDBACK_TIMEOUT_MS },
      );
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", feedback.data.response, feedback.data.messageId),
      ]);
      setPendingFeedback(null);
    } catch (err) {
      setPendingFeedback({ sessionId: currentSessionId });
      setMessages((prev) => [...prev, createMessage("assistant", describeChatError(err))]);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const retryFeedback = () => {
    if (!pendingFeedback || isFeedbackLoading) return;
    void requestRolePlayFeedback(pendingFeedback.sessionId);
  };

  const skipFeedback = () => {
    setPendingFeedback(null);
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, isFeedbackLoading, pendingFeedback]);

  const sendMessageWith = async (text: string, intentOverride?: string | null) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    const intentToSend = intentOverride ?? selectedIntent;

    setMessages((prev) => [...prev, createMessage("user", trimmed)]);
    setInputValue("");
    setIsLoading(true);

    const isRolePlay = rolePlayActive && rolePlayTurns > 0;
    const isLastRolePlayTurn = rolePlayActive && rolePlayTurns === 1;
    const mode = isRolePlay ? "roleplay" : undefined;

    let resolvedSessionId: string | undefined;
    try {
      const response = await postChat({
        ...(sessionId ? { sessionId } : {}),
        message: trimmed,
        ...(intentToSend ? { intent: intentToSend } : {}),
        ...(mode ? { mode } : {}),
      });
      resolvedSessionId = response.data.sessionId;
      setSessionId(resolvedSessionId);
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", response.data.response, response.data.messageId),
      ]);
      if (response.data.escalated) setShowEscalation(true);

      if (isRolePlay) {
        setRolePlayTurns((t) => Math.max(0, t - 1));
      }
    } catch (err) {
      setMessages((prev) => [...prev, createMessage("assistant", describeChatError(err))]);
      setIsLoading(false);
      setSelectedIntent(null);
      return;
    }

    setIsLoading(false);
    setSelectedIntent(null);

    if (isLastRolePlayTurn && resolvedSessionId) {
      setRolePlayActive(false);
      await requestRolePlayFeedback(resolvedSessionId);
    }
  };

  const handleTopicClick = (intent: string, starter: string) => {
    if (isLoading) return;
    setSelectedIntent(intent);
    void sendMessageWith(starter, intent);
  };

  const handleFollowUpClick = (text: string) => {
    void sendMessageWith(text);
  };

  const sendMessage = async () => {
    if (!canSend) return;
    await sendMessageWith(inputValue);
  };

  return (
    <main
      className={clsx(
        "flex flex-col text-brand-ink",
        compact
          ? "h-screen w-full bg-white"
          : "mx-auto h-dvh w-full max-w-2xl px-4 py-4",
      )}
    >
      {compact ? (
        <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <p className="text-sm font-semibold text-brand-navy">AI Lesson Coach</p>
          {!isFirstMessage && (
            <button
              type="button"
              onClick={startNewConversation}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-blue/30 hover:text-brand-navy"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
                <path
                  d="M12 4v16m8-8H4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              New
            </button>
          )}
        </header>
      ) : (
        <header className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Workplace Edge" className="h-10 w-auto sm:h-11" />
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
                AI Lesson Coach
              </p>
              <p className="text-xs text-slate-500">Practice communication in a safe space</p>
            </div>
          </div>
          {!isFirstMessage && (
            <button
              type="button"
              onClick={startNewConversation}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-soft transition hover:border-brand-blue/30 hover:text-brand-navy"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
                <path
                  d="M12 4v16m8-8H4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              New Conversation
            </button>
          )}
        </header>
      )}

      {!compact && (
        <div
          role="note"
          className="mb-3 flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50/80 px-3 py-1.5 text-[11px] font-medium text-amber-900 backdrop-blur"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden>
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z" />
          </svg>
          <span>
            Learning coach, not HR. For workplace concerns, please contact your manager or HR.
          </span>
        </div>
      )}

      <section
        ref={scrollRef}
        className={clsx(
          "scroll-soft flex-1 overflow-y-auto",
          compact
            ? "bg-white"
            : "rounded-2xl border border-slate-200/80 bg-white/70 shadow-card backdrop-blur bg-[radial-gradient(1000px_560px_at_50%_-10%,rgba(46,64,197,0.06),transparent_60%)]",
        )}
      >
        {isFirstMessage ? (
          <div
            className={clsx(
              "flex h-full flex-col items-center justify-center text-center",
              compact ? "px-3 py-4" : "px-6 py-10",
            )}
          >
            <div
              className={clsx(
                "flex items-center justify-center rounded-2xl bg-brand-gradient shadow-lift",
                compact ? "mb-3 h-10 w-10" : "mb-5 h-14 w-14",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                className={clsx("text-white", compact ? "h-5 w-5" : "h-7 w-7")}
                fill="none"
                aria-hidden
              >
                <path
                  d="M21 11.5c0 4.142-4.03 7.5-9 7.5a11 11 0 0 1-3.06-.424L4 20l1.22-3.66A7.06 7.06 0 0 1 3 11.5C3 7.358 7.03 4 12 4s9 3.358 9 7.5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <circle cx="8.5" cy="11.5" r="1" fill="currentColor" />
                <circle cx="12" cy="11.5" r="1" fill="currentColor" />
                <circle cx="15.5" cy="11.5" r="1" fill="currentColor" />
              </svg>
            </div>
            <h1
              className={clsx(
                "bg-brand-gradient bg-clip-text font-bold tracking-tight text-transparent",
                compact ? "text-lg" : "text-2xl sm:text-[26px]",
              )}
            >
              What would you like to work on?
            </h1>
            <p
              className={clsx(
                "max-w-sm text-slate-500",
                compact ? "mt-1 text-xs" : "mt-1.5 text-sm",
              )}
            >
              Pick a coaching focus below or type your own question to get started.
            </p>
            <div
              className={clsx(
                "w-full",
                compact
                  ? "mt-4 grid grid-cols-1 gap-2"
                  : "mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2",
              )}
            >
              {INTENT_BUBBLES.map(({ label, intent, description, starter, Icon }) => {
                const isSelected = selectedIntent === intent;
                return (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => handleTopicClick(intent, starter)}
                    disabled={isBusy}
                    aria-label={`Start coaching: ${label}`}
                    className={clsx(
                      "group relative flex items-start gap-3 rounded-xl border text-left transition-[border-color,box-shadow,background-color] duration-200",
                      compact ? "p-2.5" : "p-3.5",
                      isSelected
                        ? "border-brand-navy bg-brand-light shadow-lift"
                        : "border-slate-200 bg-white hover:border-brand-blue/40 hover:shadow-lift",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex shrink-0 items-center justify-center rounded-lg transition",
                        compact ? "h-7 w-7" : "h-9 w-9",
                        isSelected
                          ? "bg-brand-light text-brand-navy"
                          : "bg-brand-mist text-brand-navy",
                      )}
                    >
                      <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <p
                        className={clsx(
                          "font-semibold text-brand-ink",
                          compact ? "text-xs" : "text-sm",
                        )}
                      >
                        {label}
                      </p>
                      <p
                        className={clsx(
                          "leading-snug text-slate-500",
                          compact ? "mt-0.5 text-[11px]" : "mt-0.5 text-xs",
                        )}
                      >
                        {description}
                      </p>
                    </span>
                  </button>
                );
              })}
            </div>
            <VocabularyDownloads />
          </div>
        ) : (
          <div className={clsx("space-y-3", compact ? "p-3" : "p-4")}>
            {messages.map((message, index) => (
              <ChatMessage
                key={`${message.role}-${index}-${message.timestamp.toISOString()}`}
                message={message}
                onFollowUpClick={handleFollowUpClick}
                onRate={handleRate}
              />
            ))}
            {(isLoading || isFeedbackLoading) && <TypingIndicator />}
            {pendingFeedback && !isFeedbackLoading && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                <span className="font-medium">Feedback didn't load.</span>
                <button
                  type="button"
                  onClick={retryFeedback}
                  className="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white shadow-soft transition hover:bg-amber-700"
                >
                  Get my feedback
                </button>
                <button
                  type="button"
                  onClick={skipFeedback}
                  className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-medium text-amber-900 transition hover:bg-amber-100"
                >
                  Skip
                </button>
              </div>
            )}
            {showEscalation && <EscalationBanner />}
          </div>
        )}
      </section>

      <div
        className={clsx(
          "shrink-0 overflow-hidden border-slate-200/80 bg-white",
          compact
            ? "border-t"
            : "mt-3 rounded-2xl border shadow-card",
        )}
      >
        {!isFirstMessage && (
          <div
            className={clsx(
              "flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-brand-mist/60",
              compact ? "px-2 py-1.5" : "px-3 py-2",
            )}
            role="radiogroup"
            aria-label="Choose a coaching focus"
          >
            <span
              className={clsx(
                "mr-1 font-semibold uppercase tracking-wide text-slate-400",
                compact ? "text-[10px]" : "text-[11px]",
              )}
            >
              Focus
            </span>
            {INTENT_BUBBLES.map(({ label, intent }) => {
              const isSelected = selectedIntent === intent;
              return (
                <button
                  key={intent}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelectedIntent(intent);
                    inputRef.current?.focus();
                  }}
                  className={clsx(
                    "rounded-full font-medium transition",
                    compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
                    isSelected
                      ? "bg-brand-navy text-white shadow-soft"
                      : "border border-slate-200 bg-white text-brand-navy hover:border-brand-blue/40 hover:bg-brand-light",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        <div className={clsx("flex items-center gap-2", compact ? "px-2 pt-1.5" : "px-3 pt-2")}>
          <RolePlayToggle
            isActive={rolePlayActive}
            turnsLeft={rolePlayTurns}
            onToggle={handleRolePlayToggle}
            disabled={isBusy}
          />
        </div>
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          isLoading={isBusy}
          inputRef={inputRef}
        />
      </div>

      {compact && (
        <p className="border-t border-slate-100 bg-white px-3 py-1.5 text-center text-[10px] text-slate-400">
          Learning coach, not HR. For workplace concerns, contact your manager or HR.
        </p>
      )}
    </main>
  );
}

export default ChatExperience;
