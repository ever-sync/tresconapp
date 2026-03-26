"use client";

import { useRef, useCallback } from "react";
import type { ImportStatus } from "@/hooks/useExcelImport";

interface ExcelImporterProps {
  progress: {
    status: ImportStatus;
    totalRows: number;
    sentRows: number;
    currentBatch: number;
    totalBatches: number;
    percent: number;
    errorMessage?: string;
  };
  onFileSelected: (file: File) => void;
  onReset: () => void;
  onAbort: () => void;
  accept?: string;
  title: string;
  description: string;
}

export function ExcelImporter({
  progress,
  onFileSelected,
  onReset,
  onAbort,
  accept = ".xlsx,.xls,.csv",
  title,
  description,
}: ExcelImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const isWorking =
    progress.status === "parsing" || progress.status === "uploading";

  return (
    <div className="w-full space-y-4">
      {/* Drop zone */}
      {progress.status === "idle" && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-12 transition-colors hover:border-primary hover:bg-muted/50"
        >
          <svg
            className="mb-3 h-10 w-10 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
          />
        </div>
      )}

      {/* Progress */}
      {isWorking && (
        <div className="space-y-3 rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {progress.status === "parsing"
                ? "Processando arquivo..."
                : `Enviando batch ${progress.currentBatch}/${progress.totalBatches}`}
            </p>
            <button
              onClick={onAbort}
              className="rounded-md border px-3 py-1 text-xs hover:bg-muted"
            >
              Cancelar
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {progress.sentRows.toLocaleString("pt-BR")} /{" "}
              {progress.totalRows.toLocaleString("pt-BR")} linhas
            </span>
            <span>{progress.percent}%</span>
          </div>
        </div>
      )}

      {/* Success */}
      {progress.status === "done" && (
        <div className="space-y-3 rounded-xl border border-success/30 bg-success/5 p-6">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="text-sm font-medium text-success">
              Importação concluída
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {progress.totalRows.toLocaleString("pt-BR")} linhas importadas em{" "}
            {progress.totalBatches} batches
          </p>
          <button
            onClick={onReset}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Importar outro arquivo
          </button>
        </div>
      )}

      {/* Error */}
      {progress.status === "error" && (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <p className="text-sm font-medium text-destructive">
              Erro na importação
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {progress.errorMessage}
          </p>
          {progress.sentRows > 0 && (
            <p className="text-xs text-muted-foreground">
              {progress.sentRows.toLocaleString("pt-BR")} linhas foram
              importadas antes do erro.
            </p>
          )}
          <button
            onClick={onReset}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
