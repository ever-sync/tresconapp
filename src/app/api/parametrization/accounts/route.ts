import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, handleError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
    const kind = request.nextUrl.searchParams.get("kind")?.trim() ?? "";
    const target = request.nextUrl.searchParams.get("target")?.trim() ?? "";
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(10, Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "30", 10) || 30)
    );
    const textFilter: Prisma.ChartOfAccountsWhereInput[] | undefined = query
      ? [
          { code: { contains: query, mode: "insensitive" as const } },
          { reduced_code: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ]
      : undefined;

    const where: Prisma.ChartOfAccountsWhereInput = {
      accounting_id: auth.accountingId,
      client_id: null,
      ...(kind === "dre"
        ? { report_type: "dre" }
        : kind === "patrimonial"
          ? { report_type: "patrimonial" }
          : {}),
      ...(textFilter ? { OR: textFilter } : {}),
    };

    const [total, accounts] = await Promise.all([
      prisma.chartOfAccounts.count({ where }),
      prisma.chartOfAccounts.findMany({
        where,
        select: {
          id: true,
          code: true,
          reduced_code: true,
          name: true,
          report_category: true,
          report_type: true,
          level: true,
        },
        orderBy: [{ level: "asc" }, { code: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return success({
      target,
      accounts: accounts.map((account) => ({
        id: account.id,
        code: account.code,
        reducedCode: account.reduced_code,
        name: account.name,
        reportCategory: account.report_category,
        reportType: account.report_type,
        level: account.level,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
