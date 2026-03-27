import { NextRequest } from "next/server";

import { error, handleError, success } from "@/lib/api-response";

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function joinAddress(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ cnpj: string }> }
) {
  try {
    const { cnpj } = await context.params;
    const digits = normalizeDigits(cnpj);

    if (digits.length !== 14) {
      return error("CNPJ invalido", 400);
    }

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });

    if (response.status === 404) {
      return error("CNPJ nao encontrado", 404);
    }

    if (!response.ok) {
      return error("Nao foi possivel consultar o CNPJ agora", 502);
    }

    const payload = (await response.json()) as {
      razao_social?: string;
      nome_fantasia?: string;
      cnae_fiscal_descricao?: string;
      cep?: string;
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      ddd_telefone_1?: string;
      email?: string;
    };

    return success({
      companyName: payload.razao_social || payload.nome_fantasia || "",
      industry: payload.cnae_fiscal_descricao || "",
      email: payload.email || "",
      phone: payload.ddd_telefone_1 || "",
      address: joinAddress([
        joinAddress([payload.logradouro, payload.numero, payload.complemento]),
        payload.bairro,
        joinAddress([payload.municipio, payload.uf]),
        payload.cep,
      ]),
    });
  } catch (err) {
    return handleError(err);
  }
}
