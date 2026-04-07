import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

import { error, handleError, success } from "@/lib/api-response";
import { requireStaff } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { updateClientSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

function optionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeUpdatePayload(body: Record<string, unknown>) {
  return {
    name: optionalString(body.name ?? body.companyName),
    cnpj: optionalString(body.cnpj),
    email: optionalString(body.email),
    phone: optionalString(body.phone),
    industry: optionalString(body.industry),
    address: optionalString(body.address),
    tax_regime:
      optionalString(body.tax_regime) ??
      (optionalString(body.taxRegime)
        ? String(body.taxRegime).trim().toLowerCase().includes("presum")
          ? "presumido"
          : String(body.taxRegime).trim().toLowerCase().includes("real")
            ? "real"
            : String(body.taxRegime).trim().toLowerCase().includes("mei")
              ? "mei"
              : "simples"
        : undefined),
    representative_name: optionalString(body.representative_name ?? body.representativeName),
    representative_email: optionalString(body.representative_email ?? body.accessEmail),
    password: optionalString(body.password),
    status: optionalString(body.status),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const payload = sanitizeUpdatePayload(body);

    const existingClient = await prisma.client.findFirst({
      where: {
        id,
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      select: { id: true, cnpj: true },
    });

    if (!existingClient) {
      return error("Cliente nao encontrado", 404);
    }

    const data = updateClientSchema.parse({
      name: payload.name,
      cnpj: payload.cnpj,
      email: payload.email,
      phone: payload.phone,
      industry: payload.industry,
      address: payload.address,
      tax_regime: payload.tax_regime,
      representative_name: payload.representative_name,
      representative_email: payload.representative_email,
    });

    if (payload.cnpj && payload.cnpj !== existingClient.cnpj) {
      const duplicated = await prisma.client.findUnique({
        where: { cnpj: payload.cnpj.replace(/\D/g, "") },
        select: { id: true },
      });

      if (duplicated && duplicated.id !== id) {
        return error("CNPJ ja cadastrado", 409);
      }
    }

    const nextStatus =
      payload.status === "active" || payload.status === "inactive"
        ? payload.status
        : undefined;

    const passwordHash = payload.password
      ? await bcrypt.hash(payload.password, 12)
      : undefined;

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: data.name,
        cnpj: data.cnpj,
        email: data.email === undefined ? undefined : data.email ?? null,
        phone: data.phone === undefined ? undefined : data.phone ?? null,
        industry: data.industry === undefined ? undefined : data.industry ?? null,
        address: data.address === undefined ? undefined : data.address ?? null,
        tax_regime:
          data.tax_regime === undefined ? undefined : data.tax_regime ?? null,
        representative_name:
          data.representative_name === undefined
            ? undefined
            : data.representative_name ?? null,
        representative_email:
          data.representative_email === undefined
            ? undefined
            : data.representative_email ?? null,
        password_hash: passwordHash,
        status: nextStatus,
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        industry: true,
        address: true,
        status: true,
        tax_regime: true,
        representative_name: true,
        representative_email: true,
        created_at: true,
        updated_at: true,
      },
    });

    return success({
      client: {
        ...client,
        active: client.status === "active",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff();
    const { id } = await params;

    const existingClient = await prisma.client.findFirst({
      where: {
        id,
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!existingClient) {
      return error("Cliente nao encontrado", 404);
    }

    await prisma.$transaction([
      prisma.authSession.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.accountActionToken.deleteMany({
        where: {
          client_id: id,
        },
      }),
      prisma.auditEvent.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.consultativeReportSignal.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.dFCLineMapping.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.dREMapping.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.patrimonialMapping.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.chartOfAccounts.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.monthlyMovement.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.statementSnapshot.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.importBatch.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.backgroundJob.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.notification.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.supportTicket.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.clientDocument.deleteMany({
        where: {
          accounting_id: auth.accountingId,
          client_id: id,
        },
      }),
      prisma.client.delete({
        where: {
          id,
        },
      }),
    ]);

    return success({
      deleted: true,
      clientId: id,
      clientName: existingClient.name,
    });
  } catch (err) {
    return handleError(err);
  }
}
