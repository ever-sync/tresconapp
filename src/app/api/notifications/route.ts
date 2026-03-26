import { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireClient, requireStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";

const audienceSchema = z.enum(["staff", "client"]);

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

export async function GET(request: NextRequest) {
  try {
    const audienceParam = request.nextUrl.searchParams.get("audience");
    const audienceResult = audienceSchema.safeParse(audienceParam);
    if (!audienceResult.success) {
      return error("Audience invalido", 400);
    }

    const audience = audienceResult.data;
    const auth =
      audience === "staff" ? await requireStaff() : await requireClient();

    const notifications = await prisma.notification.findMany({
      where: {
        accounting_id: auth.accountingId,
        audience,
        ...(audience === "client" ? { client_id: auth.clientId ?? undefined } : {}),
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    return success({
      notifications: notifications.map(mapNotification),
    });
  } catch (err) {
    return handleError(err);
  }
}
