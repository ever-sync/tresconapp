import { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireClient, requireStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";

const audienceSchema = z.enum(["staff", "client"]);
const updateSchema = z.object({
  is_read: z.boolean(),
});

function mapNotification(notification: {
  id: string;
  kind: string;
  title: string;
  description: string;
  created_at: Date;
  is_read: boolean;
}) {
  return {
    id: notification.id,
    kind: notification.kind === "sistema" ? "sistema" : "arquivos",
    title: notification.title,
    description: notification.description,
    timestamp: notification.created_at.toISOString(),
    unread: !notification.is_read,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const audienceParam = request.nextUrl.searchParams.get("audience");
    const audienceResult = audienceSchema.safeParse(audienceParam);
    if (!audienceResult.success) {
      return error("Audience invalido", 400);
    }

    const audience = audienceResult.data;
    const auth =
      audience === "staff" ? await requireStaff() : await requireClient();
    const body = updateSchema.parse(await request.json());
    const { id } = await params;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        accounting_id: auth.accountingId,
        audience,
        ...(audience === "client" ? { client_id: auth.clientId ?? undefined } : {}),
      },
    });

    if (!notification) {
      return error("Notificacao nao encontrada", 404);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        is_read: body.is_read,
        read_at: body.is_read ? new Date() : null,
      },
    });

    return success({ notification: mapNotification(updated) });
  } catch (err) {
    return handleError(err);
  }
}
