import { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { authenticateClient, authenticateStaff, AuthError } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import { createNotification } from "@/lib/notification-service";

const messageSchema = z.object({
  body: z.string().min(1).max(4000),
});

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
    const body = messageSchema.parse(await request.json());
    const { id } = await params;
    const actor = await resolveActor();
    const clientId = actor.auth.clientId;

    if (actor.audience === "client" && !clientId) {
      return error("Cliente nao encontrado", 404);
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id,
        accounting_id: actor.auth.accountingId,
        ...(actor.audience === "client" ? { client_id: clientId } : {}),
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

    const message = await prisma.supportTicketMessage.create({
      data: {
        support_ticket_id: ticket.id,
        author_role: actor.audience,
        author_name: authorName,
        body: body.body,
      },
    });

    const nextStatus =
      actor.audience === "staff"
        ? ticket.status === "open"
          ? "in_progress"
          : ticket.status
        : ticket.status === "closed"
          ? "open"
          : ticket.status;

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: nextStatus },
    });

    if (nextStatus !== ticket.status) {
      const statusLabel =
        nextStatus === "open"
          ? "Aberto"
          : nextStatus === "in_progress"
            ? "Em atendimento"
            : "Resolvido";

      await prisma.supportTicketMessage.create({
        data: {
          support_ticket_id: ticket.id,
          author_role: "system",
          author_name: "Sistema TresContas",
          body: `Status alterado para ${statusLabel}.`,
        },
      });
    }

    await createNotification({
      accountingId: actor.auth.accountingId,
      audience: actor.audience === "staff" ? "client" : "staff",
      kind: "sistema",
      title: "Nova mensagem no chamado",
      description:
        actor.audience === "staff"
          ? `A equipe respondeu ao chamado "${ticket.subject}".`
          : `${ticket.client.name} enviou uma nova mensagem no chamado "${ticket.subject}".`,
      clientId: ticket.client.id,
      entityType: "support_ticket",
      entityId: ticket.id,
    });

    return success({
      message: {
        id: message.id,
        authorRole: message.author_role,
        authorName: message.author_name,
        body: message.body,
        createdAt: message.created_at.toISOString(),
      },
      status: nextStatus,
    });
  } catch (err) {
    return handleError(err);
  }
}
