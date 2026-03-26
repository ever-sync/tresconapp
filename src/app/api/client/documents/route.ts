import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireClient } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import { createNotification } from "@/lib/notification-service";

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function formatDocument(document: {
  id: string;
  display_name: string;
  category: string;
  description: string | null;
  original_name: string;
  created_at: Date;
  size_bytes: number;
  mime_type: string;
  viewed_at: Date | null;
}) {
  return {
    id: document.id,
    title: document.display_name,
    category: document.category,
    description: document.description ?? document.original_name,
    sentAt: document.created_at.toISOString(),
    size: formatSize(document.size_bytes),
    mimeType: document.mime_type,
    viewed: Boolean(document.viewed_at),
    viewedAt: document.viewed_at ? document.viewed_at.toISOString() : null,
  };
}

export async function GET() {
  try {
    const auth = await requireClient();
    const clientId = auth.clientId;
    if (!clientId) {
      return error("Cliente nao encontrado", 404);
    }

    const documents = await prisma.clientDocument.findMany({
      where: {
        accounting_id: auth.accountingId,
        client_id: clientId,
        deleted_at: null,
      },
      orderBy: { created_at: "desc" },
    });

    return success({
      documents: documents.map(formatDocument),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireClient();
    const clientId = auth.clientId;
    if (!clientId) {
      return error("Cliente nao encontrado", 404);
    }
    const formData = await request.formData();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return error("Arquivo obrigatorio", 400);
    }

    const category = String(formData.get("category") ?? "Geral").trim() || "Geral";
    const description = String(formData.get("description") ?? "").trim();
    const documentType = String(formData.get("documentType") ?? "general").trim() || "general";
    const displayName = String(formData.get("displayName") ?? file.name).trim() || file.name;
    const periodYearRaw = String(formData.get("periodYear") ?? "").trim();
    const periodMonthRaw = String(formData.get("periodMonth") ?? "").trim();
    const periodYear = periodYearRaw ? Number(periodYearRaw) : null;
    const periodMonth = periodMonthRaw ? Number(periodMonthRaw) : null;

    if (periodYearRaw && Number.isNaN(periodYear)) {
      return error("Ano do periodo invalido", 400);
    }

    if (periodMonthRaw && Number.isNaN(periodMonth)) {
      return error("Mes do periodo invalido", 400);
    }

    const created = await prisma.clientDocument.create({
      data: {
        accounting_id: auth.accountingId,
        client_id: clientId,
        original_name: file.name,
        display_name: displayName,
        category,
        document_type: documentType,
        period_year: periodYear,
        period_month: periodMonth,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content: Buffer.from(await file.arrayBuffer()),
        description: description || file.name,
        viewed_at: null,
      },
    });

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true },
    });

    await createNotification({
      accountingId: auth.accountingId,
      audience: "staff",
      kind: "arquivos",
      title: "Novo documento recebido",
      description: `${client?.name ?? "Cliente"} enviou ${displayName} (${category}).`,
      clientId,
      entityType: "client_document",
      entityId: created.id,
    });

    return success({
      document: formatDocument(created),
    });
  } catch (err) {
    return handleError(err);
  }
}
