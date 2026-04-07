import { handleError, success } from "@/lib/api-response";
import { requireStaff } from "@/lib/auth-guard";
import { listReportClients } from "@/lib/consultative-reports";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

export async function GET() {
  try {
    const auth = await requireStaff();
    const clients = await listReportClients(auth.accountingId);
    return success({ clients });
  } catch (err) {
    return handleError(err);
  }
}
