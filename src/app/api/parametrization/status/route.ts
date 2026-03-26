import { success, handleError } from "@/lib/api-response";
import { requireStaff } from "@/lib/auth-guard";
import { getParametrizationStatus } from "@/lib/parametrization-status";

export async function GET() {
  try {
    const auth = await requireStaff();
    const status = await getParametrizationStatus(auth.accountingId);

    return success(status);
  } catch (err) {
    return handleError(err);
  }
}
