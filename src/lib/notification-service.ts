import prisma from "@/lib/prisma";

type NotificationAudience = "staff" | "client";
type NotificationKind = "arquivos" | "sistema";

export async function createNotification(input: {
  accountingId: string;
  audience: NotificationAudience;
  kind: NotificationKind;
  title: string;
  description: string;
  clientId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  return prisma.notification.create({
    data: {
      accounting_id: input.accountingId,
      client_id: input.clientId ?? null,
      audience: input.audience,
      kind: input.kind,
      title: input.title,
      description: input.description,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    },
  });
}

export async function markNotificationsRead(input: {
  accountingId: string;
  audience: NotificationAudience;
  entityType?: string | null;
  entityId?: string | null;
  clientId?: string | null;
}) {
  return prisma.notification.updateMany({
    where: {
      accounting_id: input.accountingId,
      audience: input.audience,
      entity_type: input.entityType ?? undefined,
      entity_id: input.entityId ?? undefined,
      ...(input.audience === "client" ? { client_id: input.clientId ?? undefined } : {}),
      is_read: false,
    },
    data: {
      is_read: true,
      read_at: new Date(),
    },
  });
}
