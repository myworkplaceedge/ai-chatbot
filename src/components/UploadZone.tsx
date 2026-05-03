import { DragEvent, useRef, useState } from "react";
import clsx from "clsx";

type UploadZoneProps = {
  file: File | null;
  onFileSelect: (file: File | null) => void;
};

function UploadZone({ file, onFileSelect }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const setDocxFile = (selected: File | null) => {
    if (!selected) {
      onFileSelect(null);
      return;
    }
    const isDocx = selected.name.toLowerCase().endsWith(".docx");
    onFileSelect(isDocx ? selected : null);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0] || null;
    setDocxFile(droppedFile);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={clsx(
        "group relative cursor-pointer rounded-2xl border-2 border-dashed px-5 py-10 text-center transition",
        isDragging
          ? "border-brand-blue bg-brand-light shadow-ring"
          : "border-slate-300 bg-brand-mist/60 hover:border-brand-blue/60 hover:bg-brand-light/70",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0] || null;
          setDocxFile(selectedFile);
        }}
      />
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lift transition group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path
            d="M12 15V5m0 0-4 4m4-4 4 4M5 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-brand-ink">
        Drag and drop a <span className="text-brand-navy">.docx</span> file here
      </p>
      <p className="mt-1 text-xs text-slate-500">or click anywhere in this area to browse</p>
      {file && (
        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-brand-blue/30 bg-white px-3 py-1.5 text-xs font-medium text-brand-navy shadow-soft">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path
              d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          {file.name}
        </div>
      )}
    </div>
  );
}

export default UploadZone;
