function EscalationBanner() {
  return (
    <div
      role="alert"
      className="flex animate-fade-up gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 shadow-soft"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M12 3 2 20h20L12 3Zm0 6v5m0 3v.01"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <p className="font-semibold">This topic may need human support</p>
        <p className="mt-0.5 text-amber-800">
          Please reach out to your HR department, manager, or Employee Assistance Program (EAP) for help with this concern.
        </p>
      </div>
    </div>
  );
}

export default EscalationBanner;
