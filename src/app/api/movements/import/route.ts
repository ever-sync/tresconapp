import { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { recordAuditEvent } from "@/lib/audit";
import { success, handleError, getClientIp, getUserAgent } from "@/lib/api-response";
import {
  convertAccumulatedToMonthly,
  resolveDreCategory,
} from "@/lib/dre-statement";
import { resolvePatrimonialCategory } from "@/lib/patrimonial-statement";
import {
  completeImportBatch,
  failImportBatch,
  openImportBatch,
  rebuildStatements,
  updateImportBatchProgress,
} from "@/lib/statement-snapshots";

/**
 * Batch import of movements.
 * Frontend parses the Excel and sends rows in batches of ~500.
 * Each request is fast (<3s) and fits within Vercel timeout.
 */

const movementRowSchema = z.object({
  code: z.string().min(1),
  reduced_code: z.string().optional(),
  name: z.string().min(1),
  level: z.number().int().min(1).default(1),
  values: z.array(z.number()).length(12), // Jan-Dec
  type: z.enum(["dre", "patrimonial"]),
  category: z.string().optional(),
  is_mapped: z.boolean().default(false),
});

const batchImportSchema = z.object({
  client_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  values_mode: z.enum(["monthly", "accumulated"]).default("monthly"),
  rows: z.array(movementRowSchema).min(1).max(1000),
  batch_index: z.number().int().min(0),
  total_batches: z.number().int().min(1),
});

export const runtime = "nodejs";
export const preferredRegion = "iad1";

export async function POST(request: NextRequest) {
  let importBatchId: string | undefined;
  try {
    const auth = await requireStaff();
    const body = await request.json();
    const data = batchImportSchema.parse(body);
    const kinds = new Set(data.rows.map((row) => row.type));
    const importKind =
      kinds.size === 1
        ? `${data.rows[0]?.type ?? "movements"}_movements`
        : "mixed_movements";

    const client = await prisma.client.findFirst({
      where: {
        id: data.client_id,
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
    });

    if (!client) {
      return success({ error: "Cliente não encontrado" }, 404);
    }

    const importBatch = await openImportBatch({
      accountingId: auth.accountingId,
      clientId: data.client_id,
      year: data.year,
      kind: importKind,
      batchIndex: data.batch_index,
    });
    importBatchId = importBatch.id;

    const [globalAccounts, clientAccounts, globalDreMappings, clientDreMappings, globalPatrimonialMappings, clientPatrimonialMappings] =
      await Promise.all([
        prisma.chartOfAccounts.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
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
          where: {
            accounting_id: auth.accountingId,
            client_id: data.client_id,
          },
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
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
          select: {
            account_code: true,
            category: true,
            client_id: true,
          },
        }),
        prisma.dREMapping.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: data.client_id,
          },
          select: {
            account_code: true,
            category: true,
            client_id: true,
          },
        }),
        prisma.patrimonialMapping.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: null,
          },
          select: {
            account_code: true,
            category: true,
            client_id: true,
          },
        }),
        prisma.patrimonialMapping.findMany({
          where: {
            accounting_id: auth.accountingId,
            client_id: data.client_id,
          },
          select: {
            account_code: true,
            category: true,
            client_id: true,
          },
        }),
      ]);

    const chartAccounts = new Map<string, (typeof globalAccounts)[number]>();
    for (const item of globalAccounts) {
      chartAccounts.set(item.code, item);
    }
    for (const item of clientAccounts) {
      chartAccounts.set(item.code, item);
    }

    const dreMappings = new Map<string, (typeof globalDreMappings)[number]>();
    for (const item of globalDreMappings) {
      dreMappings.set(item.account_code, item);
    }
    for (const item of clientDreMappings) {
      dreMappings.set(item.account_code, item);
    }

    const patrimonialMappings = new Map<string, (typeof globalPatrimonialMappings)[number]>();
    for (const item of globalPatrimonialMappings) {
      patrimonialMappings.set(item.account_code, item);
    }
    for (const item of clientPatrimonialMappings) {
      patrimonialMappings.set(item.account_code, item);
    }

    const normalizedRows = data.rows.map((row) => {
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
          data.values_mode === "accumulated"
            ? convertAccumulatedToMonthly(row.values)
            : row.values,
        category: row.category || resolvedCategory || undefined,
      };
    });

    const results = await prisma.$transaction(
      normalizedRows.map((row) =>
        prisma.monthlyMovement.upsert({
          where: {
            client_id_year_code_type: {
              client_id: data.client_id,
              year: data.year,
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
            client_id: data.client_id,
            year: data.year,
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

    if (data.batch_index === data.total_batches - 1) {
      await completeImportBatch({ batchId: importBatch.id });
      await rebuildStatements({
        accountingId: auth.accountingId,
        clientId: data.client_id,
        year: data.year,
        statementType: "all",
      });

      await recordAuditEvent({
        actorType: "staff",
        actorRole: auth.role,
        actorId: auth.userId,
        accountingId: auth.accountingId,
        clientId: data.client_id,
        action: "import_movements",
        entityType: "monthly_movement",
        metadata: {
          year: data.year,
          values_mode: data.values_mode,
          total_batches: data.total_batches,
          rows_in_last_batch: data.rows.length,
        },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });
    }

    return success({
      imported: results.length,
      batch_index: data.batch_index,
      total_batches: data.total_batches,
    });
  } catch (err) {
    await failImportBatch({
      batchId: importBatchId,
      errorMessage: err instanceof Error ? err.message : "Falha ao importar movimentacoes",
    });
    return handleError(err);
  }
}
