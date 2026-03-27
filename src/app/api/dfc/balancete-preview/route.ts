import { readFile } from "fs/promises";
import { isAbsolute, resolve } from "path";
import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireClient } from "@/lib/auth-guard";
import { error, handleError, success } from "@/lib/api-response";
import { parseBalancetePreviewFile } from "@/lib/movement-import";

function parseYear(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2100) {
    return null;
  }
  return parsed;
}

function parseMonth(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) {
    return null;
  }
  return parsed;
}

export const runtime = "nodejs";
export const preferredRegion = "iad1";

function formatPreviewNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireClient();
    const { searchParams } = new URL(request.url);
    const year = parseYear(searchParams.get("year"));
    const month = parseMonth(searchParams.get("month"));

    if (!auth.clientId) {
      return error("Cliente nao encontrado", 404);
    }

    if (!year || !month) {
      return error("Ano e mes sao obrigatorios", 400);
    }

    const document = await prisma.clientDocument.findFirst({
      where: {
        accounting_id: auth.accountingId,
        client_id: auth.clientId,
        document_type: "dfc_balancete_import",
        period_year: year,
        period_month: month,
        deleted_at: null,
      },
      select: {
        display_name: true,
        original_name: true,
        storage_path: true,
        content: true,
      },
    });

    let bytes = document?.content ? Buffer.from(document.content) : null;

    if (!bytes && document?.storage_path) {
      const filePath = isAbsolute(document.storage_path)
        ? document.storage_path
        : resolve(process.cwd(), document.storage_path);

      try {
        bytes = await readFile(filePath);
      } catch {
        bytes = null;
      }
    }

    if (bytes && document) {
      const rows = parseBalancetePreviewFile(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      );

      return success({
        fileName: document.original_name,
        displayName: document.display_name,
        source: "file",
        rows,
      });
    }

    const [latestImport, movements] = await Promise.all([
      prisma.importBatch.findFirst({
        where: {
          accounting_id: auth.accountingId,
          client_id: auth.clientId,
          year,
          status: "ready",
          kind: `client_dfc_balancete_month_${String(month - 1).padStart(2, "0")}`,
        },
        select: {
          file_name: true,
        },
        orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
      }),
      prisma.monthlyMovement.findMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: auth.clientId,
          year,
          type: "patrimonial",
          deleted_at: null,
        },
        select: {
          code: true,
          reduced_code: true,
          name: true,
          values: true,
        },
        orderBy: [{ code: "asc" }],
      }),
    ]);

    if (!movements.length) {
      return error("Balancete nao encontrado para este mes", 404);
    }

    const rows = movements.map((movement) => ({
      conta: movement.reduced_code ?? "",
      classificacao: movement.code,
      nomeContaContabil: movement.name,
      saldoAnterior: "",
      debito: "",
      credito: "",
      saldoAtual: formatPreviewNumber(movement.values[month - 1] ?? 0),
    }));

    return success({
      fileName: latestImport?.file_name ?? `Balancete ${month}/${year}`,
      displayName: `Balancete ${month}/${year}`,
      source: "fallback",
      rows,
    });
  } catch (err) {
    return handleError(err);
  }
}
