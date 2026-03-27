import { NextRequest } from "next/server";

import { error, handleError, success } from "@/lib/api-response";
import { requireClient } from "@/lib/auth-guard";
import { enqueueBackgroundJob } from "@/lib/background-jobs";
import {
  buildInvalidMovementFileMessage,
  parseMovementFile,
} from "@/lib/movement-import";
import { createNotification } from "@/lib/notification-service";
import prisma from "@/lib/prisma";
import {
  completeImportBatch,
  failImportBatch,
  openImportBatch,
  rebuildStatements,
  updateImportBatchProgress,
} from "@/lib/statement-snapshots";
import {
  convertAccumulatedToMonthly,
  resolveDreCategory,
} from "@/lib/dre-statement";
import { resolvePatrimonialCategory } from "@/lib/patrimonial-statement";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

const STALE_IMPORT_WINDOW_MS = 2 * 60 * 1000;

function detectAccumulatedLikeValues(rows: Array<{ values: number[] }>) {
  const scoredRows = rows
    .map((row) => {
      const values = row.values.slice(0, 12).map((value) => Math.abs(Number(value) || 0));
      const nonZeroCount = values.filter((value) => value > 0).length;

      if (nonZeroCount < 3) {
        return null;
      }

      let comparisons = 0;
      let nonDecreasing = 0;

      for (let index = 1; index < values.length; index += 1) {
        const previous = values[index - 1] ?? 0;
        const current = values[index] ?? 0;

        if (previous === 0 && current === 0) {
          continue;
        }

        comparisons += 1;
        if (current + 0.005 >= previous) {
          nonDecreasing += 1;
        }
      }

      if (comparisons < 3) {
        return null;
      }

      return nonDecreasing / comparisons;
    })
    .filter((score): score is number => score !== null);

  if (scoredRows.length === 0) {
    return false;
  }

  const accumulatedLikeRows = scoredRows.filter((score) => score >= 0.72).length;
  return accumulatedLikeRows / scoredRows.length >= 0.55;
}

export async function POST(request: NextRequest) {
  let importBatchId: string | undefined;

  try {
    const auth = await requireClient();
    if (!auth.clientId) {
      return error("Cliente nao encontrado", 404);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const year = Number(String(formData.get("year") ?? "").trim());
    const requestedValuesMode = String(formData.get("valuesMode") ?? "auto").trim();
    const valuesMode =
      requestedValuesMode === "accumulated"
        ? "accumulated"
        : requestedValuesMode === "monthly"
          ? "monthly"
          : "auto";

    if (!(file instanceof File)) {
      return error("Arquivo obrigatorio", 400);
    }

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return error("Ano invalido", 400);
    }

    const parseResult = parseMovementFile(await file.arrayBuffer());
    if (parseResult.fileError) {
      return error(parseResult.fileError, 400);
    }

    const parsedRows = parseResult.rows;
    if (parsedRows.length === 0) {
      return error(buildInvalidMovementFileMessage(parseResult.layout), 400);
    }

    const effectiveValuesMode =
      valuesMode === "auto"
        ? detectAccumulatedLikeValues(parsedRows)
          ? "accumulated"
          : "monthly"
        : valuesMode;

    if (process.env.NODE_ENV !== "production") {
      await prisma.importBatch.updateMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: auth.clientId,
          year,
          kind: "client_dre_upload",
          status: "processing",
          started_at: {
            lt: new Date(Date.now() - STALE_IMPORT_WINDOW_MS),
          },
        },
        data: {
          status: "failed",
          error_message: "Importacao anterior encerrada automaticamente no ambiente local.",
          finished_at: new Date(),
        },
      });
    }

    const importBatch = await openImportBatch({
      accountingId: auth.accountingId,
      clientId: auth.clientId,
      year,
      kind: "client_dre_upload",
      fileName: file.name,
      batchIndex: 0,
    });
    importBatchId = importBatch.id;

    const [
      globalAccounts,
      clientAccounts,
      globalDreMappings,
      clientDreMappings,
      globalPatrimonialMappings,
      clientPatrimonialMappings,
    ] = await Promise.all([
      prisma.chartOfAccounts.findMany({
        where: { accounting_id: auth.accountingId, client_id: null },
        select: {
          code: true,
          reduced_code: true,
          name: true,
          report_category: true,
          report_type: true,
          level: true,
        },
      }),
      prisma.chartOfAccounts.findMany({
        where: { accounting_id: auth.accountingId, client_id: auth.clientId },
        select: {
          code: true,
          reduced_code: true,
          name: true,
          report_category: true,
          report_type: true,
          level: true,
        },
      }),
      prisma.dREMapping.findMany({
        where: { accounting_id: auth.accountingId, client_id: null },
        select: { account_code: true, category: true, client_id: true },
      }),
      prisma.dREMapping.findMany({
        where: { accounting_id: auth.accountingId, client_id: auth.clientId },
        select: { account_code: true, category: true, client_id: true },
      }),
      prisma.patrimonialMapping.findMany({
        where: { accounting_id: auth.accountingId, client_id: null },
        select: { account_code: true, category: true, client_id: true },
      }),
      prisma.patrimonialMapping.findMany({
        where: { accounting_id: auth.accountingId, client_id: auth.clientId },
        select: { account_code: true, category: true, client_id: true },
      }),
    ]);

    const chartAccounts = new Map<string, (typeof globalAccounts)[number]>();
    for (const item of globalAccounts) chartAccounts.set(item.code, item);
    for (const item of clientAccounts) chartAccounts.set(item.code, item);

    const dreMappings = new Map<string, (typeof globalDreMappings)[number]>();
    for (const item of globalDreMappings) dreMappings.set(item.account_code, item);
    for (const item of clientDreMappings) dreMappings.set(item.account_code, item);

    const patrimonialMappings = new Map<
      string,
      (typeof globalPatrimonialMappings)[number]
    >();
    for (const item of globalPatrimonialMappings) {
      patrimonialMappings.set(item.account_code, item);
    }
    for (const item of clientPatrimonialMappings) {
      patrimonialMappings.set(item.account_code, item);
    }

    const normalizedRows = parsedRows.map((row) => {
      const chartAccount = chartAccounts.get(row.code) ?? null;
      const movement = {
        code: row.code,
        reduced_code: row.reduced_code,
        name: row.name,
        level: row.level,
        values: row.values,
        type: row.type,
        category: row.category,
      } as const;

      const resolvedCategory =
        row.type === "dre"
          ? resolveDreCategory({
              movement,
              chartAccount,
              mapping: dreMappings.get(row.code) ?? null,
            })
          : resolvePatrimonialCategory({
              movement,
              chartAccount,
              mapping: patrimonialMappings.get(row.code) ?? null,
            });

      return {
        ...row,
        values:
          effectiveValuesMode === "accumulated"
            ? convertAccumulatedToMonthly(row.values)
            : row.values,
        category: row.category || resolvedCategory || undefined,
      };
    });

    const movementPayload = normalizedRows.map((row) => ({
      accounting_id: auth.accountingId,
      client_id: auth.clientId!,
      year,
      code: row.code,
      reduced_code: row.reduced_code,
      name: row.name,
      level: row.level,
      values: row.values,
      type: row.type,
      category: row.category,
      is_mapped: row.is_mapped,
      deleted_at: null,
    }));

    let resultsCount = movementPayload.length;

    if (process.env.NODE_ENV !== "production") {
      const importedTypes = Array.from(new Set(normalizedRows.map((row) => row.type)));

      await prisma.$transaction([
        prisma.monthlyMovement.deleteMany({
          where: {
            client_id: auth.clientId,
            year,
            type: { in: importedTypes },
          },
        }),
        prisma.monthlyMovement.createMany({
          data: movementPayload,
        }),
      ]);
    } else {
      const results = await prisma.$transaction(
        normalizedRows.map((row) =>
          prisma.monthlyMovement.upsert({
            where: {
              client_id_year_code_type: {
                client_id: auth.clientId!,
                year,
                code: row.code,
                type: row.type,
              },
            },
            update: {
              name: row.name,
              reduced_code: row.reduced_code,
              level: row.level,
              values: row.values,
              category: row.category,
              is_mapped: row.is_mapped,
              deleted_at: null,
            },
            create: {
              accounting_id: auth.accountingId,
              client_id: auth.clientId!,
              year,
              code: row.code,
              reduced_code: row.reduced_code,
              name: row.name,
              level: row.level,
              values: row.values,
              type: row.type,
              category: row.category,
              is_mapped: row.is_mapped,
            },
          })
        )
      );

      resultsCount = results.length;
    }

    await updateImportBatchProgress({
      batchId: importBatch.id,
      processedRows: resultsCount,
    });

    const client = await prisma.client.findUnique({
      where: { id: auth.clientId },
      select: { name: true },
    });

    await createNotification({
      accountingId: auth.accountingId,
      audience: "staff",
      kind: "arquivos",
      title: "Novo balancete DRE recebido",
      description: `${client?.name ?? "Cliente"} enviou ${file.name} para o ano ${year}.`,
      clientId: auth.clientId,
      entityType: "dre_import",
      entityId: importBatch.id,
    });

    if (process.env.NODE_ENV !== "production") {
      await rebuildStatements({
        accountingId: auth.accountingId,
        clientId: auth.clientId,
        year,
        statementType: "dre",
      });
      await completeImportBatch({ batchId: importBatch.id });

      return success({
        imported: resultsCount,
        year,
        valuesMode: effectiveValuesMode,
        status: "ready",
        batchId: importBatch.id,
        jobId: null,
      });
    }

    try {
      const job = await enqueueBackgroundJob({
        type: "rebuild_statements",
        accountingId: auth.accountingId,
        clientId: auth.clientId,
        year,
        payload: {
          statementType: "all",
          source: "client_dre_import",
        },
        importBatchId: importBatch.id,
      });

      return success({
        imported: resultsCount,
        year,
        valuesMode: effectiveValuesMode,
        status: "processing",
        batchId: importBatch.id,
        jobId: job.id,
      });
    } catch {
      await rebuildStatements({
        accountingId: auth.accountingId,
        clientId: auth.clientId,
        year,
        statementType: "all",
      });
      await completeImportBatch({ batchId: importBatch.id });

      return success({
        imported: resultsCount,
        year,
        valuesMode: effectiveValuesMode,
        status: "ready",
        batchId: importBatch.id,
        jobId: null,
      });
    }
  } catch (err) {
    await failImportBatch({
      batchId: importBatchId,
      errorMessage: err instanceof Error ? err.message : "Falha ao importar DRE",
    });
    return handleError(err);
  }
}
