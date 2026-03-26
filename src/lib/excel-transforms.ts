/**
 * Transform functions that convert raw Excel rows
 * into the shape expected by the API endpoints.
 */

// ── Month column name variations ──────────────────────────

const MONTH_ALIASES: Record<string, number> = {
  // Portuguese
  jan: 0, janeiro: 0,
  fev: 1, fevereiro: 1,
  mar: 2, março: 2, marco: 2,
  abr: 3, abril: 3,
  mai: 4, maio: 4,
  jun: 5, junho: 5,
  jul: 6, julho: 6,
  ago: 7, agosto: 7,
  set: 8, setembro: 8,
  out: 9, outubro: 9,
  nov: 10, novembro: 10,
  dez: 11, dezembro: 11,
  // English
  jan_en: 0, january: 0,
  feb: 1, february: 1,
  mar_en: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  june: 5,
  july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  november: 10,
  dec: 11, december: 11,
};

function findMonthIndex(header: string): number | null {
  const normalized = header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (MONTH_ALIASES[normalized] !== undefined) {
    return MONTH_ALIASES[normalized];
  }

  // Try partial match (e.g., "jan/2024" → "jan")
  for (const [alias, idx] of Object.entries(MONTH_ALIASES)) {
    if (normalized.startsWith(alias)) return idx;
  }

  return null;
}

/**
 * Extract 12 monthly values from a raw Excel row.
 * Handles various column naming conventions.
 */
function extractMonthlyValues(
  row: Record<string, unknown>,
  headers: string[]
): number[] {
  const values = new Array(12).fill(0);

  for (const header of headers) {
    const monthIdx = findMonthIndex(header);
    if (monthIdx !== null) {
      const raw = row[header];
      const num = typeof raw === "number" ? raw : parseFloat(String(raw || "0"));
      values[monthIdx] = isNaN(num) ? 0 : num;
    }
  }

  return values;
}

/**
 * Find the value of a column by trying multiple possible names.
 */
function findColumn(
  row: Record<string, unknown>,
  ...candidates: string[]
): string {
  for (const candidate of candidates) {
    // Exact match
    if (row[candidate] !== undefined && row[candidate] !== null) {
      return String(row[candidate]).trim();
    }
    // Case-insensitive match
    const key = Object.keys(row).find(
      (k) => k.toLowerCase().trim() === candidate.toLowerCase()
    );
    if (key && row[key] !== undefined && row[key] !== null) {
      return String(row[key]).trim();
    }
  }
  return "";
}

function findNumericColumn(
  row: Record<string, unknown>,
  ...candidates: string[]
): number {
  const val = findColumn(row, ...candidates);
  const num = parseFloat(val);
  return isNaN(num) ? 1 : num;
}

// ── Movement transform ────────────────────────────────────

export interface MovementRow {
  code: string;
  reduced_code?: string;
  name: string;
  level: number;
  values: number[];
  type: "dre" | "patrimonial";
  category?: string;
  is_mapped: boolean;
}

export function transformMovementRow(
  raw: Record<string, unknown>,
  _index: number,
  type: "dre" | "patrimonial" = "dre"
): MovementRow | null {
  const code = findColumn(raw, "Código", "Codigo", "Code", "Conta", "cod", "código");
  const name = findColumn(raw, "Nome", "Descrição", "Descricao", "Description", "Conta", "nome", "descrição");

  if (!code || !name) return null;

  const headers = Object.keys(raw);
  const values = extractMonthlyValues(raw, headers);

  return {
    code,
    reduced_code: findColumn(raw, "Código Reduzido", "Cod Reduzido", "Reduced", "reduced_code") || undefined,
    name,
    level: findNumericColumn(raw, "Nível", "Nivel", "Level", "level"),
    values,
    type,
    category: findColumn(raw, "Categoria", "Category", "category") || undefined,
    is_mapped: false,
  };
}

// ── Chart of Accounts transform ───────────────────────────

export interface ChartAccountRow {
  code: string;
  reduced_code?: string;
  name: string;
  type: "A" | "S";
  is_analytic: boolean;
  level: number;
  alias?: string;
  report_type?: "dre" | "patrimonial";
  report_category?: string;
}

export function transformChartAccountRow(
  raw: Record<string, unknown>
): ChartAccountRow | null {
  const code = findColumn(raw, "Código", "Codigo", "Code", "Conta", "cod");
  const name = findColumn(raw, "Nome", "Descrição", "Descricao", "Description", "nome");

  if (!code || !name) return null;

  const typeRaw = findColumn(raw, "Tipo", "Type", "type").toUpperCase();
  const isAnalytic = typeRaw !== "S";

  return {
    code,
    reduced_code: findColumn(raw, "Código Reduzido", "Cod Reduzido", "reduced_code") || undefined,
    name,
    type: isAnalytic ? "A" : "S",
    is_analytic: isAnalytic,
    level: findNumericColumn(raw, "Nível", "Nivel", "Level"),
    alias: findColumn(raw, "Apelido", "Alias", "alias") || undefined,
    report_type: (findColumn(raw, "Relatório", "Report", "report_type") as "dre" | "patrimonial") || undefined,
    report_category: findColumn(raw, "Categoria", "Category", "report_category") || undefined,
  };
}
