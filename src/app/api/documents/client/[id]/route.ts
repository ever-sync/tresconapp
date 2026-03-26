import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff();
    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 50), 100);
    const query = searchParams.get("query")?.trim() ?? "";

    const client = await prisma.client.findFirst({
      where: {
        id,
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        industry: true,
      },
    });

    if (!client) {
      return error("Cliente nao encontrado", 404);
    }

    const where = {
      accounting_id: auth.accountingId,
      client_id: id,
      deleted_at: null,
      ...(query
        ? {
            OR: [
              { display_name: { contains: query, mode: "insensitive" as const } },
              { category: { contains: query, mode: "insensitive" as const } },
              { description: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, unreadCount, documents] = await Promise.all([
      prisma.clientDocument.count({ where }),
      prisma.clientDocument.count({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
          deleted_at: null,
          viewed_at: null,
        },
      }),
      prisma.clientDocument.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return success({
      client: {
        id: client.id,
        name: client.name,
        cnpj: client.cnpj,
        industry: client.industry ?? "Sem categoria",
        unreadCount,
        documentCount: total,
      },
      documents: documents.map((document) => ({
        id: document.id,
        title: document.display_name,
        category: document.category,
        description:
          document.description ?? document.original_name ?? document.display_name,
        sentAt: document.created_at.toISOString(),
        size: formatSize(document.size_bytes),
        mimeType: document.mime_type,
        viewed: Boolean(document.viewed_at),
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
