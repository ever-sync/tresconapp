import * as XLSX from "xlsx";

export type MovementType = "dre" | "patrimonial";

export type ParsedMovementRow = {
  code: string;
  reduced_code?: string;
  name: string;
  level: number;
  values: number[];
  type: MovementType;
  category?: string;
  is_mapped: boolean;
};

type ImportedRow = Record<string, unknown>;

type ParseMovementFileOptions = {
  forceType?: MovementType;
};

type LayoutSummary = {
  codeColumn: string | null;
  nameColumn: string | null;
  monthColumns: string[];
  balanceColumn?: string | null;
};

export type ParseMovementFileResult = {
  rows: ParsedMovementRow[];
  headers: string[];
  layout: LayoutSummary;
  fileError?: string;
};

export type BalancetePreviewRow = {
  conta: string;
  classificacao: string;
  nomeContaContabil: string;
  saldoAnterior: string;
  debito: string;
  credito: string;
  saldoAtual: string;
};

const CODE_ALIASES = ["classificacao", "codigo", "code", "conta"];
const REDUCED_CODE_ALIASES = [
  "cod red",
  "codigo reduzido",
  "classificacao",
];
const NAME_ALIASES = [
  "nome",
  "descricao",
  "conta descricao",
  "nome da conta contabil",
];
const LEVEL_ALIASES = ["nivel", "niv", "level"];
const TYPE_ALIASES = ["tipo", "type", "relatorio"];
const CATEGORY_ALIASES = ["categoria", "grupo"];
const BALANCE_ALIASES = ["saldo atual", "saldo final", "saldo"];
const PREVIOUS_BALANCE_ALIASES = ["saldo anterior"];
const DEBIT_ALIASES = ["debito"];
const CREDIT_ALIASES = ["credito"];

const MONTH_NAME_ALIASES: Record<string, number> = {
  jan: 0,
  janeiro: 0,
  fev: 1,
  fevereiro: 1,
  mar: 2,
  marco: 2,
  abr: 3,
  abril: 3,
  mai: 4,
  maio: 4,
  jun: 5,
  junho: 5,
  jul: 6,
  julho: 6,
  ago: 7,
  agosto: 7,
  set: 8,
  setembro: 8,
  out: 9,
  outubro: 9,
  nov: 10,
  novembro: 10,
  dez: 11,
  dezembro: 11,
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getNormalizedRowEntries(row: ImportedRow) {
  return new Map(
    Object.entries(row).map(([key, value]) => [normalizeText(key), value] as const)
  );
}

function findMatchingHeader(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeText);

  return (
    headers.find((header) => {
      const normalizedHeader = normalizeText(header);
      return normalizedAliases.includes(normalizedHeader);
    }) ?? null
  );
}

function getRowValue(row: ImportedRow, aliases: string[]) {
  const entries = getNormalizedRowEntries(row);

  for (const alias of aliases) {
    const value = entries.get(normalizeText(alias));
    if (value !== undefined) {
      return value;
    }
  }

  return "";
}

function readWorkbook(fileData: ArrayBuffer) {
  try {
    return XLSX.read(fileData, { type: "array" });
  } catch {
    return null;
  }
}

function resolveAccountIdentifiers(row: ImportedRow) {
  const classification = String(getRowValue(row, ["classificacao"])).trim();
  const genericCode = String(getRowValue(row, ["codigo", "code", "conta"])).trim();
  const reducedCandidate = String(getRowValue(row, REDUCED_CODE_ALIASES)).trim();
  const code = classification || genericCode;
  const reducedCode =
    (reducedCandidate && reducedCandidate !== code ? reducedCandidate : "") ||
    (genericCode && genericCode !== code ? genericCode : "") ||
    code ||
    undefined;

  return {
    code,
    reducedCode,
  };
}

export function parseMovementNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value ?? "").trim();
  if (!raw) {
    return 0;
  }

  const negativeByParens = raw.startsWith("(") && raw.endsWith(")");
  const negativeBySign = raw.includes("-");

  let cleaned = raw
    .replace(/[()]/g, "")
    .replace(/\s+/g, "")
    .replace(/[R$]/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!cleaned) {
    return 0;
  }

  cleaned = cleaned.replace(/-/g, "");

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma >= 0 || lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const decimalIndex = decimalSeparator === "," ? lastComma : lastDot;
    const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
    const fractionalPart = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, "");
    cleaned = fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
  } else {
    cleaned = cleaned.replace(/[.,]/g, "");
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return negativeByParens || negativeBySign ? -Math.abs(parsed) : parsed;
}

export function findMonthIndex(header: string) {
  const normalized = normalizeText(header);

  if (MONTH_NAME_ALIASES[normalized] !== undefined) {
    return MONTH_NAME_ALIASES[normalized];
  }

  for (const [alias, index] of Object.entries(MONTH_NAME_ALIASES)) {
    if (normalized.startsWith(`${alias} `)) {
      return index;
    }
  }

  const numericMatch = normalized.match(/^(\d{1,2})(?:\s+\d{2,4})?$/);
  if (!numericMatch) {
    return null;
  }

  const month = Number(numericMatch[1]);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return month - 1;
}

export function inferMovementType(code: string, rawType: string): MovementType {
  const normalizedType = normalizeText(rawType);
  if (
    normalizedType.includes("dre") ||
    normalizedType.includes("resultado")
  ) {
    return "dre";
  }

  if (
    normalizedType.includes("patrimonial") ||
    normalizedType.includes("balanco")
  ) {
    return "patrimonial";
  }

  const sanitizedCode = code.replace(/[^\d.]/g, "");
  if (sanitizedCode.startsWith("03") || sanitizedCode.startsWith("04")) {
    return "dre";
  }

  return "patrimonial";
}

function inferLevel(code: string, rawLevel: unknown) {
  const parsed = Number(String(rawLevel ?? "").trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const inferred = code
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean).length;

  return inferred || 1;
}

function summarizeLayout(headers: string[]): LayoutSummary {
  return {
    codeColumn: findMatchingHeader(headers, CODE_ALIASES),
    nameColumn: findMatchingHeader(headers, NAME_ALIASES),
    monthColumns: headers.filter((header) => findMonthIndex(header) !== null),
    balanceColumn: findMatchingHeader(headers, BALANCE_ALIASES),
  };
}

function collectHeaders(rows: ImportedRow[]) {
  return Array.from(
    new Set(rows.flatMap((row) => Object.keys(row).filter(Boolean)))
  );
}

export function buildInvalidMovementFileMessage(layout: LayoutSummary) {
  const expectedColumns =
    "Classificacao ou Codigo, Nome da conta contabil ou Nome, e meses como Jan, Fevereiro ou 01/2025. Para balancete mensal, use Saldo Atual e escolha o mes do upload.";

  if (!layout.codeColumn || !layout.nameColumn || layout.monthColumns.length === 0) {
    return `Arquivo lido, mas o layout nao foi reconhecido. Esperado: ${expectedColumns}`;
  }

  return `Arquivo lido, mas nenhuma linha valida foi encontrada. Confira se as colunas seguem o formato esperado: ${expectedColumns}`;
}

export function parseMovementFile(
  fileData: ArrayBuffer,
  options: ParseMovementFileOptions = {}
): ParseMovementFileResult {
  const workbook = readWorkbook(fileData);
  if (!workbook) {
    return {
      rows: [],
      headers: [],
      layout: { codeColumn: null, nameColumn: null, monthColumns: [] },
      fileError:
        "Nao foi possivel ler o arquivo enviado. Envie uma planilha Excel ou CSV valida.",
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      headers: [],
      layout: { codeColumn: null, nameColumn: null, monthColumns: [] },
      fileError: "Nenhuma planilha encontrada no arquivo.",
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const imported = XLSX.utils.sheet_to_json<ImportedRow>(sheet, {
    defval: "",
    raw: false,
  });
  const headers = collectHeaders(imported);
  const layout = summarizeLayout(headers);

  if (layout.monthColumns.length === 0) {
    return { rows: [], headers, layout };
  }

  const rows = imported.flatMap((row) => {
    const { code, reducedCode } = resolveAccountIdentifiers(row);
    const name = String(getRowValue(row, NAME_ALIASES)).trim();

    if (!code || !name) {
      return [];
    }

    const rawLevel = getRowValue(row, LEVEL_ALIASES);
    const rawType = String(getRowValue(row, TYPE_ALIASES)).trim();
    const category = String(getRowValue(row, CATEGORY_ALIASES)).trim();
    const values = new Array(12).fill(0);

    for (const [header, rawValue] of Object.entries(row)) {
      const monthIndex = findMonthIndex(header);
      if (monthIndex !== null) {
        values[monthIndex] = parseMovementNumber(rawValue);
      }
    }

    return [
      {
        code,
        reduced_code: reducedCode,
        name,
        level: inferLevel(code, rawLevel),
        values,
        type: options.forceType ?? inferMovementType(code, rawType),
        category: category || undefined,
        is_mapped: false,
      } satisfies ParsedMovementRow,
    ];
  });

  return { rows, headers, layout };
}

export function parseMonthlyBalanceteFile(
  fileData: ArrayBuffer,
  monthIndex: number
): ParseMovementFileResult {
  const workbook = readWorkbook(fileData);
  if (!workbook) {
    return {
      rows: [],
      headers: [],
      layout: { codeColumn: null, nameColumn: null, monthColumns: [], balanceColumn: null },
      fileError:
        "Nao foi possivel ler o arquivo enviado. Envie uma planilha Excel ou CSV valida.",
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      headers: [],
      layout: { codeColumn: null, nameColumn: null, monthColumns: [], balanceColumn: null },
      fileError: "Nenhuma planilha encontrada no arquivo.",
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const imported = XLSX.utils.sheet_to_json<ImportedRow>(sheet, {
    defval: "",
    raw: false,
  });
  const headers = collectHeaders(imported);
  const layout = summarizeLayout(headers);

  if (!layout.codeColumn || !layout.nameColumn || !layout.balanceColumn) {
    return { rows: [], headers, layout };
  }

  const rows = imported.flatMap((row) => {
    const { code, reducedCode } = resolveAccountIdentifiers(row);
    const name = String(getRowValue(row, NAME_ALIASES)).trim();

    if (!code || !name) {
      return [];
    }

    if (inferMovementType(code, "") !== "patrimonial") {
      return [];
    }

    const values = new Array(12).fill(0);
    values[monthIndex] = parseMovementNumber(getRowValue(row, BALANCE_ALIASES));

    return [
      {
        code,
        reduced_code: reducedCode,
        name,
        level: inferLevel(code, getRowValue(row, LEVEL_ALIASES)),
        values,
        type: "patrimonial",
        is_mapped: false,
      } satisfies ParsedMovementRow,
    ];
  });

  return { rows, headers, layout };
}

export function parseBalancetePreviewFile(fileData: ArrayBuffer): BalancetePreviewRow[] {
  const workbook = readWorkbook(fileData);
  if (!workbook) {
    return [];
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  const imported = XLSX.utils.sheet_to_json<ImportedRow>(sheet, {
    defval: "",
    raw: false,
  });

  return imported.flatMap((row) => {
    const conta = String(getRowValue(row, ["conta"])).trim();
    const classificacao = String(getRowValue(row, ["classificacao"])).trim();
    const nomeContaContabil = String(getRowValue(row, NAME_ALIASES)).trim();

    if (!conta && !classificacao && !nomeContaContabil) {
      return [];
    }

    return [
      {
        conta,
        classificacao,
        nomeContaContabil,
        saldoAnterior: String(getRowValue(row, PREVIOUS_BALANCE_ALIASES)).trim(),
        debito: String(getRowValue(row, DEBIT_ALIASES)).trim(),
        credito: String(getRowValue(row, CREDIT_ALIASES)).trim(),
        saldoAtual: String(getRowValue(row, BALANCE_ALIASES)).trim(),
      },
    ];
  });
}
