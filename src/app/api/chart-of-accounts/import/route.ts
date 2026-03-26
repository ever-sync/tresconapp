import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { recordAuditEvent } from "@/lib/audit";
import { success, handleError, getClientIp, getUserAgent } from "@/lib/api-response";
import {
  bumpAccountingMappingVersion,
  completeImportBatch,
  failImportBatch,
  openImportBatch,
  updateImportBatchProgress,
} from "@/lib/statement-snapshots";

/**
 * Batch import of Chart of Accounts.
 * Same chunked pattern: frontend parses Excel, sends batches of ~500.
 */

const accountRowSchema = z.object({
  code: z.string().min(1),
  reduced_code: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(["A", "S"]).default("A"),
  parent_id: z.string().optional(),
  is_analytic: z.boolean().default(true),
  level: z.number().int().min(1).default(1),
  alias: z.string().optional(),
  report_type: z.enum(["dre", "patrimonial"]).optional(),
  report_category: z.string().optional(),
});

const batchImportSchema = z.object({
  client_id: z.string().uuid().optional(), // null = global for accounting
  rows: z.array(accountRowSchema).min(1).max(1000),
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

    // If client_id provided, verify ownership
    if (data.client_id) {
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
    }

    const importBatch = await openImportBatch({
      accountingId: auth.accountingId,
      clientId: data.client_id,
      kind: data.client_id ? "chart_of_accounts_client" : "chart_of_accounts_global",
      batchIndex: data.batch_index,
    });
    importBatchId = importBatch.id;

    // Upsert by accounting_id + code (unique constraint)
    const results = await prisma.$transaction(
      data.rows.map((row) =>
        prisma.chartOfAccounts.upsert({
          where: {
            accounting_id_code: {
              accounting_id: auth.accountingId,
              code: row.code,
            },
          },
          update: {
            name: row.name,
            reduced_code: row.reduced_code,
            type: row.type,
            is_analytic: row.is_analytic,
            level: row.level,
            alias: row.alias,
            report_type: row.report_type,
            report_category: row.report_category,
            client_id: data.client_id,
          },
          create: {
            accounting_id: auth.accountingId,
            client_id: data.client_id,
            code: row.code,
            reduced_code: row.reduced_code,
            name: row.name,
            type: row.type,
            is_analytic: row.is_analytic,
            level: row.level,
            alias: row.alias,
            report_type: row.report_type,
            report_category: row.report_category,
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
      if (!data.client_id) {
        await bumpAccountingMappingVersion(auth.accountingId);
      }

      await recordAuditEvent({
        actorType: "staff",
        actorRole: auth.role,
        actorId: auth.userId,
        accountingId: auth.accountingId,
        clientId: data.client_id,
        action: "import_chart_of_accounts",
        entityType: "chart_of_accounts",
        metadata: {
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
      errorMessage: err instanceof Error ? err.message : "Falha ao importar plano de contas",
    });
    return handleError(err);
  }
}
