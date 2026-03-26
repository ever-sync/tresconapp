import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { authenticateClient, authenticateStaff, AuthError } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import { markNotificationsRead } from "@/lib/notification-service";

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

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await resolveActor();
    const { id } = await params;
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
      select: { id: true },
    });

    if (!ticket) {
      return error("Chamado nao encontrado", 404);
    }

    await markNotificationsRead({
      accountingId: actor.auth.accountingId,
      audience: actor.audience,
      clientId: actor.audience === "client" ? clientId : undefined,
      entityType: "support_ticket",
      entityId: ticket.id,
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
