import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, handleError } from "@/lib/api-response";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 200), 200);
    const query = searchParams.get("query")?.trim() ?? "";

    const where = {
      accounting_id: auth.accountingId,
      client_id: null,
      ...(query
        ? {
            OR: [
              { code: { contains: query, mode: "insensitive" as const } },
              { reduced_code: { contains: query, mode: "insensitive" as const } },
              { name: { contains: query, mode: "insensitive" as const } },
              { report_category: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.chartOfAccounts.count({ where }),
      prisma.chartOfAccounts.findMany({
        where,
        orderBy: [{ level: "asc" }, { code: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          code: true,
          reduced_code: true,
          level: true,
          name: true,
          report_category: true,
          report_type: true,
        },
      }),
    ]);

    return success({
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      rows: rows.map((row) => ({
        id: row.id,
        code: row.code,
        reducedCode: row.reduced_code ?? "-",
        level: row.level,
        type: row.level >= 5 ? "A" : "T",
        description: row.name,
        alias: row.report_category ?? "-",
        report: row.report_type ?? "Balanco Patrimonial",
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
