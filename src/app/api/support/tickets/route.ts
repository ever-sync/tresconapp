import { NextRequest } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireClient, requireStaff } from "@/lib/auth-guard";
import { success, error, handleError } from "@/lib/api-response";
import { createNotification } from "@/lib/notification-service";

const audienceSchema = z.enum(["staff", "client"]);

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function mapTicket(ticket: {
  id: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
  client: { id: string; name: string; cnpj: string };
  messages: Array<{
    id: string;
    author_role: string;
    author_name: string;
    body: string;
    created_at: Date;
  }>;
  documents: Array<{
    id: string;
    created_by_role: string;
    created_by_name: string;
    created_at: Date;
    document: {
      id: string;
      display_name: string;
      category: string;
      description: string | null;
      original_name: string;
      mime_type: string;
      size_bytes: number;
    };
  }>;
  unreadCount: number;
}) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    message: ticket.message,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.created_at.toISOString(),
    updatedAt: ticket.updated_at.toISOString(),
    closedAt: ticket.closed_at ? ticket.closed_at.toISOString() : null,
    client: ticket.client,
    unreadCount: ticket.unreadCount,
    messages: ticket.messages.map((message) => ({
      id: message.id,
      authorRole:
        message.author_role === "staff"
          ? "staff"
          : message.author_role === "client"
            ? "client"
            : "system",
      authorName: message.author_name,
      body: message.body,
      createdAt: message.created_at.toISOString(),
    })),
    documents: ticket.documents.map((document) => ({
      id: document.id,
      documentId: document.document.id,
      authorRole: document.created_by_role === "staff" ? "staff" : "client",
      authorName: document.created_by_name,
      title: document.document.display_name,
      category: document.document.category,
      description: document.document.description ?? document.document.original_name,
      mimeType: document.document.mime_type,
      size: formatSize(document.document.size_bytes),
      createdAt: document.created_at.toISOString(),
    })),
  };
}

async function loadUnreadCounts(
  accountingId: string,
  audience: "staff" | "client",
  clientId?: string
) {
  const notifications = await prisma.notification.findMany({
    where: {
      accounting_id: accountingId,
      audience,
      entity_type: "support_ticket",
      ...(audience === "client" ? { client_id: clientId } : {}),
      is_read: false,
    },
    select: { entity_id: true },
  });

  const counts = new Map<string, number>();
  for (const notification of notifications) {
    if (!notification.entity_id) continue;
    counts.set(notification.entity_id, (counts.get(notification.entity_id) ?? 0) + 1);
  }
  return counts;
}

export async function GET(request: NextRequest) {
  try {
    const audienceParam = request.nextUrl.searchParams.get("audience");
    const audienceResult = audienceSchema.safeParse(audienceParam);
    if (!audienceResult.success) {
      return error("Audience invalido", 400);
    }

    const audience = audienceResult.data;
    const auth = audience === "staff" ? await requireStaff() : await requireClient();
    const clientId = auth.clientId;

    if (audience === "client" && !clientId) {
      return error("Cliente nao encontrado", 404);
    }

    const tickets = await prisma.supportTicket.findMany({
      where:
        audience === "staff"
          ? { accounting_id: auth.accountingId }
          : { accounting_id: auth.accountingId, client_id: clientId },
      orderBy: { updated_at: "desc" },
      include: {
        client: {
          select: { id: true, name: true, cnpj: true },
        },
        messages: {
          orderBy: { created_at: "asc" },
        },
        documents: {
          orderBy: { created_at: "asc" },
          include: {
            document: {
              select: {
                id: true,
                display_name: true,
                category: true,
                description: true,
                original_name: true,
                mime_type: true,
                size_bytes: true,
              },
            },
          },
        },
      },
    });

    const unreadCounts = await loadUnreadCounts(
      auth.accountingId,
      audience,
      audience === "client" ? clientId : undefined
    );

    return success({
      tickets: tickets.map((ticket) =>
        mapTicket({
          ...ticket,
          unreadCount: unreadCounts.get(ticket.id) ?? 0,
        })
      ),
    });
  } catch (err) {
    return handleError(err);
  }
}

const createTicketSchema = z.object({
  subject: z.string().min(3),
  message: z.string().min(3),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireClient();
    const clientId = auth.clientId;
    if (!clientId) {
      return error("Cliente nao encontrado", 404);
    }
    const body = createTicketSchema.parse(await request.json());

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, cnpj: true },
    });

    if (!client) {
      return error("Cliente nao encontrado", 404);
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        accounting_id: auth.accountingId,
        client_id: clientId,
        subject: body.subject,
        message: body.message,
        priority: body.priority,
        status: "open",
      },
      include: {
        client: {
          select: { id: true, name: true, cnpj: true },
        },
      },
    });

    const message = await prisma.supportTicketMessage.create({
      data: {
        support_ticket_id: ticket.id,
        author_role: "client",
        author_name: client.name,
        body: body.message,
      },
    });

    await createNotification({
      accountingId: auth.accountingId,
      audience: "staff",
      kind: "sistema",
      title: "Novo chamado aberto",
      description: `${client.name} abriu o chamado "${body.subject}".`,
      clientId,
      entityType: "support_ticket",
      entityId: ticket.id,
    });

    return success({
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        message: ticket.message,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.created_at.toISOString(),
        updatedAt: ticket.updated_at.toISOString(),
        closedAt: ticket.closed_at ? ticket.closed_at.toISOString() : null,
        client: ticket.client,
        unreadCount: 0,
        messages: [
          {
            id: message.id,
            authorRole: "client" as const,
            authorName: message.author_name,
            body: message.body,
            createdAt: message.created_at.toISOString(),
          },
        ],
        documents: [],
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
