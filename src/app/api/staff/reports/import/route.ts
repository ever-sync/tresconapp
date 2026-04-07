import { NextRequest } from "next/server";

import { handleError, success } from "@/lib/api-response";
import { requireStaff } from "@/lib/auth-guard";
import {
  importReportSignals,
  reportSignalsImportSchema,
} from "@/lib/consultative-reports";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const body = await request.json();
    const input = reportSignalsImportSchema.parse(body);
    const signals = await importReportSignals(auth.accountingId, input);
    return success({ imported: signals.length, signals }, 201);
  } catch (err) {
    if (err instanceof Error && err.message === "Cliente nao encontrado") {
      return success({ error: err.message }, 404);
    }
    return handleError(err);
  }
}
