import clsx from "clsx";

type RolePlayToggleProps = {
  isActive: boolean;
  turnsLeft: number;
  onToggle: () => void;
  disabled?: boolean;
};

function RolePlayToggle({ isActive, turnsLeft, onToggle, disabled }: RolePlayToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
        isActive
          ? "bg-violet-600 text-white shadow-soft ring-2 ring-violet-200"
          : "border border-violet-200 bg-white text-violet-700 hover:border-violet-300 hover:bg-violet-50",
        disabled && "cursor-not-allowed opacity-50",
      )}
      aria-pressed={isActive}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
        <path
          d="M12 4 3 8v5c0 4.2 3.8 7.3 9 8 5.2-.7 9-3.8 9-8V8l-9-4Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="9.5" cy="11" r="1" fill="currentColor" />
        <circle cx="14.5" cy="11" r="1" fill="currentColor" />
        <path d="M9 14.5c.8.8 1.9 1.3 3 1.3s2.2-.5 3-1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {isActive ? `Practice Mode · ${turnsLeft} turn${turnsLeft === 1 ? "" : "s"} left` : "Practice This"}
    </button>
  );
}

export default RolePlayToggle;
