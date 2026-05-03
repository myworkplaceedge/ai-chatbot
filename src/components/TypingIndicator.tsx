function TypingIndicator() {
  return (
    <div className="flex w-full animate-fade-in items-end gap-2">
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
      <div className="rounded-2xl rounded-bl-md border border-slate-200/70 bg-white px-4 py-3 shadow-soft">
        <div className="flex items-center gap-1">
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-brand-navy" style={{ animationDelay: "-0.32s" }} />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-brand-navy" style={{ animationDelay: "-0.16s" }} />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-brand-navy" />
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;
