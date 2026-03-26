import { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import { createNotification } from "@/lib/notification-service";

const updateSchema = z.object({
  status: z.enum(["open", "in_progress", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff();
    const body = updateSchema.parse(await request.json());
    const { id } = await params;

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id,
        accounting_id: auth.accountingId,
      },
      include: {
        client: {
          select: { id: true, name: true, cnpj: true },
        },
      },
    });

    if (!ticket) {
      return error("Chamado nao encontrado", 404);
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: body.status ?? ticket.status,
        priority: body.priority ?? ticket.priority,
        closed_at:
          body.status === "closed"
            ? new Date()
            : body.status === "open"
              ? null
              : ticket.closed_at,
      },
    });

    const statusLabel =
      body.status === "open"
        ? "Aberto"
        : body.status === "in_progress"
          ? "Em atendimento"
          : body.status === "closed"
            ? "Resolvido"
            : null;
    const priorityLabel =
      body.priority === "low"
        ? "Baixa"
        : body.priority === "medium"
          ? "Media"
          : body.priority === "high"
            ? "Alta"
            : null;

    const historyParts: string[] = [];
    if (statusLabel) {
      historyParts.push(`Status alterado para ${statusLabel}.`);
    }
    if (priorityLabel) {
      historyParts.push(`Prioridade alterada para ${priorityLabel}.`);
    }

    if (historyParts.length > 0) {
      await prisma.supportTicketMessage.create({
        data: {
          support_ticket_id: ticket.id,
          author_role: "system",
          author_name: "Sistema TresContas",
          body: historyParts.join(" "),
        },
      });
    }

    if (body.status) {
      await createNotification({
        accountingId: auth.accountingId,
        audience: "client",
        kind: "sistema",
        title: "Chamado atualizado",
        description: `O chamado "${ticket.subject}" foi atualizado para ${body.status}.`,
        clientId: ticket.client.id,
        entityType: "support_ticket",
        entityId: ticket.id,
      });
    }

    return success({
      ticket: {
        id: updated.id,
        subject: updated.subject,
        priority: updated.priority,
        status: updated.status,
        closedAt: updated.closed_at ? updated.closed_at.toISOString() : null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
