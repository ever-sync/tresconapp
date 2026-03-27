import { NextRequest } from "next/server";

import { error, handleError, success } from "@/lib/api-response";
import { requireClient } from "@/lib/auth-guard";
import {
  enqueueBackgroundJob,
  triggerBackgroundJobRunner,
} from "@/lib/background-jobs";
import {
  buildInvalidMovementFileMessage,
  parseMovementFile,
} from "@/lib/movement-import";
import { createNotification } from "@/lib/notification-service";
import prisma from "@/lib/prisma";
import { resolvePatrimonialCategory } from "@/lib/patrimonial-statement";
import {
  completeImportBatch,
  failImportBatch,
  openImportBatch,
  rebuildStatements,
  updateImportBatchProgress,
} from "@/lib/statement-snapshots";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

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

    if (!(file instanceof File)) {
      return error("Arquivo obrigatorio", 400);
    }

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return error("Ano invalido", 400);
    }

    const parseResult = parseMovementFile(await file.arrayBuffer(), {
      forceType: "patrimonial",
    });
    if (parseResult.fileError) {
      return error(parseResult.fileError, 400);
    }

    const parsedRows = parseResult.rows;
    if (parsedRows.length === 0) {
      return error(buildInvalidMovementFileMessage(parseResult.layout), 400);
    }

    const importBatch = await openImportBatch({
      accountingId: auth.accountingId,
      clientId: auth.clientId,
      year,
      kind: "client_patrimonial_upload",
      fileName: file.name,
      batchIndex: 0,
    });
    importBatchId = importBatch.id;

    const [
      globalAccounts,
      clientAccounts,
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

      const resolvedCategory = resolvePatrimonialCategory({
        movement,
        chartAccount,
        mapping: patrimonialMappings.get(row.code) ?? null,
      });

      return {
        ...row,
        category: row.category || resolvedCategory || undefined,
      };
    });

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

    await updateImportBatchProgress({
      batchId: importBatch.id,
      processedRows: results.length,
    });

    const client = await prisma.client.findUnique({
      where: { id: auth.clientId },
      select: { name: true },
    });

    await createNotification({
      accountingId: auth.accountingId,
      audience: "staff",
      kind: "arquivos",
      title: "Novo balancete patrimonial recebido",
      description: `${client?.name ?? "Cliente"} enviou ${file.name} para o ano ${year}.`,
      clientId: auth.clientId,
      entityType: "patrimonial_import",
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
          source: "client_patrimonial_import",
        },
        importBatchId: importBatch.id,
      });

      await triggerBackgroundJobRunner({
        origin: new URL(request.url).origin,
        limit: 1,
      });

      return success({
        imported: results.length,
        year,
        valuesMode: "monthly",
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
        valuesMode: "monthly",
        status: "ready",
        batchId: importBatch.id,
        jobId: null,
      });
    }
  } catch (err) {
    await failImportBatch({
      batchId: importBatchId,
      errorMessage:
        err instanceof Error ? err.message : "Falha ao importar o Patrimonial",
    });
    return handleError(err);
  }
}
