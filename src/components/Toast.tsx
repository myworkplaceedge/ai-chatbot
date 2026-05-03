import { useEffect } from "react";
import clsx from "clsx";
import type { ToastType } from "../types";

type ToastProps = {
  message: string;
  type: ToastType;
  onClose: () => void;
};

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timeout);
  }, [onClose]);

  return (
    <div
      className={clsx(
        "fixed right-4 top-4 z-50 flex animate-fade-up items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lift",
        type === "success" ? "bg-brand-gradient" : "bg-rose-600",
      )}
      role="status"
      aria-live="polite"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
        {type === "success" ? (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden>
            <path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
      {message}
    </div>
  );
}

export default Toast;
