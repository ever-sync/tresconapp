import { NextRequest } from "next/server";

import { handleError, success } from "@/lib/api-response";
import { requireStaff } from "@/lib/auth-guard";
import {
  reportSignalUpsertSchema,
  upsertReportSignal,
} from "@/lib/consultative-reports";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const body = await request.json();
    const input = reportSignalUpsertSchema.parse(body);
    const signal = await upsertReportSignal(auth.accountingId, input);
    return success({ signal }, input.id ? 200 : 201);
  } catch (err) {
    if (err instanceof Error && err.message === "Cliente nao encontrado") {
      return success({ error: err.message }, 404);
    }
    return handleError(err);
  }
}
