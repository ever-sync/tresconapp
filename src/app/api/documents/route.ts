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

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 50), 100);
    const query = searchParams.get("query")?.trim() ?? "";

    const clientWhere = {
      accounting_id: auth.accountingId,
      deleted_at: null,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { cnpj: { contains: query, mode: "insensitive" as const } },
              { industry: { contains: query, mode: "insensitive" as const } },
              {
                documents: {
                  some: {
                    deleted_at: null,
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

    const [total, clients, unreadCounts, documentCounts] = await Promise.all([
      prisma.client.count({
        where: clientWhere,
      }),
      prisma.client.findMany({
        where: clientWhere,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          documents: {
            where: { deleted_at: null },
            orderBy: { created_at: "desc" },
          },
        },
      }),
      prisma.clientDocument.groupBy({
        by: ["client_id"],
        where: {
          accounting_id: auth.accountingId,
          deleted_at: null,
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
          deleted_at: null,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const unreadMap = new Map(
      unreadCounts.map((item) => [item.client_id, item._count._all])
    );
    const documentCountMap = new Map(
      documentCounts.map((item) => [item.client_id, item._count._all])
    );

    return success({
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name,
        cnpj: client.cnpj,
        industry: client.industry ?? "Sem categoria",
        unreadCount: unreadMap.get(client.id) ?? 0,
        documentCount: documentCountMap.get(client.id) ?? 0,
        documents: client.documents.map((document) => ({
          id: document.id,
          title: document.display_name,
          category: document.category,
          description:
            document.description ??
            document.original_name ??
            document.display_name,
          sentAt: document.created_at.toISOString(),
          size: formatSize(document.size_bytes),
          mimeType: document.mime_type,
          viewed: Boolean(document.viewed_at),
        })),
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
