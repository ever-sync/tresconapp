import prisma from "./prisma";

interface AuditInput {
  actorType?: "staff" | "client" | "system";
  actorRole?: string;
  actorId?: string;
  accountingId?: string;
  clientId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record an audit event. Fire-and-forget (does not throw on failure).
 */
export async function recordAuditEvent(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actor_type: input.actorType,
        actor_role: input.actorRole,
        actor_id: input.actorId,
        accounting_id: input.accountingId,
        client_id: input.clientId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        metadata: input.metadata ?? undefined,
        request_id: input.requestId,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
      },
    });
  } catch (error) {
    console.error("[audit] Failed to record event:", error);
  }
}
