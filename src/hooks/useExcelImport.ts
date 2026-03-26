"use client";

import { useState, useCallback, useRef } from "react";
import type { ExcelWorkerResult, ExcelWorkerError } from "@/lib/excel-worker";

const BATCH_SIZE = 500;

export type ImportStatus = "idle" | "parsing" | "uploading" | "done" | "error";

interface ImportProgress {
  status: ImportStatus;
  /** Total rows parsed from Excel */
  totalRows: number;
  /** Rows sent so far */
  sentRows: number;
  /** Current batch index (0-based) */
  currentBatch: number;
  /** Total number of batches */
  totalBatches: number;
  /** Percentage 0-100 */
  percent: number;
  /** Error message if status === "error" */
  errorMessage?: string;
  /** Parsed headers from Excel */
  headers: string[];
}

interface UseExcelImportOptions<TRow> {
  /** API endpoint to send batches to */
  endpoint: string;
  /** Transform raw Excel row to API row format */
  transformRow: (raw: Record<string, unknown>, index: number) => TRow | null;
  /** Extra fields to include in each batch request */
  extraFields?: Record<string, unknown>;
  /** Batch size (default 500) */
  batchSize?: number;
}

export function useExcelImport<TRow>({
  endpoint,
  transformRow,
  extraFields = {},
  batchSize = BATCH_SIZE,
}: UseExcelImportOptions<TRow>) {
  const [progress, setProgress] = useState<ImportProgress>({
    status: "idle",
    totalRows: 0,
    sentRows: 0,
    currentBatch: 0,
    totalBatches: 0,
    percent: 0,
    headers: [],
  });

  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = false;
    setProgress({
      status: "idle",
      totalRows: 0,
      sentRows: 0,
      currentBatch: 0,
      totalBatches: 0,
      percent: 0,
      headers: [],
    });
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const importFile = useCallback(
    async (file: File) => {
      abortRef.current = false;

      // ── Step 1: Parse Excel in Web Worker ───────────────
      setProgress((p) => ({ ...p, status: "parsing", percent: 0 }));

      const arrayBuffer = await file.arrayBuffer();

      const parsedData = await new Promise<ExcelWorkerResult>(
        (resolve, reject) => {
          const worker = new Worker(
            new URL("@/lib/excel-worker.ts", import.meta.url)
          );

          worker.onmessage = (
            event: MessageEvent<ExcelWorkerResult | ExcelWorkerError>
          ) => {
            worker.terminate();
            if (event.data.type === "error") {
              reject(new Error(event.data.message));
            } else {
              resolve(event.data);
            }
          };

          worker.onerror = (err) => {
            worker.terminate();
            reject(new Error(err.message));
          };

          worker.postMessage({ type: "parse", file: arrayBuffer });
        }
      );

      // ── Step 2: Transform rows ──────────────────────────
      const transformedRows: TRow[] = [];
      for (let i = 0; i < parsedData.rows.length; i++) {
        const row = transformRow(parsedData.rows[i], i);
        if (row) transformedRows.push(row);
      }

      if (transformedRows.length === 0) {
        setProgress((p) => ({
          ...p,
          status: "error",
          errorMessage: "Nenhuma linha válida encontrada no arquivo",
        }));
        return;
      }

      // ── Step 3: Split into batches and send ─────────────
      const totalBatches = Math.ceil(transformedRows.length / batchSize);

      setProgress((p) => ({
        ...p,
        status: "uploading",
        totalRows: transformedRows.length,
        totalBatches,
        headers: parsedData.headers,
        percent: 0,
      }));

      for (let i = 0; i < totalBatches; i++) {
        if (abortRef.current) {
          setProgress((p) => ({
            ...p,
            status: "error",
            errorMessage: "Importação cancelada",
          }));
          return;
        }

        const batch = transformedRows.slice(
          i * batchSize,
          (i + 1) * batchSize
        );

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...extraFields,
            rows: batch,
            batch_index: i,
            total_batches: totalBatches,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setProgress((p) => ({
            ...p,
            status: "error",
            errorMessage:
              data.error || `Erro no batch ${i + 1}/${totalBatches}`,
            currentBatch: i,
          }));
          return;
        }

        const sentRows = Math.min((i + 1) * batchSize, transformedRows.length);
        const percent = Math.round((sentRows / transformedRows.length) * 100);

        setProgress((p) => ({
          ...p,
          sentRows,
          currentBatch: i + 1,
          percent,
        }));
      }

      setProgress((p) => ({
        ...p,
        status: "done",
        percent: 100,
        sentRows: transformedRows.length,
        currentBatch: totalBatches,
      }));
    },
    [endpoint, transformRow, extraFields, batchSize]
  );

  return { progress, importFile, reset, abort };
}
