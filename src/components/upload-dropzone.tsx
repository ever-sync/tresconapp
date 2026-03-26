"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

type UploadDropzoneProps = {
  title: string;
  description: string;
  accept?: string;
  file: File | null;
  progress?: number | null;
  uploading?: boolean;
  compact?: boolean;
  onFileChange: (file: File | null) => void;
};

export function UploadDropzone({
  title,
  description,
  accept,
  file,
  progress,
  uploading = false,
  compact = false,
  onFileChange,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleFiles(nextFiles: FileList | null) {
    onFileChange(nextFiles?.[0] ?? null);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      className={cn(
        "cursor-pointer rounded-[1.5rem] border transition",
        compact ? "p-4" : "p-5",
        dragging
          ? "border-cyan-400/35 bg-cyan-500/10"
          : "border-white/10 bg-white/5 hover:border-cyan-400/20 hover:bg-white/8"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(event) => handleFiles(event.target.files)}
        className="hidden"
      />

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
          <UploadCloud className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300/70">
            {title}
          </p>
          <p className="mt-2 text-sm text-slate-400">{description}</p>

          {file ? (
            <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatSize(file.size)}</p>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFileChange(null);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {(uploading || (progress !== undefined && progress !== null)) && (
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(145deg,#19b6ff_0%,#0c8bff_55%,#0b63ff_100%)] transition-[width] duration-200"
                      style={{ width: `${progress ?? 0}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{uploading ? "Enviando..." : "Pronto para envio"}</span>
                    <span>{Math.round(progress ?? 0)}%</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-4 text-sm text-slate-500">
              Arraste e solte aqui ou clique para selecionar.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        <FileText className="h-3.5 w-3.5" />
        {compact ? "Anexo rápido" : "Seleção de arquivo"}
      </div>
    </div>
  );
}
