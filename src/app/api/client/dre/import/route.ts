import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { error, handleError, success } from "@/lib/api-response";
import { requireClient } from "@/lib/auth-guard";
import { createNotification } from "@/lib/notification-service";
import prisma from "@/lib/prisma";
import { enqueueBackgroundJob } from "@/lib/background-jobs";
import {
  convertAccumulatedToMonthly,
  resolveDreCategory,
} from "@/lib/dre-statement";
import { resolvePatrimonialCategory } from "@/lib/patrimonial-statement";
import {
  completeImportBatch,
  failImportBatch,
  openImportBatch,
  rebuildStatements,
  updateImportBatchProgress,
} from "@/lib/statement-snapshots";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

type ImportedRow = Record<string, unknown>;
type MovementType = "dre" | "patrimonial";
type ParsedMovementRow = {
  code: string;
  reduced_code?: string;
  name: string;
  level: number;
  values: number[];
  type: MovementType;
  category?: string;
  is_mapped: boolean;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRowValue(row: ImportedRow, aliases: string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    normalizeText(key),
    value,
  ] as const);

  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias);
    const found = normalizedEntries.find(([key]) => key === normalizedAlias);
    if (found) {
      return found[1];
    }
  }

  return "";
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = String(value ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferMovementType(code: string, rawType: string): MovementType {
  const normalizedType = normalizeText(rawType);
  if (normalizedType.includes("dre") || normalizedType.includes("resultado")) {
    return "dre";
  }

  if (normalizedType.includes("patrimonial") || normalizedType.includes("balanco")) {
    return "patrimonial";
  }

  const sanitizedCode = code.replace(/[^\d.]/g, "");
  if (sanitizedCode.startsWith("03") || sanitizedCode.startsWith("04")) {
    return "dre";
  }

  return "patrimonial";
}

function parseRows(rows: ImportedRow[]): ParsedMovementRow[] {
  const parsedRows: ParsedMovementRow[] = [];

  for (const row of rows) {
    const code = String(
      getRowValue(row, ["codigo", "código", "code", "conta"])
    ).trim();
    const reducedCode = String(
      getRowValue(row, [
        "cod red",
        "cód red",
        "codigo reduzido",
        "código reduzido",
        "classificacao",
        "classificação",
      ])
    ).trim();
    const name = String(
      getRowValue(row, [
        "nome",
        "descricao",
        "descrição",
        "conta descricao",
        "conta descrição",
      ])
    ).trim();
    const rawLevel = String(
      getRowValue(row, ["nivel", "nível", "niv", "level"])
    ).trim();
    const rawType = String(
      getRowValue(row, ["tipo", "type", "relatorio", "relatório"])
    ).trim();
    const category = String(getRowValue(row, ["categoria", "grupo"])).trim();

    if (!code || !name) {
      continue;
    }

    parsedRows.push({
      code,
      reduced_code: reducedCode || undefined,
      name,
      level: Number(rawLevel) || Math.max(1, code.split(".").length),
      values: [
        parseNumber(getRowValue(row, ["jan", "janeiro"])),
        parseNumber(getRowValue(row, ["fev", "fevereiro"])),
        parseNumber(getRowValue(row, ["mar", "marco", "março"])),
        parseNumber(getRowValue(row, ["abr", "abril"])),
        parseNumber(getRowValue(row, ["mai", "maio"])),
        parseNumber(getRowValue(row, ["jun", "junho"])),
        parseNumber(getRowValue(row, ["jul", "julho"])),
        parseNumber(getRowValue(row, ["ago", "agosto"])),
        parseNumber(getRowValue(row, ["set", "setembro"])),
        parseNumber(getRowValue(row, ["out", "outubro"])),
        parseNumber(getRowValue(row, ["nov", "novembro"])),
        parseNumber(getRowValue(row, ["dez", "dezembro"])),
      ],
      type: inferMovementType(code, rawType),
      category: category || undefined,
      is_mapped: false,
    });
  }

  return parsedRows;
}

export async function POST(request: NextRequest) {
  let importBatchId: string | undefined;

  try {
    const auth = await requireClient();
    if (!auth.clientId) {
      return error("Cliente nao encontrado", 404);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const year = Number(String(formData.get("year") ?? "").trim());
    const valuesMode =
      String(formData.get("valuesMode") ?? "monthly").trim() === "accumulated"
        ? "accumulated"
        : "monthly";

    if (!(file instanceof File)) {
      return error("Arquivo obrigatorio", 400);
    }

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return error("Ano invalido", 400);
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return error("Nenhuma planilha encontrada no arquivo", 400);
    }

    const sheet = workbook.Sheets[sheetName];
    const imported = XLSX.utils.sheet_to_json<ImportedRow>(sheet, { defval: "" });
    const parsedRows = parseRows(imported);

    if (parsedRows.length === 0) {
      return error("Nao foi possivel identificar movimentacoes validas no XLSX", 400);
    }

    const importBatch = await openImportBatch({
      accountingId: auth.accountingId,
      clientId: auth.clientId,
      year,
      kind: "client_dre_upload",
      fileName: file.name,
      batchIndex: 0,
    });
    importBatchId = importBatch.id;

    const [
      globalAccounts,
      clientAccounts,
      globalDreMappings,
      clientDreMappings,
      globalPatrimonialMappings,
      clientPatrimonialMappings,
    ] = await Promise.all([
      prisma.chartOfAccounts.findMany({
        where: { accounting_id: auth.accountingId, client_id: null },
        select: {
          code: true,
          reduced_code: true,
          name: true,
          report_category: true,
          report_type: true,
          level: true,
        },
      }),
      prisma.chartOfAccounts.findMany({
        where: { accounting_id: auth.accountingId, client_id: auth.clientId },
        select: {
          code: true,
          reduced_code: true,
          name: true,
          report_category: true,
          report_type: true,
          level: true,
        },
      }),
      prisma.dREMapping.findMany({
        where: { accounting_id: auth.accountingId, client_id: null },
        select: { account_code: true, category: true, client_id: true },
      }),
      prisma.dREMapping.findMany({
        where: { accounting_id: auth.accountingId, client_id: auth.clientId },
        select: { account_code: true, category: true, client_id: true },
      }),
      prisma.patrimonialMapping.findMany({
        where: { accounting_id: auth.accountingId, client_id: null },
        select: { account_code: true, category: true, client_id: true },
      }),
      prisma.patrimonialMapping.findMany({
        where: { accounting_id: auth.accountingId, client_id: auth.clientId },
        select: { account_code: true, category: true, client_id: true },
      }),
    ]);

    const chartAccounts = new Map<string, (typeof globalAccounts)[number]>();
    for (const item of globalAccounts) chartAccounts.set(item.code, item);
    for (const item of clientAccounts) chartAccounts.set(item.code, item);

    const dreMappings = new Map<string, (typeof globalDreMappings)[number]>();
    for (const item of globalDreMappings) dreMappings.set(item.account_code, item);
    for (const item of clientDreMappings) dreMappings.set(item.account_code, item);

    const patrimonialMappings = new Map<
      string,
      (typeof globalPatrimonialMappings)[number]
    >();
    for (const item of globalPatrimonialMappings) {
      patrimonialMappings.set(item.account_code, item);
    }
    for (const item of clientPatrimonialMappings) {
      patrimonialMappings.set(item.account_code, item);
    }

    const normalizedRows = parsedRows.map((row) => {
      const chartAccount = chartAccounts.get(row.code) ?? null;
      const movement = {
        code: row.code,
        reduced_code: row.reduced_code,
        name: row.name,
        level: row.level,
        values: row.values,
        type: row.type,
        category: row.category,
      } as const;

      const resolvedCategory =
        row.type === "dre"
          ? resolveDreCategory({
              movement,
              chartAccount,
              mapping: dreMappings.get(row.code) ?? null,
            })
          : resolvePatrimonialCategory({
              movement,
              chartAccount,
              mapping: patrimonialMappings.get(row.code) ?? null,
            });

      return {
        ...row,
        values:
          valuesMode === "accumulated"
            ? convertAccumulatedToMonthly(row.values)
            : row.values,
        category: row.category || resolvedCategory || undefined,
      };
    });

    const results = await prisma.$transaction(
      normalizedRows.map((row) =>
        prisma.monthlyMovement.upsert({
          where: {
            client_id_year_code_type: {
              client_id: auth.clientId!,
              year,
              code: row.code,
              type: row.type,
            },
          },
          update: {
            name: row.name,
            reduced_code: row.reduced_code,
            level: row.level,
            values: row.values,
            category: row.category,
            is_mapped: row.is_mapped,
            deleted_at: null,
          },
          create: {
            accounting_id: auth.accountingId,
            client_id: auth.clientId!,
            year,
            code: row.code,
            reduced_code: row.reduced_code,
            name: row.name,
            level: row.level,
            values: row.values,
            type: row.type,
            category: row.category,
            is_mapped: row.is_mapped,
          },
        })
      )
    );

    await updateImportBatchProgress({
      batchId: importBatch.id,
      processedRows: results.length,
    });

    const client = await prisma.client.findUnique({
      where: { id: auth.clientId },
      select: { name: true },
    });

    await createNotification({
      accountingId: auth.accountingId,
      audience: "staff",
      kind: "arquivos",
      title: "Novo balancete DRE recebido",
      description: `${client?.name ?? "Cliente"} enviou ${file.name} para o ano ${year}.`,
      clientId: auth.clientId,
      entityType: "dre_import",
      entityId: importBatch.id,
    });

    try {
      const job = await enqueueBackgroundJob({
        type: "rebuild_statements",
        accountingId: auth.accountingId,
        clientId: auth.clientId,
        year,
        payload: {
          statementType: "all",
          source: "client_dre_import",
        },
        importBatchId: importBatch.id,
      });

      return success({
        imported: results.length,
        year,
        valuesMode,
        status: "processing",
        batchId: importBatch.id,
        jobId: job.id,
      });
    } catch {
      await rebuildStatements({
        accountingId: auth.accountingId,
        clientId: auth.clientId,
        year,
        statementType: "all",
      });
      await completeImportBatch({ batchId: importBatch.id });

      return success({
        imported: results.length,
        year,
        valuesMode,
        status: "ready",
        batchId: importBatch.id,
        jobId: null,
      });
    }
  } catch (err) {
    await failImportBatch({
      batchId: importBatchId,
      errorMessage: err instanceof Error ? err.message : "Falha ao importar DRE",
    });
    return handleError(err);
  }
}
