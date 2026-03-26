import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

import { error, handleError, success } from "@/lib/api-response";
import { requireStaff } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { createClientSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

function optionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeClientPayload(body: Record<string, unknown>) {
  return {
    name: String(body.name ?? body.companyName ?? ""),
    cnpj: String(body.cnpj ?? ""),
    email: optionalString(body.email),
    phone: optionalString(body.phone),
    industry: optionalString(body.industry),
    address: optionalString(body.address),
    tax_regime:
      optionalString(body.tax_regime) ??
      (String(body.taxRegime ?? "")
        .trim()
        .toLowerCase()
        .includes("presum")
        ? "presumido"
        : String(body.taxRegime ?? "")
            .trim()
            .toLowerCase()
            .includes("real")
          ? "real"
          : String(body.taxRegime ?? "")
              .trim()
              .toLowerCase()
              .includes("mei")
            ? "mei"
            : optionalString(body.taxRegime)
              ? "simples"
              : undefined),
    representative_name: optionalString(body.representative_name ?? body.representativeName),
    representative_email: optionalString(body.representative_email ?? body.accessEmail),
    password: optionalString(body.password),
  };
}

export async function GET() {
  try {
    const auth = await requireStaff();

    const clients = await prisma.client.findMany({
      where: {
        accounting_id: auth.accountingId,
        deleted_at: null,
      },
      orderBy: [{ created_at: "desc" }],
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
      clients: clients.map((client) => ({
        ...client,
        active: client.status === "active",
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const body = (await request.json()) as Record<string, unknown>;
    const payload = sanitizeClientPayload(body);
    const data = createClientSchema.parse(payload);

    if (!payload.password) {
      return error("Senha do cliente obrigatoria", 400);
    }

    const existingClient = await prisma.client.findUnique({
      where: { cnpj: data.cnpj },
      select: { id: true, accounting_id: true, deleted_at: true },
    });

    if (existingClient && !existingClient.deleted_at) {
      return error("CNPJ ja cadastrado", 409);
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    const client = existingClient
      ? await prisma.client.update({
          where: { id: existingClient.id },
          data: {
            accounting_id: auth.accountingId,
            name: data.name,
            cnpj: data.cnpj,
            email: data.email ?? null,
            phone: data.phone ?? null,
            industry: data.industry ?? null,
            address: data.address ?? null,
            tax_regime: data.tax_regime ?? null,
            representative_name: data.representative_name ?? null,
            representative_email: data.representative_email ?? null,
            password_hash: passwordHash,
            status: "active",
            deleted_at: null,
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
        })
      : await prisma.client.create({
          data: {
            accounting_id: auth.accountingId,
            name: data.name,
            cnpj: data.cnpj,
            email: data.email ?? null,
            phone: data.phone ?? null,
            industry: data.industry ?? null,
            address: data.address ?? null,
            tax_regime: data.tax_regime ?? null,
            representative_name: data.representative_name ?? null,
            representative_email: data.representative_email ?? null,
            password_hash: passwordHash,
            status: "active",
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

    return success(
      {
        client: {
          ...client,
          active: client.status === "active",
        },
      },
      201
    );
  } catch (err) {
    return handleError(err);
  }
}
