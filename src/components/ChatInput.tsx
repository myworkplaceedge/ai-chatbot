import { FormEvent, KeyboardEvent, Ref } from "react";
import clsx from "clsx";

type ChatInputProps = {
  value: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  inputRef?: Ref<HTMLInputElement>;
};

function ChatInput({ value, isLoading, onChange, onSend, inputRef }: ChatInputProps) {
  const canSend = value.trim().length > 0 && !isLoading;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSend) {
      onSend();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="p-3">
      <div className="group flex items-center gap-2 rounded-full border border-slate-200 bg-brand-mist/70 pl-4 pr-1.5 py-1.5 transition focus-within:border-brand-blue/40 focus-within:bg-white focus-within:shadow-ring">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about this lesson..."
          className="h-9 flex-1 bg-transparent text-sm text-brand-ink placeholder:text-slate-400 outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          className={clsx(
            "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
            canSend
              ? "bg-brand-gradient text-white shadow-soft hover:shadow-lift"
              : "cursor-not-allowed bg-slate-200 text-slate-400",
          )}
          aria-label="Send message"
        >
          {isLoading ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M5 12h14m-5-6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}

export default ChatInput;
