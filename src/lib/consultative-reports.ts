import { z } from "zod";
import type { ConsultativeReportSignal } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  getDfcSnapshotEnvelope,
  getDreSnapshotEnvelope,
  getPatrimonialSnapshotEnvelope,
} from "@/lib/statement-snapshots";

export const REPORT_SIGNAL_CATEGORIES = [
  "fiscal",
  "trabalhista",
  "tributario",
  "financeiro",
  "comportamento",
  "societario",
  "evento_critico",
] as const;

export const REPORT_SIGNAL_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const REPORT_SIGNAL_STATUSES = ["open", "in_progress", "resolved"] as const;

export type ReportSignalCategory = (typeof REPORT_SIGNAL_CATEGORIES)[number];
export type ReportSignalSeverity = (typeof REPORT_SIGNAL_SEVERITIES)[number];
export type ReportSignalStatus = (typeof REPORT_SIGNAL_STATUSES)[number];

export const REPORT_SIGNAL_CATEGORY_LABELS: Record<ReportSignalCategory, string> = {
  fiscal: "Risco fiscal",
  trabalhista: "Risco trabalhista",
  tributario: "Oportunidades tributarias",
  financeiro: "Saude financeira",
  comportamento: "Comportamento do cliente",
  societario: "Societario",
  evento_critico: "Eventos criticos",
};

export const REPORT_SIGNAL_SEVERITY_LABELS: Record<ReportSignalSeverity, string> = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  critical: "Critica",
};

export const REPORT_SIGNAL_STATUS_LABELS: Record<ReportSignalStatus, string> = {
  open: "Aberto",
  in_progress: "Em atendimento",
  resolved: "Resolvido",
};

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const severityWeights: Record<ReportSignalSeverity, number> = {
  low: 5,
  medium: 12,
  high: 22,
  critical: 32,
};

const signalCategorySchema = z.enum(REPORT_SIGNAL_CATEGORIES);
const signalSeveritySchema = z.enum(REPORT_SIGNAL_SEVERITIES);
const signalStatusSchema = z.enum(REPORT_SIGNAL_STATUSES);

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const raw = String(value).trim();
  const brDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brDate) {
    const [, day, month, year] = brDate;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const reportSignalUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  category: signalCategorySchema,
  severity: signalSeveritySchema.default("medium"),
  status: signalStatusSchema.default("open"),
  title: z.string().trim().min(3, "Titulo obrigatorio"),
  internalNote: z.string().trim().min(3, "Nota interna obrigatoria"),
  clientTalkingPoint: z.string().trim().min(3, "Orientacao para cliente obrigatoria"),
  estimatedValue: z.preprocess(parseOptionalNumber, z.number().optional()),
  dueDate: z.preprocess(parseOptionalDate, z.date().optional()),
  periodYear: z.preprocess(parseOptionalInt, z.number().int().min(2000).max(2100).optional()),
  periodMonth: z.preprocess(parseOptionalInt, z.number().int().min(1).max(12).optional()),
  source: z.string().trim().min(1).default("manual"),
});

export const reportsOverviewQuerySchema = z.object({
  clientId: z.string().uuid(),
  year: z.preprocess(parseOptionalInt, z.number().int().min(2000).max(2100).optional()),
  month: z.preprocess(parseOptionalInt, z.number().int().min(1).max(12).optional()),
});

export const reportSignalsImportSchema = z.object({
  clientId: z.string().uuid(),
  rows: z.array(z.record(z.unknown())).min(1).max(1000),
});

export type ReportSignalInput = z.infer<typeof reportSignalUpsertSchema>;
export type ReportsOverviewQuery = z.infer<typeof reportsOverviewQuerySchema>;

export type ReportAlert = {
  id: string;
  category: ReportSignalCategory;
  categoryLabel: string;
  severity: ReportSignalSeverity;
  severityLabel: string;
  status: ReportSignalStatus;
  statusLabel: string;
  title: string;
  internalNote: string;
  clientTalkingPoint: string;
  estimatedValue: number | null;
  dueDate: string | null;
  periodYear: number | null;
  periodMonth: number | null;
  source: string;
  generated: boolean;
  createdAt: string;
};

export type ReportExportSummary = {
  title: string;
  highlights: Array<{ title: string; message: string; estimatedValue: number | null; dueDate: string | null }>;
  recommendations: string[];
  nextStep: string;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]) {
  const cleanValues = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (cleanValues.length === 0) return 0;
  const middle = Math.floor(cleanValues.length / 2);
  return cleanValues.length % 2 === 0
    ? ((cleanValues[middle - 1] ?? 0) + (cleanValues[middle] ?? 0)) / 2
    : cleanValues[middle] ?? 0;
}

function safeRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findRawValue(row: Record<string, unknown>, candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeText);
  const matchingKey = Object.keys(row).find((key) => {
    const normalizedKey = normalizeText(key);
    return normalizedCandidates.some((candidate) => normalizedKey === candidate || normalizedKey.includes(candidate));
  });
  return matchingKey ? row[matchingKey] : undefined;
}

function normalizeCategory(value: unknown): ReportSignalCategory {
  const normalized = normalizeText(value);
  if (normalized.includes("trabalh")) return "trabalhista";
  if (normalized.includes("tribut")) return "tributario";
  if (normalized.includes("finance")) return "financeiro";
  if (normalized.includes("comport") || normalized.includes("document")) return "comportamento";
  if (normalized.includes("societ")) return "societario";
  if (normalized.includes("evento") || normalized.includes("crit")) return "evento_critico";
  return "fiscal";
}

function normalizeSeverity(value: unknown): ReportSignalSeverity {
  const normalized = normalizeText(value);
  if (normalized.includes("crit")) return "critical";
  if (normalized.includes("alt") || normalized.includes("high")) return "high";
  if (normalized.includes("baix") || normalized.includes("low")) return "low";
  return "medium";
}

function normalizeStatus(value: unknown): ReportSignalStatus {
  const normalized = normalizeText(value);
  if (normalized.includes("resol") || normalized.includes("closed") || normalized.includes("done")) return "resolved";
  if (normalized.includes("andamento") || normalized.includes("progress")) return "in_progress";
  return "open";
}

export function transformConsultativeSignalRow(row: Record<string, unknown>, clientId: string) {
  const title = String(findRawValue(row, ["title", "titulo", "alerta", "sinal"]) ?? "").trim();
  const internalNote = String(
    findRawValue(row, ["internal_note", "internalNote", "nota interna", "observacao interna", "evidencia"]) ?? ""
  ).trim();
  const clientTalkingPoint = String(
    findRawValue(row, [
      "client_talking_point",
      "clientTalkingPoint",
      "orientacao cliente",
      "como falar",
      "fala cliente",
      "recomendacao",
    ]) ?? ""
  ).trim();

  return reportSignalUpsertSchema.parse({
    clientId,
    category: normalizeCategory(findRawValue(row, ["category", "categoria", "tipo"])),
    severity: normalizeSeverity(findRawValue(row, ["severity", "gravidade", "prioridade"])),
    status: normalizeStatus(findRawValue(row, ["status", "situacao"])),
    title,
    internalNote,
    clientTalkingPoint,
    estimatedValue: findRawValue(row, ["estimated_value", "estimatedValue", "valor estimado", "impacto estimado"]),
    dueDate: findRawValue(row, ["due_date", "dueDate", "vencimento", "data limite", "prazo"]),
    periodYear: findRawValue(row, ["period_year", "periodYear", "ano"]),
    periodMonth: findRawValue(row, ["period_month", "periodMonth", "mes", "mês"]),
    source: "import",
  });
}

function mapSignalToAlert(signal: {
  id: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  internal_note: string;
  client_talking_point: string;
  estimated_value: number | null;
  due_date: Date | null;
  period_year: number | null;
  period_month: number | null;
  source: string;
  created_at: Date;
}): ReportAlert {
  const category = REPORT_SIGNAL_CATEGORIES.includes(signal.category as ReportSignalCategory)
    ? (signal.category as ReportSignalCategory)
    : "fiscal";
  const severity = REPORT_SIGNAL_SEVERITIES.includes(signal.severity as ReportSignalSeverity)
    ? (signal.severity as ReportSignalSeverity)
    : "medium";
  const status = REPORT_SIGNAL_STATUSES.includes(signal.status as ReportSignalStatus)
    ? (signal.status as ReportSignalStatus)
    : "open";

  return {
    id: signal.id,
    category,
    categoryLabel: REPORT_SIGNAL_CATEGORY_LABELS[category],
    severity,
    severityLabel: REPORT_SIGNAL_SEVERITY_LABELS[severity],
    status,
    statusLabel: REPORT_SIGNAL_STATUS_LABELS[status],
    title: signal.title,
    internalNote: signal.internal_note,
    clientTalkingPoint: signal.client_talking_point,
    estimatedValue: signal.estimated_value,
    dueDate: signal.due_date?.toISOString() ?? null,
    periodYear: signal.period_year,
    periodMonth: signal.period_month,
    source: signal.source,
    generated: false,
    createdAt: signal.created_at.toISOString(),
  };
}

function createGeneratedAlert(input: {
  id: string;
  category: ReportSignalCategory;
  severity: ReportSignalSeverity;
  title: string;
  internalNote: string;
  clientTalkingPoint: string;
  estimatedValue?: number | null;
  dueDate?: string | null;
}) {
  return {
    id: input.id,
    category: input.category,
    categoryLabel: REPORT_SIGNAL_CATEGORY_LABELS[input.category],
    severity: input.severity,
    severityLabel: REPORT_SIGNAL_SEVERITY_LABELS[input.severity],
    status: "open" as const,
    statusLabel: REPORT_SIGNAL_STATUS_LABELS.open,
    title: input.title,
    internalNote: input.internalNote,
    clientTalkingPoint: input.clientTalkingPoint,
    estimatedValue: input.estimatedValue ?? null,
    dueDate: input.dueDate ?? null,
    periodYear: null,
    periodMonth: null,
    source: "generated",
    generated: true,
    createdAt: new Date().toISOString(),
  } satisfies ReportAlert;
}

async function getSafeDre(params: { accountingId: string; clientId: string; year: number; requestedMonth?: number }) {
  try {
    return await getDreSnapshotEnvelope(params);
  } catch {
    return null;
  }
}

async function getSafePatrimonial(params: { accountingId: string; clientId: string; year: number; requestedMonth?: number }) {
  try {
    return await getPatrimonialSnapshotEnvelope(params);
  } catch {
    return null;
  }
}

async function getSafeDfc(params: { accountingId: string; clientId: string; year: number; requestedMonth?: number }) {
  try {
    return await getDfcSnapshotEnvelope(params);
  } catch {
    return null;
  }
}

function sumUntilMonth(values: number[], monthIndex: number) {
  return values.slice(0, monthIndex + 1).reduce((total, value) => total + (value ?? 0), 0);
}

function getMetricValue(
  metrics: { liquidity?: Array<{ label: string; value: number }>; profitability?: Array<{ label: string; value: number }>; activity?: Array<{ label: string; value: number }> } | undefined,
  group: "liquidity" | "profitability" | "activity",
  label: string
) {
  return metrics?.[group]?.find((item) => normalizeText(item.label).includes(normalizeText(label)))?.value ?? 0;
}

function buildExportSummary(alerts: ReportAlert[], clientName: string): ReportExportSummary {
  const relevantAlerts = alerts
    .filter((alert) => alert.status !== "resolved")
    .sort((a, b) => severityWeights[b.severity] - severityWeights[a.severity])
    .slice(0, 5);

  const highlights = relevantAlerts.map((alert) => ({
    title: alert.title,
    message: alert.clientTalkingPoint,
    estimatedValue: alert.estimatedValue,
    dueDate: alert.dueDate,
  }));

  return {
    title: `Resumo consultivo - ${clientName}`,
    highlights,
    recommendations:
      highlights.length > 0
        ? highlights.map((item) => item.message)
        : ["Nao identificamos alertas relevantes para o periodo selecionado."],
    nextStep:
      highlights.length > 0
        ? "Recomendamos revisar os pontos acima em uma conversa objetiva e priorizar os itens com vencimento ou impacto financeiro."
        : "Manter o acompanhamento mensal e atualizar documentos, demonstrativos e pendencias quando houver novas movimentacoes.",
  };
}

async function buildPortfolioBenchmark(params: {
  accountingId: string;
  clientId: string;
  year: number;
  monthIndex: number;
  selectedRevenue: number;
  selectedRisk: number;
}) {
  const portfolioClients = await prisma.client.findMany({
    where: {
      accounting_id: params.accountingId,
      deleted_at: null,
    },
    select: { id: true },
  });

  const clientIds = portfolioClients.map((client) => client.id);
  if (clientIds.length === 0) {
    return {
      portfolioSize: 0,
      revenuePosition: "Sem carteira para comparar",
      riskPosition: "Sem carteira para comparar",
      medianRevenue: 0,
      medianOpenSignals: 0,
      selectedOpenSignals: 0,
    };
  }

  const [signalCounts, revenueRows] = await Promise.all([
    prisma.consultativeReportSignal.groupBy({
      by: ["client_id"],
      where: {
        accounting_id: params.accountingId,
        client_id: { in: clientIds },
        deleted_at: null,
        status: { not: "resolved" },
      },
      _count: { _all: true },
    }),
    prisma.monthlyMovement.findMany({
      where: {
        accounting_id: params.accountingId,
        client_id: { in: clientIds },
        year: params.year,
        type: "dre",
        category: "receita_bruta",
        deleted_at: null,
      },
      select: {
        client_id: true,
        values: true,
      },
    }),
  ]);

  const openSignalsByClient = new Map(signalCounts.map((item) => [item.client_id, item._count._all]));
  const revenueByClient = new Map<string, number>();
  for (const row of revenueRows) {
    revenueByClient.set(row.client_id, (revenueByClient.get(row.client_id) ?? 0) + sumUntilMonth(row.values, params.monthIndex));
  }

  const signalValues = clientIds.map((id) => openSignalsByClient.get(id) ?? 0);
  const revenueValues = clientIds.map((id) => revenueByClient.get(id) ?? 0);
  const medianRevenue = median(revenueValues);
  const medianOpenSignals = median(signalValues);
  const selectedOpenSignals = openSignalsByClient.get(params.clientId) ?? 0;

  return {
    portfolioSize: clientIds.length,
    revenuePosition:
      params.selectedRevenue >= medianRevenue
        ? "Receita acima ou em linha com a mediana da carteira"
        : "Receita abaixo da mediana da carteira",
    riskPosition:
      selectedOpenSignals > medianOpenSignals || params.selectedRisk >= 60
        ? "Prioridade acima da media da carteira"
        : "Prioridade em linha com a carteira",
    medianRevenue,
    medianOpenSignals,
    selectedOpenSignals,
  };
}

export async function listReportClients(accountingId: string) {
  const clients = await prisma.client.findMany({
    where: {
      accounting_id: accountingId,
      deleted_at: null,
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      cnpj: true,
      tax_regime: true,
      status: true,
      industry: true,
    },
  });

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    cnpj: client.cnpj,
    taxRegime: client.tax_regime,
    status: client.status,
    industry: client.industry,
  }));
}

export async function upsertReportSignal(accountingId: string, input: ReportSignalInput) {
  const client = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      accounting_id: accountingId,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!client) {
    throw new Error("Cliente nao encontrado");
  }

  const data = {
    accounting_id: accountingId,
    client_id: input.clientId,
    category: input.category,
    severity: input.severity,
    status: input.status,
    title: input.title,
    internal_note: input.internalNote,
    client_talking_point: input.clientTalkingPoint,
    estimated_value: input.estimatedValue ?? null,
    due_date: input.dueDate ?? null,
    period_year: input.periodYear ?? null,
    period_month: input.periodMonth ?? null,
    source: input.source,
    deleted_at: null,
  };

  let signal: ConsultativeReportSignal;

  if (input.id) {
    const existingSignal = await prisma.consultativeReportSignal.findFirstOrThrow({
      where: {
        id: input.id,
        accounting_id: accountingId,
        client_id: input.clientId,
        deleted_at: null,
      },
      select: { id: true },
    });

    signal = await prisma.consultativeReportSignal.update({
      where: { id: existingSignal.id },
      data,
    });
  } else {
    signal = await prisma.consultativeReportSignal.create({ data });
  }

  return mapSignalToAlert(signal);
}

export async function importReportSignals(accountingId: string, input: z.infer<typeof reportSignalsImportSchema>) {
  const client = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      accounting_id: accountingId,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!client) {
    throw new Error("Cliente nao encontrado");
  }

  const rows = input.rows.map((row) => transformConsultativeSignalRow(row, input.clientId));
  const created = await prisma.$transaction(
    rows.map((row) =>
      prisma.consultativeReportSignal.create({
        data: {
          accounting_id: accountingId,
          client_id: row.clientId,
          category: row.category,
          severity: row.severity,
          status: row.status,
          title: row.title,
          internal_note: row.internalNote,
          client_talking_point: row.clientTalkingPoint,
          estimated_value: row.estimatedValue ?? null,
          due_date: row.dueDate ?? null,
          period_year: row.periodYear ?? null,
          period_month: row.periodMonth ?? null,
          source: row.source,
        },
      })
    )
  );

  return created.map(mapSignalToAlert);
}

export async function buildConsultativeReportOverview(accountingId: string, query: ReportsOverviewQuery) {
  const client = await prisma.client.findFirst({
    where: {
      id: query.clientId,
      accounting_id: accountingId,
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      cnpj: true,
      tax_regime: true,
      status: true,
      industry: true,
      created_at: true,
    },
  });

  if (!client) {
    throw new Error("Cliente nao encontrado");
  }

  const currentDate = new Date();
  const year = query.year ?? currentDate.getFullYear();
  const activeMonthIndex = (query.month ?? (year === currentDate.getFullYear() ? currentDate.getMonth() + 1 : 12)) - 1;

  const [
    dreEnvelope,
    patrimonialEnvelope,
    dfcEnvelope,
    signals,
    unreadDocuments,
    documentCount,
    latestDocument,
    openTickets,
    inProgressTickets,
    highPriorityTickets,
    latestImport,
    failedImports,
  ] = await Promise.all([
    getSafeDre({ accountingId, clientId: client.id, year, requestedMonth: activeMonthIndex }),
    getSafePatrimonial({ accountingId, clientId: client.id, year, requestedMonth: activeMonthIndex }),
    getSafeDfc({ accountingId, clientId: client.id, year, requestedMonth: activeMonthIndex }),
    prisma.consultativeReportSignal.findMany({
      where: {
        accounting_id: accountingId,
        client_id: client.id,
        deleted_at: null,
      },
      orderBy: [{ status: "asc" }, { due_date: "asc" }, { created_at: "desc" }],
    }),
    prisma.clientDocument.count({
      where: {
        accounting_id: accountingId,
        client_id: client.id,
        viewed_at: null,
        deleted_at: null,
      },
    }),
    prisma.clientDocument.count({
      where: {
        accounting_id: accountingId,
        client_id: client.id,
        deleted_at: null,
      },
    }),
    prisma.clientDocument.findFirst({
      where: {
        accounting_id: accountingId,
        client_id: client.id,
        deleted_at: null,
      },
      orderBy: { created_at: "desc" },
      select: {
        display_name: true,
        category: true,
        created_at: true,
      },
    }),
    prisma.supportTicket.count({
      where: {
        accounting_id: accountingId,
        client_id: client.id,
        status: "open",
      },
    }),
    prisma.supportTicket.count({
      where: {
        accounting_id: accountingId,
        client_id: client.id,
        status: "in_progress",
      },
    }),
    prisma.supportTicket.count({
      where: {
        accounting_id: accountingId,
        client_id: client.id,
        priority: "high",
        status: { not: "closed" },
      },
    }),
    prisma.importBatch.findFirst({
      where: {
        accounting_id: accountingId,
        client_id: client.id,
      },
      orderBy: { started_at: "desc" },
      select: {
        kind: true,
        status: true,
        row_count: true,
        error_message: true,
        started_at: true,
        finished_at: true,
      },
    }),
    prisma.importBatch.count({
      where: {
        accounting_id: accountingId,
        client_id: client.id,
        status: "failed",
      },
    }),
  ]);

  const dre = dreEnvelope?.payload ?? null;
  const patrimonial = patrimonialEnvelope?.payload ?? null;
  const dfc = dfcEnvelope?.payload ?? null;
  const revenue = dre?.cards.receitaBruta ?? 0;
  const netResult = dre?.cards.resultadoLiquido ?? 0;
  const ebitda = dre?.lines.ebitda?.[activeMonthIndex] ?? 0;
  const grossTaxes = dre?.cards.irpjCsll ?? 0;
  const netMargin = safeRatio(netResult, Math.abs(revenue));
  const cashGeneration = dfc?.lines.resultadoGeracaoCaixa?.[activeMonthIndex] ?? 0;
  const liquidityCurrent = getMetricValue(patrimonial?.metrics, "liquidity", "Liquidez Corrente");
  const totalAssets = patrimonial?.totals.totalAtivo?.[activeMonthIndex] ?? 0;
  const totalLiabilities = patrimonial?.totals.totalPassivo?.[activeMonthIndex] ?? 0;

  const persistedAlerts = signals.map(mapSignalToAlert);
  const generatedAlerts: ReportAlert[] = [];

  if (revenue > 0 && netMargin < 0.05) {
    generatedAlerts.push(createGeneratedAlert({
      id: "generated-low-margin",
      category: "financeiro",
      severity: netMargin < 0 ? "high" : "medium",
      title: "Margem liquida pressionada",
      internalNote: "A margem liquida do periodo esta abaixo de 5% da receita bruta.",
      clientTalkingPoint: "Identificamos pressao na margem do periodo e recomendamos revisar custos, despesas e precificacao antes do proximo fechamento.",
    }));
  }

  if (liquidityCurrent > 0 && liquidityCurrent < 1) {
    generatedAlerts.push(createGeneratedAlert({
      id: "generated-low-liquidity",
      category: "financeiro",
      severity: "high",
      title: "Liquidez corrente abaixo de 1",
      internalNote: "O ativo circulante nao cobre integralmente o passivo circulante no mes selecionado.",
      clientTalkingPoint: "A liquidez de curto prazo merece acompanhamento para evitar concentracao de pagamentos sem caixa suficiente.",
    }));
  }

  if (cashGeneration < 0) {
    generatedAlerts.push(createGeneratedAlert({
      id: "generated-negative-cash",
      category: "financeiro",
      severity: "medium",
      title: "Geracao de caixa negativa",
      internalNote: "A DFC mostra geracao de caixa negativa no periodo selecionado.",
      clientTalkingPoint: "O fluxo de caixa do periodo ficou negativo; vale revisar recebimentos, pagamentos e compromissos dos proximos meses.",
    }));
  }

  if (unreadDocuments > 0) {
    generatedAlerts.push(createGeneratedAlert({
      id: "generated-unread-documents",
      category: "comportamento",
      severity: unreadDocuments >= 5 ? "high" : "medium",
      title: "Documentos aguardando triagem",
      internalNote: `${unreadDocuments} documento(s) ainda nao foram visualizados pela equipe.`,
      clientTalkingPoint: "Recebemos documentos recentes e vamos revisar os itens pendentes para orientar os proximos passos.",
    }));
  }

  if (openTickets + inProgressTickets > 0) {
    generatedAlerts.push(createGeneratedAlert({
      id: "generated-open-tickets",
      category: "comportamento",
      severity: highPriorityTickets > 0 ? "high" : "medium",
      title: "Chamados em andamento",
      internalNote: `${openTickets} chamado(s) aberto(s), ${inProgressTickets} em atendimento e ${highPriorityTickets} de alta prioridade.`,
      clientTalkingPoint: "Ha atendimentos em andamento que podem impactar o fechamento; vamos consolidar as respostas para reduzir retrabalho.",
    }));
  }

  if (failedImports > 0) {
    generatedAlerts.push(createGeneratedAlert({
      id: "generated-failed-imports",
      category: "evento_critico",
      severity: "high",
      title: "Importacoes com falha",
      internalNote: `${failedImports} importacao(oes) falharam para este cliente.`,
      clientTalkingPoint: "Alguns dados precisam ser reprocessados antes da leitura final do periodo.",
    }));
  }

  const alerts = [...persistedAlerts, ...generatedAlerts];
  const unresolvedAlerts = alerts.filter((alert) => alert.status !== "resolved");

  const signalRiskByCategory = REPORT_SIGNAL_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = unresolvedAlerts
        .filter((alert) => alert.category === category)
        .reduce((total, alert) => total + severityWeights[alert.severity], 0);
      return acc;
    },
    {} as Record<ReportSignalCategory, number>
  );

  const fiscalRisk = clampScore(signalRiskByCategory.fiscal + signalRiskByCategory.tributario * 0.6);
  const laborRisk = clampScore(signalRiskByCategory.trabalhista);
  const behaviorRisk = clampScore(signalRiskByCategory.comportamento + openTickets * 6 + unreadDocuments * 3);
  const financialRisk = clampScore(
    signalRiskByCategory.financeiro +
      (netResult < 0 ? 20 : 0) +
      (liquidityCurrent > 0 && liquidityCurrent < 1 ? 18 : 0) +
      (cashGeneration < 0 ? 12 : 0)
  );
  const opportunityPotential = clampScore(
    signalRiskByCategory.tributario + Math.min(40, unresolvedAlerts.filter((alert) => (alert.estimatedValue ?? 0) > 0).length * 10)
  );
  const overall = clampScore(average([fiscalRisk, laborRisk, behaviorRisk, financialRisk, opportunityPotential]));
  const priority =
    overall >= 75 ? "Critica" : overall >= 55 ? "Alta" : overall >= 30 ? "Atencao" : "Normal";

  const benchmark = await buildPortfolioBenchmark({
    accountingId,
    clientId: client.id,
    year,
    monthIndex: activeMonthIndex,
    selectedRevenue: revenue,
    selectedRisk: overall,
  });

  const topAlerts = unresolvedAlerts
    .sort((a, b) => severityWeights[b.severity] - severityWeights[a.severity])
    .slice(0, 6);
  const exportSummary = buildExportSummary(topAlerts, client.name);

  return {
    client: {
      id: client.id,
      name: client.name,
      cnpj: client.cnpj,
      taxRegime: client.tax_regime,
      status: client.status,
      industry: client.industry,
    },
    period: {
      year,
      month: activeMonthIndex + 1,
      monthLabel: MONTH_LABELS[activeMonthIndex] ?? "Jan",
      computedAt: new Date().toISOString(),
      financialComputedAt: dreEnvelope?.computedAt ?? patrimonialEnvelope?.computedAt ?? dfcEnvelope?.computedAt ?? null,
    },
    scores: {
      overall,
      priority,
      fiscalRisk,
      laborRisk,
      financialRisk,
      behaviorRisk,
      opportunityPotential,
    },
    alerts,
    opportunities: alerts.filter((alert) => alert.category === "tributario" || (alert.estimatedValue ?? 0) > 0),
    financialSnapshot: {
      revenue,
      netResult,
      netMargin,
      ebitda,
      grossTaxes,
      cashGeneration,
      liquidityCurrent,
      totalAssets,
      totalLiabilities,
      dreStatus: dreEnvelope?.snapshotStatus ?? null,
      patrimonialStatus: patrimonialEnvelope?.snapshotStatus ?? null,
      dfcStatus: dfcEnvelope?.snapshotStatus ?? null,
    },
    behavior: {
      unreadDocuments,
      documentCount,
      openTickets,
      inProgressTickets,
      highPriorityTickets,
      latestDocument: latestDocument
        ? {
            title: latestDocument.display_name,
            category: latestDocument.category,
            sentAt: latestDocument.created_at.toISOString(),
          }
        : null,
      latestImport: latestImport
        ? {
            kind: latestImport.kind,
            status: latestImport.status,
            rowCount: latestImport.row_count,
            errorMessage: latestImport.error_message,
            startedAt: latestImport.started_at.toISOString(),
            finishedAt: latestImport.finished_at?.toISOString() ?? null,
          }
        : null,
    },
    criticalEvents: alerts
      .filter((alert) => alert.category === "evento_critico" || alert.dueDate)
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    benchmark,
    advisorScript: {
      opening: `Revisamos o periodo de ${MONTH_LABELS[activeMonthIndex]}/${year} e priorizamos os pontos de maior impacto para ${client.name}.`,
      talkingPoints: topAlerts.map((alert) => alert.clientTalkingPoint),
      followUp: exportSummary.nextStep,
    },
    exportSummary,
  };
}

export function buildSanitizedExport(overview: Awaited<ReturnType<typeof buildConsultativeReportOverview>>) {
  return {
    client: overview.client,
    period: overview.period,
    financialSnapshot: overview.financialSnapshot,
    exportSummary: overview.exportSummary,
  };
}
