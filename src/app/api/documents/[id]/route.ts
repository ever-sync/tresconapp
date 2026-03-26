import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import { createNotification } from "@/lib/notification-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff();
    const { id } = await params;

    const document = await prisma.clientDocument.findFirst({
      where: {
        id,
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!document) {
      return error("Documento nao encontrado", 404);
    }

    const updated = await prisma.clientDocument.update({
      where: { id },
      data: {
        viewed_at: new Date(),
      },
    });

    const client = await prisma.client.findUnique({
      where: { id: updated.client_id },
      select: { id: true, name: true },
    });

    if (client) {
      await createNotification({
        accountingId: auth.accountingId,
        audience: "client",
        kind: "arquivos",
        title: "Documento visualizado",
        description: `A contabilidade visualizou ${updated.display_name}.`,
        clientId: client.id,
        entityType: "client_document",
        entityId: updated.id,
      });
    }

    return success({
      document: {
        id: updated.id,
        viewed: true,
        viewedAt: updated.viewed_at?.toISOString() ?? null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
