import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { clientLoginSchema } from "@/lib/validation";
import { createAuthSession } from "@/lib/auth-sessions";
import { setClientCookies } from "@/lib/auth-cookies";
import { recordAuditEvent } from "@/lib/audit";
import { success, error, handleError, getClientIp, getUserAgent } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = clientLoginSchema.parse(body);

    const client = await prisma.client.findUnique({
      where: { cnpj: data.cnpj },
      include: { accounting: true },
    });

    if (!client || !client.password_hash) {
      return error("Credenciais inválidas", 401);
    }

    if (client.status !== "active") {
      return error("Conta desativada", 403);
    }

    if (client.deleted_at) {
      return error("Conta removida", 403);
    }

    const valid = await bcrypt.compare(data.password, client.password_hash);
    if (!valid) {
      return error("Credenciais inválidas", 401);
    }

    const ip = getClientIp(request);
    const ua = getUserAgent(request);

    const tokens = await createAuthSession({
      subjectType: "client",
      role: "client",
      clientId: client.id,
      accountingId: client.accounting_id,
      ipAddress: ip,
      userAgent: ua,
    });

    await setClientCookies(tokens.accessToken, tokens.refreshToken);

    await recordAuditEvent({
      actorType: "client",
      actorRole: "client",
      actorId: client.id,
      accountingId: client.accounting_id,
      clientId: client.id,
      action: "client_login",
      entityType: "client",
      entityId: client.id,
      ipAddress: ip,
      userAgent: ua,
    });

    return success({
      client: {
        id: client.id,
        name: client.name,
        cnpj: client.cnpj,
        email: client.email,
        accounting_id: client.accounting_id,
      },
      accounting: {
        id: client.accounting.id,
        name: client.accounting.name,
      },
      accessToken: tokens.accessToken,
    });
  } catch (err) {
    return handleError(err);
  }
}
