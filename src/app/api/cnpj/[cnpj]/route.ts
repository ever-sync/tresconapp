import { NextRequest, NextResponse } from "next/server";

import { error, handleError } from "@/lib/api-response";

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function joinAddress(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

type CnpjLookupPayload = {
  companyName: string;
  industry: string;
  email: string;
  phone: string;
  address: string;
};

type SuccessCacheEntry = {
  data: CnpjLookupPayload;
  expiresAt: number;
};

type FailureCacheEntry = {
  message: string;
  status: number;
  expiresAt: number;
};

const CNPJ_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CNPJ_FAILURE_TTL_MS = 60 * 1000;

const cnpjLookupCache = new Map<string, SuccessCacheEntry>();
const cnpjLookupFailures = new Map<string, FailureCacheEntry>();
const cnpjLookupInFlight = new Map<string, Promise<CnpjLookupPayload>>();

class LookupError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "LookupError";
    this.status = status;
  }
}

function getFreshSuccessCacheEntry(digits: string) {
  const entry = cnpjLookupCache.get(digits);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cnpjLookupCache.delete(digits);
    return null;
  }

  return entry.data;
}

function setSuccessCacheEntry(digits: string, data: CnpjLookupPayload) {
  cnpjLookupCache.set(digits, {
    data,
    expiresAt: Date.now() + CNPJ_CACHE_TTL_MS,
  });

  return data;
}

function getFreshFailureCacheEntry(digits: string) {
  const entry = cnpjLookupFailures.get(digits);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cnpjLookupFailures.delete(digits);
    return null;
  }

  return entry;
}

function setFailureCacheEntry(digits: string, status: number, message: string) {
  cnpjLookupFailures.set(digits, {
    status,
    message,
    expiresAt: Date.now() + CNPJ_FAILURE_TTL_MS,
  });
}

function clearFailureCacheEntry(digits: string) {
  cnpjLookupFailures.delete(digits);
}

function successWithCache(data: CnpjLookupPayload) {
  return NextResponse.json(data, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

async function fetchFromBrasilApi(digits: string) {
  let response: Response;

  try {
    response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new LookupError("A consulta do CNPJ demorou demais. Tente novamente.", 504);
    }

    throw new LookupError("Nao foi possivel consultar o CNPJ agora", 502);
  }

  if (response.status === 404) {
    throw new LookupError("CNPJ nao encontrado", 404);
  }

  if (!response.ok) {
    throw new LookupError("Nao foi possivel consultar o CNPJ agora", 502);
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

  return {
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
  } satisfies CnpjLookupPayload;
}

async function fetchFromCnpjWs(digits: string) {
  let response: Response;

  try {
    response = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new LookupError("A consulta do CNPJ demorou demais. Tente novamente.", 504);
    }

    throw new LookupError("Nao foi possivel consultar o CNPJ agora", 502);
  }

  if (response.status === 404) {
    throw new LookupError("CNPJ nao encontrado", 404);
  }

  if (!response.ok) {
    throw new LookupError("Nao foi possivel consultar o CNPJ agora", 502);
  }

  const payload = (await response.json()) as {
    razao_social?: string;
    estabelecimento?: {
      nome_fantasia?: string;
      email?: string;
      telefone1?: string;
      telefone2?: string;
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cep?: string;
      cidade?: { nome?: string };
      estado?: { sigla?: string };
      atividade_principal?: { descricao?: string };
    };
  };

  return {
    companyName: payload.razao_social || payload.estabelecimento?.nome_fantasia || "",
    industry: payload.estabelecimento?.atividade_principal?.descricao || "",
    email: payload.estabelecimento?.email || "",
    phone: payload.estabelecimento?.telefone1 || payload.estabelecimento?.telefone2 || "",
    address: joinAddress([
      joinAddress([
        payload.estabelecimento?.logradouro,
        payload.estabelecimento?.numero,
        payload.estabelecimento?.complemento,
      ]),
      payload.estabelecimento?.bairro,
      joinAddress([payload.estabelecimento?.cidade?.nome, payload.estabelecimento?.estado?.sigla]),
      payload.estabelecimento?.cep,
    ]),
  } satisfies CnpjLookupPayload;
}

async function fetchCnpjLookup(digits: string) {
  try {
    return await fetchFromBrasilApi(digits);
  } catch (primaryError) {
    try {
      return await fetchFromCnpjWs(digits);
    } catch (secondaryError) {
      if (secondaryError instanceof LookupError) {
        throw secondaryError;
      }

      if (primaryError instanceof LookupError) {
        throw primaryError;
      }

      throw secondaryError;
    }
  }
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

    const cached = getFreshSuccessCacheEntry(digits);
    if (cached) {
      return successWithCache(cached);
    }

    const recentFailure = getFreshFailureCacheEntry(digits);
    if (recentFailure) {
      return error(recentFailure.message, recentFailure.status);
    }

    const stale = cnpjLookupCache.get(digits)?.data;
    let lookupPromise = cnpjLookupInFlight.get(digits);

    if (!lookupPromise) {
      lookupPromise = fetchCnpjLookup(digits)
        .then((data) => {
          clearFailureCacheEntry(digits);
          return setSuccessCacheEntry(digits, data);
        })
        .finally(() => {
          cnpjLookupInFlight.delete(digits);
        });
      cnpjLookupInFlight.set(digits, lookupPromise);
    }

    try {
      return successWithCache(await lookupPromise);
    } catch (err) {
      if (stale) {
        return successWithCache(stale);
      }

      if (err instanceof LookupError) {
        setFailureCacheEntry(digits, err.status, err.message);
        return error(err.message, err.status);
      }

      throw err;
    }
  } catch (err) {
    return handleError(err);
  }
}
