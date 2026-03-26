import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { authenticateClient, authenticateStaff, AuthError } from "@/lib/auth-guard";
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

async function resolveActor() {
  const staff = await authenticateStaff();
  if (staff) {
    return { audience: "staff" as const, auth: staff };
  }

  const client = await authenticateClient();
  if (client) {
    return { audience: "client" as const, auth: client };
  }

  throw new AuthError("Nao autenticado", 401);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await resolveActor();
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return error("Arquivo obrigatorio", 400);
    }

    const description = String(formData.get("description") ?? "").trim();
    const displayName = String(formData.get("displayName") ?? file.name).trim() || file.name;
    const category = String(formData.get("category") ?? "Suporte").trim() || "Suporte";

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id,
        accounting_id: actor.auth.accountingId,
        ...(actor.audience === "client" && actor.auth.clientId
          ? { client_id: actor.auth.clientId }
          : {}),
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

    if (!ticket) {
      return error("Chamado nao encontrado", 404);
    }

    const authorName =
      actor.audience === "staff"
        ? (
            await prisma.user.findUnique({
              where: { id: actor.auth.userId },
              select: { name: true },
            })
          )?.name ?? "Equipe TresContas"
        : ticket.client.name;

    const document = await prisma.clientDocument.create({
      data: {
        accounting_id: actor.auth.accountingId,
        client_id: ticket.client_id,
        original_name: file.name,
        display_name: displayName,
        category,
        document_type: "support_ticket",
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content: Buffer.from(await file.arrayBuffer()),
        description: description || file.name,
        viewed_at: null,
      },
    });

    await prisma.supportTicketDocument.create({
      data: {
        support_ticket_id: ticket.id,
        client_document_id: document.id,
        created_by_role: actor.audience,
        created_by_name: authorName,
      },
    });

    await prisma.supportTicketMessage.create({
      data: {
        support_ticket_id: ticket.id,
        author_role: "system",
        author_name: "Sistema TresContas",
        body: `Arquivo anexado: ${displayName}.`,
      },
    });

    await createNotification({
      accountingId: actor.auth.accountingId,
      audience: actor.audience === "staff" ? "client" : "staff",
      kind: "arquivos",
      title: "Novo anexo no chamado",
      description: `${authorName} anexou ${displayName} ao chamado "${ticket.subject}".`,
      clientId: ticket.client_id,
      entityType: "support_ticket",
      entityId: ticket.id,
    });

    return success({
      attachment: {
        id: document.id,
        title: document.display_name,
        category: document.category,
        description: document.description,
        size: formatSize(document.size_bytes),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
