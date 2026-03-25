import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { createAuthSession } from "@/lib/auth-sessions";
import { setStaffCookies } from "@/lib/auth-cookies";
import { recordAuditEvent } from "@/lib/audit";
import { success, error, handleError, getClientIp, getUserAgent } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { accounting: true },
    });

    if (!user) {
      return error("Credenciais inválidas", 401);
    }

    if (user.status !== "active") {
      return error("Conta desativada", 403);
    }

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
      return error("Credenciais inválidas", 401);
    }

    const ip = getClientIp(request);
    const ua = getUserAgent(request);

    const tokens = await createAuthSession({
      subjectType: "staff",
      role: user.role,
      userId: user.id,
      accountingId: user.accounting_id,
      ipAddress: ip,
      userAgent: ua,
    });

    await setStaffCookies(tokens.accessToken, tokens.refreshToken);

    await recordAuditEvent({
      actorType: "staff",
      actorRole: user.role,
      actorId: user.id,
      accountingId: user.accounting_id,
      action: "login",
      entityType: "user",
      entityId: user.id,
      ipAddress: ip,
      userAgent: ua,
    });

    return success({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accounting_id: user.accounting_id,
      },
      accounting: {
        id: user.accounting.id,
        name: user.accounting.name,
      },
      accessToken: tokens.accessToken,
    });
  } catch (err) {
    return handleError(err);
  }
}
