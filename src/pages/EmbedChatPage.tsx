import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, rateMessage } from "../api";
import ChatMessage from "../components/ChatMessage";
import ChatInput from "../components/ChatInput";
import TypingIndicator from "../components/TypingIndicator";
import type { ChatMessageType } from "../types";

function parseFollowUp(text: string): { content: string; followUp?: string } {
  const match = text.match(/\n?\[FOLLOW-UP]\s*(.+)$/);
  if (!match) return { content: text };
  return {
    content: text.slice(0, match.index).trimEnd(),
    followUp: match[1].trim(),
  };
}

function createMessage(role: "user" | "assistant", content: string, messageId?: string): ChatMessageType {
  if (role === "assistant") {
    const { content: parsed, followUp } = parseFollowUp(content);
    return { role, content: parsed, timestamp: new Date(), followUp, messageId };
  }
  return { role, content, timestamp: new Date() };
}

function EmbedChatPage() {
  const [searchParams] = useSearchParams();
  const lessonParam = searchParams.get("lesson");

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessageType[]>([
    createMessage(
      "assistant",
      lessonParam
        ? `Hi! I'm your AI Lesson Coach. Let's work on "${lessonParam}" skills together.`
        : "Hi! I'm your AI Lesson Coach. Ask me anything about the communication skills in this lesson.",
    ),
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = useMemo(() => inputValue.trim().length > 0 && !isLoading, [inputValue, isLoading]);

  const handleRate = (messageId: string, value: "thumbs_up" | "thumbs_down") => {
    rateMessage(messageId, value).catch(() => {});
    setMessages((prev) =>
      prev.map((m) => (m.messageId === messageId ? { ...m, rating: value } : m)),
    );
  };

  const handleFollowUpClick = (text: string) => {
    if (isLoading) return;
    setInputValue(text);
    setTimeout(() => {
      setMessages((prev) => [...prev, createMessage("user", text)]);
      setIsLoading(true);
      api
        .post<{ sessionId: string; response: string; messageId: string }>("/api/chat", {
          ...(sessionId ? { sessionId } : {}),
          message: text,
        })
        .then((response) => {
          setSessionId(response.data.sessionId);
          setMessages((prev) => [...prev, createMessage("assistant", response.data.response, response.data.messageId)]);
        })
        .catch(() => {
          setMessages((prev) => [...prev, createMessage("assistant", "Something went wrong. Please try again.")]);
        })
        .finally(() => {
          setIsLoading(false);
          setInputValue("");
        });
    }, 0);
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!canSend) return;
    const trimmed = inputValue.trim();
    setMessages((prev) => [...prev, createMessage("user", trimmed)]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await api.post<{ sessionId: string; response: string; messageId: string }>("/api/chat", {
        ...(sessionId ? { sessionId } : {}),
        message: trimmed,
      });
      setSessionId(response.data.sessionId);
      setMessages((prev) => [...prev, createMessage("assistant", response.data.response, response.data.messageId)]);
    } catch {
      setMessages((prev) => [...prev, createMessage("assistant", "Something went wrong. Please try again.")]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-white text-[#1A1A2E]">
      <div className="border-b border-slate-200 px-3 py-2">
        <p className="text-sm font-semibold text-[#1B2B8A]">AI Lesson Coach</p>
      </div>
      <section
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-3"
      >
        {messages.map((message, index) => (
          <ChatMessage
            key={`${message.role}-${index}-${message.timestamp.toISOString()}`}
            message={message}
            onFollowUpClick={handleFollowUpClick}
            onRate={handleRate}
          />
        ))}
        {isLoading && <TypingIndicator />}
      </section>
      <div className="shrink-0 border-t border-slate-200">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          isLoading={isLoading}
          inputRef={inputRef}
        />
      </div>
      <p className="border-t border-slate-100 px-3 py-1.5 text-center text-[10px] text-slate-400">
        I'm a learning coach, not HR. For workplace concerns, contact your manager or HR.
      </p>
    </div>
  );
}

export default EmbedChatPage;
