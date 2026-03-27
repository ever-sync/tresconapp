import { NextRequest } from "next/server";

import { error, handleError, success } from "@/lib/api-response";
import { requireClient } from "@/lib/auth-guard";
import { enqueueBackgroundJob } from "@/lib/background-jobs";
import {
  buildInvalidMovementFileMessage,
  parseMonthlyBalanceteFile,
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
import { getDfcBalanceteImportKind } from "@/lib/dfc-balancete";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const runtime = "nodejs";
export const preferredRegion = "iad1";

function parseYearParam(value: string | null) {
  const year = Number(String(value ?? "").trim());
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return null;
  }
  return year;
}

function parseMonthParam(value: string | null) {
  const month = Number(String(value ?? "").trim());
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return month;
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
    const year = parseYearParam(String(formData.get("year") ?? "").trim());
    const month = parseMonthParam(String(formData.get("month") ?? "").trim());
    const valuesMode =
      String(formData.get("valuesMode") ?? "monthly").trim() === "accumulated"
        ? "accumulated"
        : "monthly";

    if (!(file instanceof File)) {
      return error("Arquivo obrigatorio", 400);
    }

    if (!year) {
      return error("Ano invalido", 400);
    }

    if (!month) {
      return error("Mes invalido", 400);
    }

    const fileBuffer = await file.arrayBuffer();
    const parseResult = parseMovementFile(fileBuffer);
    if (parseResult.fileError) {
      return error(parseResult.fileError, 400);
    }

    let parsedRows = parseResult.rows;
    let importMode: "annual" | "monthly_balancete" = "annual";
    if (parsedRows.length === 0) {
      const balanceteResult = parseMonthlyBalanceteFile(fileBuffer, month - 1);
      if (balanceteResult.fileError) {
        return error(balanceteResult.fileError, 400);
      }
      parsedRows = balanceteResult.rows;
      if (parsedRows.length > 0) {
        importMode = "monthly_balancete";
      }
    }

    if (parsedRows.length === 0) {
      return error(buildInvalidMovementFileMessage(parseResult.layout), 400);
    }

    const importBatch = await openImportBatch({
      accountingId: auth.accountingId,
      clientId: auth.clientId,
      year,
      kind:
        importMode === "monthly_balancete"
          ? getDfcBalanceteImportKind(month - 1)
          : "client_dfc_upload",
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
          importMode === "annual" && valuesMode === "accumulated"
            ? convertAccumulatedToMonthly(row.values)
            : row.values,
        category: row.category || resolvedCategory || undefined,
      };
    });

    const existingValuesByKey =
      importMode === "monthly_balancete"
        ? new Map(
            (
              await prisma.monthlyMovement.findMany({
                where: {
                  client_id: auth.clientId,
                  year,
                  type: "patrimonial",
                  code: { in: normalizedRows.map((row) => row.code) },
                  deleted_at: null,
                },
                select: {
                  code: true,
                  type: true,
                  values: true,
                },
              })
            ).map((item) => [`${item.code}:${item.type}`, item.values] as const)
          )
        : new Map<string, number[]>();

    const rowsToPersist = normalizedRows.map((row) => {
      if (importMode !== "monthly_balancete") {
        return row;
      }

      const existingValues =
        existingValuesByKey.get(`${row.code}:${row.type}`)?.slice() ?? Array.from({ length: 12 }, () => 0);
      existingValues[month - 1] = row.values[month - 1] ?? 0;

      return {
        ...row,
        values: existingValues,
      };
    });

    const results = await prisma.$transaction(
      rowsToPersist.map((row) =>
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

    await updateImportBatchProgress({
      batchId: importBatch.id,
      processedRows: results.length,
    });

    if (importMode === "monthly_balancete") {
      const existingDocument = await prisma.clientDocument.findFirst({
        where: {
          accounting_id: auth.accountingId,
          client_id: auth.clientId,
          document_type: "dfc_balancete_import",
          period_year: year,
          period_month: month,
          deleted_at: null,
        },
        select: { id: true },
      });

      const documentPayload = {
        original_name: file.name,
        display_name: `Balancete ${MONTH_LABELS[month - 1]}/${year}`,
        category: "DFC Balancete",
        document_type: "dfc_balancete_import",
        period_year: year,
        period_month: month,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content: Buffer.from(fileBuffer),
        description: `Balancete importado para ${MONTH_LABELS[month - 1]}/${year}.`,
        deleted_at: null,
      };

      if (existingDocument) {
        await prisma.clientDocument.update({
          where: { id: existingDocument.id },
          data: documentPayload,
        });
      } else {
        await prisma.clientDocument.create({
          data: {
            accounting_id: auth.accountingId,
            client_id: auth.clientId,
            ...documentPayload,
          },
        });
      }
    }

    const client = await prisma.client.findUnique({
      where: { id: auth.clientId },
      select: { name: true },
    });

    await createNotification({
      accountingId: auth.accountingId,
      audience: "staff",
      kind: "arquivos",
      title: "Novo balancete DFC recebido",
      description:
        importMode === "monthly_balancete"
          ? `${client?.name ?? "Cliente"} enviou ${file.name} para ${MONTH_LABELS[month - 1]}/${year}.`
          : `${client?.name ?? "Cliente"} enviou ${file.name} para o ano ${year}.`,
      clientId: auth.clientId,
      entityType: "dfc_import",
      entityId: importBatch.id,
    });

    try {
      const job = await enqueueBackgroundJob({
        type: "rebuild_statements",
        accountingId: auth.accountingId,
        clientId: auth.clientId,
        year,
        payload: {
          statementType: "all",
          source: "client_dfc_import",
        },
        importBatchId: importBatch.id,
      });

      return success({
        imported: results.length,
        year,
        month,
        valuesMode,
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
        imported: results.length,
        year,
        month,
        valuesMode,
        status: "ready",
        batchId: importBatch.id,
        jobId: null,
      });
    }
  } catch (err) {
    await failImportBatch({
      batchId: importBatchId,
      errorMessage: err instanceof Error ? err.message : "Falha ao importar DFC",
    });
    return handleError(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireClient();
    if (!auth.clientId) {
      return error("Cliente nao encontrado", 404);
    }

    const { searchParams } = new URL(request.url);
    const year = parseYearParam(searchParams.get("year"));
    const month = parseMonthParam(searchParams.get("month"));

    if (!year) {
      return error("Ano invalido", 400);
    }

    if (!month) {
      return error("Mes invalido", 400);
    }

    const monthIndex = month - 1;
    const existingMovements = await prisma.monthlyMovement.findMany({
      where: {
        accounting_id: auth.accountingId,
        client_id: auth.clientId,
        year,
        type: "patrimonial",
        deleted_at: null,
      },
      select: {
        id: true,
        values: true,
      },
    });

    await prisma.$transaction(async (tx) => {
      for (const movement of existingMovements) {
        const values = movement.values.slice();
        values[monthIndex] = 0;
        const shouldDelete = values.every((value) => Math.abs(value ?? 0) < 0.000001);

        await tx.monthlyMovement.update({
          where: { id: movement.id },
          data: shouldDelete
            ? {
                values,
                deleted_at: new Date(),
              }
            : {
                values,
              },
        });
      }

      await tx.clientDocument.updateMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: auth.clientId,
          document_type: "dfc_balancete_import",
          period_year: year,
          period_month: month,
          deleted_at: null,
        },
        data: {
          deleted_at: new Date(),
        },
      });

      await tx.importBatch.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: auth.clientId,
          year,
          kind: getDfcBalanceteImportKind(monthIndex),
        },
      });
    });

    await rebuildStatements({
      accountingId: auth.accountingId,
      clientId: auth.clientId,
      year,
      statementType: "all",
    });

    return success({
      deleted: true,
      year,
      month,
      monthLabel: MONTH_LABELS[monthIndex],
    });
  } catch (err) {
    return handleError(err);
  }
}
