import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireStaff, AuthError } from "@/lib/auth-guard";
import { createAuthSession } from "@/lib/auth-sessions";
import { setClientCookies } from "@/lib/auth-cookies";
import { recordAuditEvent } from "@/lib/audit";
import { getClientIp, getUserAgent, handleError } from "@/lib/api-response";

function getSafeRedirect(request: NextRequest, redirectTo: string | null) {
  if (!redirectTo || !redirectTo.startsWith("/portal")) {
    return new URL("/portal", request.url);
  }

  return new URL(redirectTo, request.url);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const clientId = request.nextUrl.searchParams.get("clientId");
    const redirectTo = request.nextUrl.searchParams.get("redirect");

    if (!clientId) {
      return NextResponse.redirect(new URL("/dashboard/clientes", request.url));
    }

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        accounting_id: auth.accountingId,
        deleted_at: null,
        status: "active",
      },
      select: {
        id: true,
        name: true,
        accounting_id: true,
      },
    });

    if (!client) {
      return NextResponse.redirect(new URL("/dashboard/clientes", request.url));
    }

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    const tokens = await createAuthSession({
      subjectType: "client",
      role: "client",
      clientId: client.id,
      accountingId: client.accounting_id,
      ipAddress,
      userAgent,
    });

    await setClientCookies(tokens.accessToken, tokens.refreshToken);

    await recordAuditEvent({
      actorType: "staff",
      actorRole: auth.role,
      actorId: auth.userId,
      accountingId: auth.accountingId,
      clientId: client.id,
      action: "staff_client_portal_access",
      entityType: "client",
      entityId: client.id,
      metadata: {
        clientName: client.name,
        via: "dashboard_clientes",
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.redirect(getSafeRedirect(request, redirectTo));
  } catch (err) {
    if (err instanceof AuthError && err.statusCode === 401) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return handleError(err);
  }
}
