/**
 * Web Worker for parsing Excel files off the main thread.
 * This prevents the UI from freezing while processing large files.
 *
 * Usage: const worker = new Worker(new URL('./excel-worker.ts', import.meta.url))
 */

import * as XLSX from "xlsx";

export interface ExcelWorkerMessage {
  type: "parse";
  file: ArrayBuffer;
  sheetIndex?: number;
}

export interface ExcelWorkerResult {
  type: "result";
  rows: Record<string, unknown>[];
  headers: string[];
  totalRows: number;
  sheetName: string;
}

export interface ExcelWorkerError {
  type: "error";
  message: string;
}

self.onmessage = (event: MessageEvent<ExcelWorkerMessage>) => {
  try {
    const { file, sheetIndex = 0 } = event.data;

    const workbook = XLSX.read(file, { type: "array" });
    const sheetName = workbook.SheetNames[sheetIndex];

    if (!sheetName) {
      self.postMessage({
        type: "error",
        message: `Planilha não encontrada (índice ${sheetIndex})`,
      } satisfies ExcelWorkerError);
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    const headers = Object.keys(rows[0] || {});

    self.postMessage({
      type: "result",
      rows,
      headers,
      totalRows: rows.length,
      sheetName,
    } satisfies ExcelWorkerResult);
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Erro ao processar arquivo",
    } satisfies ExcelWorkerError);
  }
};
