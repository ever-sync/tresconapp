import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, handleError } from "@/lib/api-response";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseOrigin(value: string | null): "all" | "attachment" | "support_ticket" {
  if (value === "attachment" || value === "support_ticket") {
    return value;
  }
  return "all";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 50), 100);
    const query = searchParams.get("query")?.trim() ?? "";
    const origin = parseOrigin(searchParams.get("origin"));

    const documentTypeFilter =
      origin === "support_ticket"
        ? { equals: "support_ticket" }
        : origin === "attachment"
          ? { notIn: ["dfc_balancete_import", "support_ticket"] }
          : { not: "dfc_balancete_import" };

    const visibleDocumentFilter = {
      deleted_at: null,
      document_type: documentTypeFilter,
    };

    const where = {
      accounting_id: auth.accountingId,
      deleted_at: null,
      documents: {
        some: visibleDocumentFilter,
      },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { cnpj: { contains: query, mode: "insensitive" as const } },
              { industry: { contains: query, mode: "insensitive" as const } },
              {
                documents: {
                  some: {
                    ...visibleDocumentFilter,
                    OR: [
                      { display_name: { contains: query, mode: "insensitive" as const } },
                      { category: { contains: query, mode: "insensitive" as const } },
                      { description: { contains: query, mode: "insensitive" as const } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, clients, unreadCounts, documentCounts, latestDocuments] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          cnpj: true,
          industry: true,
        },
      }),
      prisma.clientDocument.groupBy({
        by: ["client_id"],
        where: {
          accounting_id: auth.accountingId,
          ...visibleDocumentFilter,
          viewed_at: null,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.clientDocument.groupBy({
        by: ["client_id"],
        where: {
          accounting_id: auth.accountingId,
          ...visibleDocumentFilter,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.clientDocument.findMany({
        where: {
          accounting_id: auth.accountingId,
          ...visibleDocumentFilter,
        },
        orderBy: { created_at: "desc" },
        select: {
          client_id: true,
          display_name: true,
          created_at: true,
          document_type: true,
        },
      }),
    ]);

    const unreadMap = new Map(unreadCounts.map((item) => [item.client_id, item._count._all]));
    const documentCountMap = new Map(
      documentCounts.map((item) => [item.client_id, item._count._all])
    );
    const latestDocumentMap = new Map<
      string,
      {
        title: string;
        sentAt: string;
        documentType: string;
      }
    >();

    for (const document of latestDocuments) {
      if (!latestDocumentMap.has(document.client_id)) {
        latestDocumentMap.set(document.client_id, {
          title: document.display_name,
          sentAt: document.created_at.toISOString(),
          documentType: document.document_type,
        });
      }
    }

    return success({
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name,
        cnpj: client.cnpj,
        industry: client.industry ?? "Sem categoria",
        unreadCount: unreadMap.get(client.id) ?? 0,
        documentCount: documentCountMap.get(client.id) ?? 0,
        latestDocument: latestDocumentMap.get(client.id) ?? null,
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
