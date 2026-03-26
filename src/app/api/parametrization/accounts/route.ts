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
    const textFilter: Prisma.ChartOfAccountsWhereInput[] | undefined = query
      ? [
          { code: { contains: query, mode: "insensitive" as const } },
          { reduced_code: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ]
      : undefined;

    const accounts = await prisma.chartOfAccounts.findMany({
      where: {
        accounting_id: auth.accountingId,
        client_id: null,
        ...(kind === "dre"
          ? { report_type: "dre" }
          : kind === "patrimonial"
            ? { report_type: "patrimonial" }
            : {}),
        ...(textFilter ? { OR: textFilter } : {}),
      },
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
      take: 20,
    });

    return success({
      accounts: accounts.map((account) => ({
        id: account.id,
        code: account.code,
        reducedCode: account.reduced_code,
        name: account.name,
        reportCategory: account.report_category,
        reportType: account.report_type,
        level: account.level,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
