import { useState } from "react";
import clsx from "clsx";

type ChatWidgetProps = {
  children: React.ReactNode;
};

function ChatWidget({ children }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={clsx(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
          isOpen
            ? "bg-slate-600 text-white hover:bg-slate-700"
            : "bg-[#1B2B8A] text-white hover:bg-[#2E40C5]",
        )}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      <div
        className={clsx(
          "fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300",
          isOpen
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
        style={{ height: "min(600px, calc(100dvh - 8rem))" }}
      >
        {children}
      </div>
    </>
  );
}

export default ChatWidget;
