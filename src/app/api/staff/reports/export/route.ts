import { NextRequest } from "next/server";

import { handleError, success } from "@/lib/api-response";
import { requireStaff } from "@/lib/auth-guard";
import {
  buildConsultativeReportOverview,
  buildSanitizedExport,
  reportsOverviewQuerySchema,
} from "@/lib/consultative-reports";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

const CACHE_CONTROL = "private, max-age=10, stale-while-revalidate=60";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff();
    const { searchParams } = new URL(request.url);
    const query = reportsOverviewQuerySchema.parse({
      clientId: searchParams.get("clientId"),
      year: searchParams.get("year"),
      month: searchParams.get("month"),
    });

    const overview = await buildConsultativeReportOverview(auth.accountingId, query);
    const response = success(buildSanitizedExport(overview));
    response.headers.set("Cache-Control", CACHE_CONTROL);
    return response;
  } catch (err) {
    if (err instanceof Error && err.message === "Cliente nao encontrado") {
      return success({ error: err.message }, 404);
    }
    return handleError(err);
  }
}
