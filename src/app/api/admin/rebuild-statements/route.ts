import { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import { rebuildStatements } from "@/lib/statement-snapshots";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

const bodySchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  statementType: z.enum(["dre", "patrimonial", "dfc", "all"]).default("all"),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole("admin");
    const body = bodySchema.parse(await request.json());

    const client = await prisma.client.findFirst({
      where: {
        id: body.clientId,
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!client) {
      return error("Cliente nao encontrado", 404);
    }

    const rebuilt = await rebuildStatements({
      accountingId: auth.accountingId,
      clientId: body.clientId,
      year: body.year,
      statementType: body.statementType,
    });

    return success({
      rebuilt: body.statementType,
      clientId: body.clientId,
      year: body.year,
      data: rebuilt,
    });
  } catch (err) {
    return handleError(err);
  }
}
