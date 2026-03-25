import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { createAuthSession } from "@/lib/auth-sessions";
import { setStaffCookies } from "@/lib/auth-cookies";
import { recordAuditEvent } from "@/lib/audit";
import { success, handleError, getClientIp, getUserAgent } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    // Check if accounting or email already exists
    const existingAccounting = await prisma.accounting.findFirst({
      where: { OR: [{ cnpj: data.cnpj }, { email: data.email }] },
    });
    if (existingAccounting) {
      return success({ error: "CNPJ ou email já cadastrado" }, 409);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      return success({ error: "Email já cadastrado" }, 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create accounting + admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const accounting = await tx.accounting.create({
        data: {
          name: data.accountingName,
          cnpj: data.cnpj,
          email: data.email,
          phone: data.phone ?? null,
        },
      });

      const user = await tx.user.create({
        data: {
          accounting_id: accounting.id,
          name: data.userName,
          email: data.email,
          password_hash: passwordHash,
          role: "admin",
        },
      });

      return { accounting, user };
    });

    // Create auth session
    const ip = getClientIp(request);
    const ua = getUserAgent(request);
    const tokens = await createAuthSession({
      subjectType: "staff",
      role: "admin",
      userId: result.user.id,
      accountingId: result.accounting.id,
      ipAddress: ip,
      userAgent: ua,
    });

    // Set cookies
    await setStaffCookies(tokens.accessToken, tokens.refreshToken);

    // Audit
    await recordAuditEvent({
      actorType: "staff",
      actorRole: "admin",
      actorId: result.user.id,
      accountingId: result.accounting.id,
      action: "register",
      entityType: "accounting",
      entityId: result.accounting.id,
      ipAddress: ip,
      userAgent: ua,
    });

    return success(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
        accounting: {
          id: result.accounting.id,
          name: result.accounting.name,
        },
        accessToken: tokens.accessToken,
      },
      201
    );
  } catch (err) {
    return handleError(err);
  }
}
